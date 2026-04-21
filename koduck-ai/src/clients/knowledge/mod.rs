//! Knowledge service HTTP client helpers.

use std::collections::HashSet;
use std::sync::Arc;
use std::time::Duration;

use reqwest::StatusCode;
use serde::{Deserialize, Serialize};

use crate::app::AppState;
use crate::registry::{ServiceKind, ServiceProtocol};
use crate::reliability::error::{AppError, ErrorCode, UpstreamService};

const CONNECT_TIMEOUT_SECS: u64 = 3;
const REQUEST_TIMEOUT_SECS: u64 = 5;

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SearchHit {
    pub entity_id: i64,
    pub canonical_name: String,
    pub entity_name: String,
    #[serde(default)]
    pub domain_class: String,
    pub match_type: String,
    pub basic_profile_s3_uri: Option<String>,
    pub valid_from: Option<String>,
    pub valid_to: Option<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct BasicProfileView {
    pub entity_id: i64,
    pub canonical_name: String,
    pub entity_name: String,
    pub domain_class: String,
    pub valid_from: Option<String>,
    pub valid_to: Option<String>,
    pub basic_profile_s3_uri: Option<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct EntityFactView {
    pub entity_id: i64,
    pub domain_class: String,
    pub entity_name: String,
    pub basic_profile_s3_uri: Option<String>,
    pub valid_from: Option<String>,
    pub valid_to: Option<String>,
    pub profile_entry_code: Option<String>,
    pub blob_uri: Option<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ProfileDetailView {
    pub entity_id: i64,
    pub entry_code: String,
    pub version: i32,
    pub is_current: bool,
    pub blob_uri: String,
    pub loaded_at: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct KnowledgeQueryResult {
    pub query: String,
    pub domain_class: String,
    pub hits: Vec<SearchHit>,
    pub primary_profile: Option<BasicProfileView>,
    pub facts: Vec<EntityFactView>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct KnowledgeDomainCatalogView {
    #[allow(dead_code)]
    service: String,
    domain_classes: Vec<String>,
}

pub async fn query_knowledge(
    state: &Arc<AppState>,
    request_id: &str,
    query: &str,
    domain_class: &str,
) -> Result<KnowledgeQueryResult, AppError> {
    let client = build_http_client(request_id)?;
    let base_url = resolve_knowledge_base_url(state, request_id).await?;
    let hits = search_entities(&client, &base_url, request_id, query, domain_class).await?;

    let primary_profile = match hits.first() {
        Some(hit) => Some(
            get_basic_profile(&client, &base_url, request_id, hit.entity_id, domain_class).await?,
        ),
        None => None,
    };

    Ok(KnowledgeQueryResult {
        query: query.to_string(),
        domain_class: domain_class.to_string(),
        hits,
        primary_profile,
        facts: Vec::new(),
    })
}

pub async fn query_knowledge_candidates(
    state: &Arc<AppState>,
    request_id: &str,
    query: &str,
) -> Result<KnowledgeQueryResult, AppError> {
    let client = build_http_client(request_id)?;
    let base_url = resolve_knowledge_base_url(state, request_id).await?;
    let domain_classes = list_domain_classes(&client, &base_url, request_id).await?;
    let mut hits = Vec::new();

    for domain_class in domain_classes {
        let search_hits = search_entities(&client, &base_url, request_id, query, &domain_class).await?;
        hits.extend(search_hits);
    }
    let hits = dedupe_cross_domain_candidate_hits(hits);

    Ok(KnowledgeQueryResult {
        query: query.to_string(),
        domain_class: String::new(),
        hits,
        primary_profile: None,
        facts: Vec::new(),
    })
}

pub async fn get_profile_detail(
    state: &Arc<AppState>,
    request_id: &str,
    entity_id: i64,
    entry_code: &str,
) -> Result<ProfileDetailView, AppError> {
    let client = build_http_client(request_id)?;
    let base_url = resolve_knowledge_base_url(state, request_id).await?;
    get_profile_detail_by_entry(&client, &base_url, request_id, entity_id, entry_code).await
}

fn build_http_client(request_id: &str) -> Result<reqwest::Client, AppError> {
    reqwest::Client::builder()
        .use_native_tls()
        .connect_timeout(Duration::from_secs(CONNECT_TIMEOUT_SECS))
        .timeout(Duration::from_secs(REQUEST_TIMEOUT_SECS))
        .build()
        .map_err(|err| {
            AppError::new(
                ErrorCode::InternalError,
                "failed to build knowledge http client",
            )
            .with_request_id(request_id.to_string())
            .with_upstream(UpstreamService::Knowledge)
            .with_source(err)
        })
}

async fn resolve_knowledge_base_url(
    state: &Arc<AppState>,
    request_id: &str,
) -> Result<String, AppError> {
    let service = state
        .service_registry
        .resolve_ai_capability_service(ServiceKind::Knowledge)
        .await
        .ok_or_else(|| {
            AppError::new(
                ErrorCode::DependencyFailed,
                "knowledge service is not registered in capability service registry",
            )
            .with_request_id(request_id.to_string())
            .with_upstream(UpstreamService::Knowledge)
        })?;

    if service.endpoint.protocol != ServiceProtocol::Http {
        return Err(
            AppError::new(
                ErrorCode::DependencyFailed,
                format!(
                    "knowledge service '{}' advertises unsupported endpoint protocol '{}'",
                    service.name, service.endpoint.protocol
                ),
            )
            .with_request_id(request_id.to_string())
            .with_upstream(UpstreamService::Knowledge),
        );
    }

    Ok(service.endpoint.target.trim_end_matches('/').to_string())
}

async fn search_entities(
    client: &reqwest::Client,
    base_url: &str,
    request_id: &str,
    query: &str,
    domain_class: &str,
) -> Result<Vec<SearchHit>, AppError> {
    let response = client
        .get(format!("{base_url}/api/v1/entities/actions/search"))
        .query(&[("name", query), ("domainClass", domain_class)])
        .header("x-request-id", request_id)
        .send()
        .await
        .map_err(|err| transport_error(request_id, "search knowledge entities", err))?;

    let mut hits: Vec<SearchHit> =
        decode_json_response(response, request_id, "search knowledge entities").await?;
    for hit in &mut hits {
        hit.domain_class = domain_class.to_string();
    }
    Ok(hits)
}

async fn list_domain_classes(
    client: &reqwest::Client,
    base_url: &str,
    request_id: &str,
) -> Result<Vec<String>, AppError> {
    let response = client
        .get(format!("{base_url}/internal/domain-classes"))
        .header("x-request-id", request_id)
        .send()
        .await
        .map_err(|err| transport_error(request_id, "list knowledge domain classes", err))?;

    let catalog: KnowledgeDomainCatalogView =
        decode_json_response(response, request_id, "list knowledge domain classes").await?;
    Ok(catalog
        .domain_classes
        .into_iter()
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
        .collect())
}

fn dedupe_cross_domain_candidate_hits(hits: Vec<SearchHit>) -> Vec<SearchHit> {
    let mut seen_entity_ids = HashSet::new();
    let mut deduped = Vec::new();

    for hit in hits {
        if seen_entity_ids.insert(hit.entity_id) {
            deduped.push(hit);
        }
    }

    deduped
}

async fn get_basic_profile(
    client: &reqwest::Client,
    base_url: &str,
    request_id: &str,
    entity_id: i64,
    domain_class: &str,
) -> Result<BasicProfileView, AppError> {
    let response = client
        .get(format!("{base_url}/api/v1/entities/{entity_id}/basic-profile"))
        .query(&[("domainClass", domain_class)])
        .header("x-request-id", request_id)
        .send()
        .await
        .map_err(|err| transport_error(request_id, "fetch knowledge basic profile", err))?;

    decode_json_response(response, request_id, "fetch knowledge basic profile").await
}

async fn get_profile_detail_by_entry(
    client: &reqwest::Client,
    base_url: &str,
    request_id: &str,
    entity_id: i64,
    entry_code: &str,
) -> Result<ProfileDetailView, AppError> {
    let response = client
        .get(format!(
            "{base_url}/api/v1/entities/{entity_id}/profiles/{entry_code}"
        ))
        .header("x-request-id", request_id)
        .send()
        .await
        .map_err(|err| transport_error(request_id, "fetch knowledge profile detail", err))?;

    decode_json_response(response, request_id, "fetch knowledge profile detail").await
}

async fn decode_json_response<T: for<'de> Deserialize<'de>>(
    response: reqwest::Response,
    request_id: &str,
    action: &'static str,
) -> Result<T, AppError> {
    let status = response.status();
    if !status.is_success() {
        return Err(http_error(response, request_id, action, status).await);
    }

    response.json::<T>().await.map_err(|err| {
        AppError::new(
            ErrorCode::DependencyFailed,
            format!("{action} returned malformed json: {err}"),
        )
        .with_request_id(request_id.to_string())
        .with_upstream(UpstreamService::Knowledge)
        .with_source(err)
    })
}

fn transport_error(
    request_id: &str,
    action: &'static str,
    err: reqwest::Error,
) -> AppError {
    AppError::new(
        ErrorCode::UpstreamUnavailable,
        format!("{action} failed: {err}"),
    )
    .with_request_id(request_id.to_string())
    .with_upstream(UpstreamService::Knowledge)
    .with_source(err)
}

async fn http_error(
    response: reqwest::Response,
    request_id: &str,
    action: &'static str,
    status: StatusCode,
) -> AppError {
    let body = response.text().await.unwrap_or_default();
    let code = match status {
        StatusCode::BAD_REQUEST => ErrorCode::InvalidArgument,
        StatusCode::NOT_FOUND => ErrorCode::ResourceNotFound,
        StatusCode::TOO_MANY_REQUESTS => ErrorCode::RateLimited,
        StatusCode::BAD_GATEWAY
        | StatusCode::GATEWAY_TIMEOUT
        | StatusCode::SERVICE_UNAVAILABLE => ErrorCode::UpstreamUnavailable,
        _ if status.is_server_error() => ErrorCode::DependencyFailed,
        _ => ErrorCode::DependencyFailed,
    };

    let message = if body.trim().is_empty() {
        format!("{action} returned http {}", status.as_u16())
    } else {
        format!("{action} returned http {}: {}", status.as_u16(), body.trim())
    };

    AppError::new(code, message)
        .with_request_id(request_id.to_string())
        .with_upstream(UpstreamService::Knowledge)
}

#[cfg(test)]
mod tests {
    use super::{SearchHit, dedupe_cross_domain_candidate_hits};

    fn hit(entity_id: i64, domain_class: &str, canonical_name: &str) -> SearchHit {
        SearchHit {
            entity_id,
            canonical_name: canonical_name.to_string(),
            entity_name: canonical_name.to_string(),
            domain_class: domain_class.to_string(),
            match_type: "CANONICAL_EXACT".to_string(),
            basic_profile_s3_uri: None,
            valid_from: None,
            valid_to: None,
        }
    }

    #[test]
    fn collapses_same_entity_across_multiple_domains() {
        let hits = vec![
            hit(10000001, "history", "威廉二世"),
            hit(10000001, "military", "威廉二世"),
            hit(10000001, "politics", "威廉二世"),
        ];

        let deduped = dedupe_cross_domain_candidate_hits(hits);

        assert_eq!(deduped.len(), 1);
        assert_eq!(deduped[0].entity_id, 10000001);
        assert_eq!(deduped[0].domain_class, "history");
    }

    #[test]
    fn keeps_distinct_entities_even_when_domain_matches() {
        let hits = vec![
            hit(10000001, "history", "威廉二世"),
            hit(10000002, "history", "腓特烈三世"),
            hit(10000003, "history", "维多利亚长公主"),
        ];

        let deduped = dedupe_cross_domain_candidate_hits(hits);

        assert_eq!(
            deduped.iter().map(|hit| hit.entity_id).collect::<Vec<_>>(),
            vec![10000001, 10000002, 10000003]
        );
    }
}
