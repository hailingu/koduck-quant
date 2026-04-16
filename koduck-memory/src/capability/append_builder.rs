use crate::memory::{InsertMemoryEntry, metadata_to_jsonb};
use crate::memory_unit::AppendedEntryUnit;
use crate::store::{L0EntryContent, ObjectStoreClient};

pub(crate) struct PreparedAppendEntries {
    pub entries_to_insert: Vec<InsertMemoryEntry>,
    pub appended_units: Vec<AppendedEntryUnit>,
}

pub(crate) async fn build_append_entries(
    entries: &[crate::api::MemoryEntry],
    object_store: Option<&ObjectStoreClient>,
    tenant_id: &str,
    session_id: uuid::Uuid,
    base_seq: i64,
    request_id: &str,
    trace_id: &str,
) -> PreparedAppendEntries {
    let mut entries_to_insert: Vec<InsertMemoryEntry> = Vec::new();
    let mut appended_units: Vec<AppendedEntryUnit> = Vec::new();

    for (i, entry) in entries.iter().enumerate() {
        let entry_id = uuid::Uuid::new_v4();
        let sequence_num = base_seq + (i as i64) + 1;
        let message_ts =
            chrono::DateTime::from_timestamp_millis(entry.timestamp).unwrap_or_else(chrono::Utc::now);

        let metadata_json = metadata_to_jsonb(&entry.metadata);
        let l0_content = L0EntryContent::new(
            session_id,
            tenant_id,
            entry_id,
            sequence_num,
            &entry.role,
            &entry.content,
            entry.timestamp,
            Some(metadata_json.clone()),
            request_id,
            trace_id,
        );

        let l0_uri = if let Some(object_store) = object_store {
            match object_store.put_l0_entry(&l0_content).await {
                Ok(uri) => {
                    tracing::debug!(entry_id = %entry_id, uri = %uri, "L0 entry stored");
                    uri
                }
                Err(error) => {
                    tracing::warn!(
                        entry_id = %entry_id,
                        error = %error,
                        "Failed to store L0 entry, using placeholder"
                    );
                    format!("l0://pending/{}", entry_id)
                }
            }
        } else {
            format!("l0://pending/{}", entry_id)
        };

        let insert = InsertMemoryEntry {
            id: entry_id,
            tenant_id: tenant_id.to_string(),
            session_id,
            sequence_num,
            role: entry.role.clone(),
            raw_content_ref: format!("ref://{}", entry_id),
            message_ts,
            metadata_json,
            l0_uri,
        };

        appended_units.push(AppendedEntryUnit {
            entry_id,
            tenant_id: tenant_id.to_string(),
            session_id,
            sequence_num,
            content: entry.content.clone(),
            source_uri: insert.l0_uri.clone(),
            message_ts,
        });
        entries_to_insert.push(insert);
    }

    PreparedAppendEntries {
        entries_to_insert,
        appended_units,
    }
}
