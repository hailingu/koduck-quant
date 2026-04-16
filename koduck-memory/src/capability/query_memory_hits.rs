use std::collections::{HashMap, HashSet};
use std::future::Future;

use crate::api::MemoryHit;
use crate::retrieve::{RetrieveResult, match_reason};

pub(crate) async fn hydrate_query_memory_hits<F, Fut>(
    results: Vec<RetrieveResult>,
    mut load_transcript: F,
) -> Vec<MemoryHit>
where
    F: FnMut(String) -> Fut,
    Fut: Future<Output = Option<String>>,
{
    let mut transcript_by_session: HashMap<String, String> = HashMap::new();
    let mut seen_sessions: HashSet<String> = HashSet::new();

    for result in &results {
        if !seen_sessions.insert(result.session_id.clone()) {
            continue;
        }
        if let Some(transcript) = load_transcript(result.session_id.clone()).await {
            transcript_by_session.insert(result.session_id.clone(), transcript);
        }
    }

    results
        .into_iter()
        .filter_map(|result| {
            let session_id = result.session_id.clone();
            let transcript = transcript_by_session.get(&session_id).cloned();
            if transcript.is_none() {
                tracing::warn!(
                    session_id,
                    "query_memory dropped hit because session transcript hydration failed"
                );
            }
            transcript.map(|snippet| MemoryHit {
                session_id,
                l0_uri: result.l0_uri,
                score: result.score,
                match_reasons: match_reason::normalize_output(result.match_reasons),
                snippet,
            })
        })
        .collect()
}
