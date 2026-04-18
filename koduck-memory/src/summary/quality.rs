pub fn is_quality_summary(summary: &str) -> bool {
    let normalized = summary.trim();
    if normalized.chars().count() < 24 {
        return false;
    }

    let lower = normalized.to_lowercase();
    let has_template_session_prefix =
        lower.starts_with("session '") && lower.contains("summary (") && lower.contains("messages):");

    !has_template_session_prefix
        && ![
            "summary task already accepted",
            "accepted for session",
            "pending",
            "n/a",
            "todo",
        ]
        .iter()
        .any(|marker| lower.contains(marker))
}

#[cfg(test)]
#[path = "../tests/summary/quality_tests.rs"]
mod tests;
