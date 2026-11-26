#[derive(Debug, Clone, PartialEq, Eq)]
pub struct MigrationDetails {
    pub message: String,
    pub has_breaking_change: bool,
    pub cancelled: bool,
    pub is_legacy_channel_block: bool,
}

pub fn parse_migration_from_logs(logs: &[String]) -> Option<MigrationDetails> {
    let text = logs.join("\n");

    let is_legacy_channel_block = text
        .contains("V1 or unverifiable records that are not safely closed")
        || text.contains("pending V1 channel")
        || text.contains("Unfinished V1 or unverifiable opening record")
        || text.contains("Migration 20261113000001 failed");

    let has_migration_required = text.contains("Database migration required");
    let has_migration_failed = text.contains("Exit because Migration")
        || text.contains("Migration failed")
        || is_legacy_channel_block;

    if !has_migration_required && !has_migration_failed {
        return None;
    }

    let message = if is_legacy_channel_block {
        text.lines()
            .find(|line| {
                line.contains("V1 or unverifiable records")
                    || line.contains("Migration 20261113000001 failed")
            })
            .map(str::trim)
            .filter(|line| !line.is_empty())
            .unwrap_or("Found legacy channel records that prevent database migration.")
            .to_string()
    } else if has_migration_required {
        text.lines()
            .find(|line| line.contains("Database migration required"))
            .map(str::trim)
            .filter(|line| !line.is_empty())
            .unwrap_or("Database migration required")
            .to_string()
    } else {
        text.lines()
            .find(|line| {
                line.contains("Exit because Migration") || line.contains("Migration failed")
            })
            .map(str::trim)
            .filter(|line| !line.is_empty())
            .unwrap_or("Database migration failed")
            .to_string()
    };

    let has_breaking_change = text.contains("breaking changes") || is_legacy_channel_block;
    let cancelled = text.contains("Migration cancelled") || is_legacy_channel_block;

    Some(MigrationDetails {
        message,
        has_breaking_change,
        cancelled,
        is_legacy_channel_block,
    })
}

pub fn format_migration_required_error(details: &MigrationDetails) -> String {
    let mut flags = Vec::new();
    if details.has_breaking_change {
        flags.push("breaking_change=true");
    }
    if details.is_legacy_channel_block {
        flags.push("legacy_channel_block=true");
    }
    let suffix = if flags.is_empty() {
        "".to_string()
    } else {
        format!("|{}", flags.join("|"))
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
        assert!(!details.is_legacy_channel_block);
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
        assert!(!details.is_legacy_channel_block);
    }

    #[test]
    fn detects_legacy_channel_migration_failure() {
        let logs = vec![
            "INFO fnn: Starting node with git version c84e9b69".into(),
            "Error: Exit because Migration 20261113000001 failed: Found 29 V1 or unverifiable records that are not safely closed. Close these channels and finish pending settlement/delivery with the old binary, then retry this upgrade. No records or database version were changed.".into(),
        ];

        let details = parse_migration_from_logs(&logs).expect("migration details");
        assert!(details.is_legacy_channel_block);
        assert!(details.has_breaking_change);
        assert!(details.cancelled);
        assert!(details
            .message
            .contains("Found 29 V1 or unverifiable records"));

        let formatted = format_migration_required_error(&details);
        assert!(formatted.contains("legacy_channel_block=true"));
        assert!(formatted.contains("breaking_change=true"));
    }

    #[test]
    fn ignores_studio_archive_log_after_successful_migration() {
        let logs = vec![
            "Backed up data directory to /tmp/fiber-studio-backup".into(),
            "Set aside the previous channel database so Fiber 0.10.1 can start.".into(),
            "Migration complete: 20260302100001 -> 20261113000001".into(),
        ];

        let details = parse_migration_from_logs(&logs);
        assert!(details.is_none());
    }
}
