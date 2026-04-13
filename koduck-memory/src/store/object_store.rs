//! Object storage client for L0 raw material storage.
//!
//! Uses AWS S3 SDK with custom endpoint for MinIO compatibility.

use aws_credential_types::Credentials;
use aws_sdk_s3::Client;
use aws_sdk_s3::config::{Builder as S3ConfigBuilder, Region, SharedCredentialsProvider};
use tracing::{debug, error, info, instrument};
use uuid::Uuid;

use crate::config::ObjectStoreSection;
use crate::store::l0::{build_l0_uri, L0EntryContent};
use crate::Result;

/// Client for interacting with S3-compatible object storage.
#[derive(Clone)]
pub struct ObjectStoreClient {
    client: Client,
    bucket: String,
    endpoint: String,
}

impl ObjectStoreClient {
    /// Create a new object store client from configuration.
    pub async fn new(config: &ObjectStoreSection) -> Result<Self> {
        let credentials = Credentials::new(
            &config.access_key,
            &config.secret_key,
            None,
            None,
            "static",
        );

        let region = Region::new(config.region.clone());

        let sdk_config = aws_config::SdkConfig::builder()
            .credentials_provider(SharedCredentialsProvider::new(credentials))
            .region(region)
            .endpoint_url(&config.endpoint)
            .build();

        // MinIO in-cluster endpoints work reliably with path-style addressing.
        let s3_config = S3ConfigBuilder::from(&sdk_config)
            .force_path_style(true)
            .build();

        let client = Client::from_conf(s3_config);

        // Verify bucket exists or create it
        Self::ensure_bucket_exists(&client, &config.bucket).await?;

        info!(
            bucket = %config.bucket,
            endpoint = %config.endpoint,
            "Object store client initialized"
        );

        Ok(Self {
            client,
            bucket: config.bucket.clone(),
            endpoint: config.endpoint.clone(),
        })
    }

    /// Ensure the target bucket exists, creating it if necessary.
    async fn ensure_bucket_exists(client: &Client, bucket: &str) -> Result<()> {
        match client.head_bucket().bucket(bucket).send().await {
            Ok(_) => {
                debug!(bucket = %bucket, "Bucket exists");
                Ok(())
            }
            Err(error) => {
                info!(bucket = %bucket, error = %error, "Bucket missing or not reachable, creating bucket");
                client
                    .create_bucket()
                    .bucket(bucket)
                    .send()
                    .await
                    .map_err(|e| anyhow::anyhow!("Failed to create bucket: {e}"))?;
                info!(bucket = %bucket, "Bucket created successfully");
                Ok(())
            }
        }
    }

    /// Store an L0 entry in object storage.
    ///
    /// Returns the full S3 URI of the stored object.
    #[instrument(
        skip(self, content),
        fields(
            tenant_id = %content.tenant_id,
            session_id = %content.session_id,
            entry_id = %content.entry_id,
            sequence_num = content.sequence_num,
        )
    )]
    pub async fn put_l0_entry(&self, content: &L0EntryContent) -> Result<String> {
        let key = content.build_object_key();
        let body = content.to_json_bytes()?;
        let body_size = body.len();

        debug!(key = %key, size = body_size, "Uploading L0 entry to object storage");

        self.client
            .put_object()
            .bucket(&self.bucket)
            .key(&key)
            .content_type("application/json")
            .body(body.into())
            .metadata("schema_version", &content.schema_version)
            .metadata("tenant_id", &content.tenant_id)
            .metadata("session_id", &content.session_id.to_string())
            .metadata("entry_id", &content.entry_id.to_string())
            .metadata("sequence_num", &content.sequence_num.to_string())
            .send()
            .await
            .map_err(|e| {
                error!(error = %e, key = %key, "Failed to upload L0 entry");
                anyhow::anyhow!("Failed to upload L0 entry: {e}")
            })?;

        let uri = build_l0_uri(&self.bucket, &key);

        info!(
            uri = %uri,
            key = %key,
            size = body_size,
            "L0 entry uploaded successfully"
        );

        Ok(uri)
    }

    /// Fetch and deserialize a previously stored L0 entry.
    pub async fn get_l0_entry(&self, uri: &str) -> Result<L0EntryContent> {
        let (bucket, key) = parse_l0_uri(uri)?;
        let response = self
            .client
            .get_object()
            .bucket(bucket)
            .key(key)
            .send()
            .await
            .map_err(|e| anyhow::anyhow!("Failed to fetch L0 entry: {e}"))?;
        let bytes = response
            .body
            .collect()
            .await
            .map_err(|e| anyhow::anyhow!("Failed to read L0 entry body: {e}"))?
            .into_bytes();

        Ok(serde_json::from_slice::<L0EntryContent>(&bytes)?)
    }

    /// Get the bucket name.
    pub fn bucket(&self) -> &str {
        &self.bucket
    }

    /// Get the endpoint URL.
    pub fn endpoint(&self) -> &str {
        &self.endpoint
    }

    /// Build the object key for an entry without storing it.
    ///
    /// This is useful for generating the expected URI before storage.
    pub fn build_key(
        &self,
        tenant_id: &str,
        session_id: Uuid,
        sequence_num: i64,
        entry_id: Uuid,
    ) -> String {
        format!(
            "tenants/{}/sessions/{}/entries/{:010}-{}.json",
            tenant_id, session_id, sequence_num, entry_id
        )
    }

    /// Build the full L0 URI for an entry.
    pub fn build_uri(
        &self,
        tenant_id: &str,
        session_id: Uuid,
        sequence_num: i64,
        entry_id: Uuid,
    ) -> String {
        let key = self.build_key(tenant_id, session_id, sequence_num, entry_id);
        build_l0_uri(&self.bucket, &key)
    }
}

fn parse_l0_uri(uri: &str) -> Result<(&str, &str)> {
    let without_scheme = uri
        .strip_prefix("s3://")
        .ok_or_else(|| anyhow::anyhow!("invalid L0 uri: {uri}"))?;
    let (bucket, key) = without_scheme
        .split_once('/')
        .ok_or_else(|| anyhow::anyhow!("invalid L0 uri: {uri}"))?;
    if bucket.trim().is_empty() || key.trim().is_empty() {
        anyhow::bail!("invalid L0 uri: {uri}");
    }
    Ok((bucket, key))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_config() -> ObjectStoreSection {
        ObjectStoreSection {
            endpoint: "http://127.0.0.1:9000".to_string(),
            bucket: "koduck-memory-test".to_string(),
            access_key: "minioadmin".to_string(),
            secret_key: "minioadmin".to_string(),
            region: "ap-east-1".to_string(),
        }
    }

    #[test]
    fn object_store_builds_correct_key() {
        // We'll test this without creating a real client
        // Just verify the key format logic
        let session_id = Uuid::parse_str("550e8400-e29b-41d4-a716-446655440000").unwrap();
        let entry_id = Uuid::parse_str("660e8400-e29b-41d4-a716-446655440001").unwrap();

        let key = format!(
            "tenants/{}/sessions/{}/entries/{:010}-{}.json",
            "tenant-123", session_id, 42i64, entry_id
        );

        assert_eq!(
            key,
            "tenants/tenant-123/sessions/550e8400-e29b-41d4-a716-446655440000/entries/0000000042-660e8400-e29b-41d4-a716-446655440001.json"
        );
    }

    #[test]
    fn l0_uri_format_is_correct() {
        let uri = build_l0_uri("my-bucket", "path/to/object.json");
        assert_eq!(uri, "s3://my-bucket/path/to/object.json");
    }

    #[test]
    fn parse_l0_uri_extracts_bucket_and_key() {
        let (bucket, key) = parse_l0_uri("s3://my-bucket/path/to/object.json").unwrap();
        assert_eq!(bucket, "my-bucket");
        assert_eq!(key, "path/to/object.json");
    }
}
