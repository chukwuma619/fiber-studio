#[derive(Debug, Clone, PartialEq, Eq)]
pub struct MigrationDetails {
    pub message: String,
    pub has_breaking_change: bool,
    pub cancelled: bool,
}

pub fn parse_migration_from_logs(logs: &[String]) -> Option<MigrationDetails> {
    let text = logs.join("\n");
    if !text.contains("Database migration required") {
        return None;
    }

    let message = text
        .lines()
        .find(|line| line.contains("Database migration required"))
        .map(str::trim)
        .filter(|line| !line.is_empty())
        .unwrap_or("Database migration required")
        .to_string();

    let has_breaking_change = text.contains("breaking changes");
    let cancelled = text.contains("Migration cancelled");

    Some(MigrationDetails {
        message,
        has_breaking_change,
        cancelled,
    })
}

pub fn format_migration_required_error(details: &MigrationDetails) -> String {
    let suffix = if details.has_breaking_change {
        "|breaking_change=true"
    } else {
        ""
    };
    format!("MIGRATION_REQUIRED:{}{}", details.message, suffix)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn detects_cancelled_migration_from_logs() {
        let logs = vec![
            "Database migration required (20260302100001 -> 20260618120000), 2 pending migration(s). Backup recommended.".into(),
            "Continue? [y/N] Error: Exit because Migration cancelled by user".into(),
        ];

        let details = parse_migration_from_logs(&logs).expect("migration details");
        assert!(details.cancelled);
        assert!(!details.has_breaking_change);
        assert!(details.message.contains("2 pending migration"));
    }

    #[test]
    fn detects_breaking_change_warning() {
        let logs = vec![
            "Database migration required (20260302100001 -> 20260618120000), 1 pending migration(s). Backup recommended.".into(),
            "WARNING: This migration contains breaking changes. You should shutdown all channels and backup your data.".into(),
            "Migration cancelled by user".into(),
        ];

        let details = parse_migration_from_logs(&logs).expect("migration details");
        assert!(details.has_breaking_change);
        assert!(details.cancelled);
    }
}
