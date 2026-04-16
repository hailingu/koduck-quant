use tonic::{Response, Status};
use uuid::Uuid;

use crate::api::GetSessionIdsLookupResponse;
use crate::facts::MemoryFactRepository;
use crate::memory_anchor::{MemoryUnitAnchorRepository, MemoryUnitAnchorType};
use crate::retrieve::{QueryIntentType, map_intent_to_discourse_action};

fn parse_intent_type(value: &str) -> Option<QueryIntentType> {
    match value.trim().to_lowercase().as_str() {
        "recall" => Some(QueryIntentType::Recall),
        "compare" => Some(QueryIntentType::Compare),
        "disambiguate" => Some(QueryIntentType::Disambiguate),
        "correct" => Some(QueryIntentType::Correct),
        "explain" => Some(QueryIntentType::Explain),
        "decide" => Some(QueryIntentType::Decide),
        "none" => Some(QueryIntentType::None),
        _ => None,
    }
}

fn lookup_response(session_ids: Vec<Uuid>) -> Response<GetSessionIdsLookupResponse> {
    Response::new(GetSessionIdsLookupResponse {
        ok: true,
        session_ids: session_ids.into_iter().map(|id| id.to_string()).collect(),
        error: None,
    })
}

pub(crate) async fn lookup_by_domain_class(
    anchor_repo: &MemoryUnitAnchorRepository,
    tenant_id: &str,
    domain_class: &str,
    limit: i64,
) -> Result<Response<GetSessionIdsLookupResponse>, Status> {
    let domain_class = domain_class.trim();
    if domain_class.is_empty() {
        return Err(Status::invalid_argument("domain_class is required"));
    }

    let session_ids = anchor_repo
        .list_session_ids_by_anchor(
            tenant_id,
            MemoryUnitAnchorType::Domain,
            domain_class,
            limit,
        )
        .await
        .map_err(|e| Status::internal(format!("failed to list session ids by domain_class: {e}")))?;

    Ok(lookup_response(session_ids))
}

pub(crate) async fn lookup_by_ner(
    fact_repo: &MemoryFactRepository,
    tenant_id: &str,
    ner: &str,
    limit: i64,
) -> Result<Response<GetSessionIdsLookupResponse>, Status> {
    let ner = ner.trim();
    if ner.is_empty() {
        return Err(Status::invalid_argument("ner is required"));
    }

    let session_ids = fact_repo
        .list_session_ids_by_ner(tenant_id, ner, limit)
        .await
        .map_err(|e| Status::internal(format!("failed to list session ids by ner: {e}")))?;

    Ok(lookup_response(session_ids))
}

pub(crate) async fn lookup_by_intent_type(
    anchor_repo: &MemoryUnitAnchorRepository,
    tenant_id: &str,
    intent_type: &str,
    limit: i64,
) -> Result<Response<GetSessionIdsLookupResponse>, Status> {
    let intent_type = intent_type.trim();
    if intent_type.is_empty() {
        return Err(Status::invalid_argument("intent_type is required"));
    }

    let discourse_action = parse_intent_type(intent_type)
        .and_then(map_intent_to_discourse_action)
        .ok_or_else(|| Status::invalid_argument("unsupported intent_type"))?;

    let session_ids = anchor_repo
        .list_session_ids_by_anchor(
            tenant_id,
            MemoryUnitAnchorType::DiscourseAction,
            discourse_action.as_str(),
            limit,
        )
        .await
        .map_err(|e| Status::internal(format!("failed to list session ids by intent_type: {e}")))?;

    Ok(lookup_response(session_ids))
}
