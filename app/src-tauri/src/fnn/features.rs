/// Whether a Fiber feature list advertises Channel V2 support.
///
/// Fiber advertises `CHANNEL_V2_OPTIONAL` / `CHANNEL_V2_REQUIRED` via
/// `FeatureVector::enabled_features_names()` (see fiber-types `feature_bits`).
pub fn supports_channel_v2(features: &[String]) -> bool {
    features.iter().any(|feature| {
        let upper = feature.to_ascii_uppercase();
        upper == "CHANNEL_V2_OPTIONAL"
            || upper == "CHANNEL_V2_REQUIRED"
            || upper.contains("CHANNEL_V2")
    })
}

/// Whether a *graph* node announcement looks Channel V2-capable.
///
/// Prefers advertised features (`enabled_features_names()`); falls back to the
/// announced `version` (≥ 0.10.0) only when the feature list is empty.
///
/// This is a gossip hint only. Fiber opens channels from the peer's Init/session
/// `FeatureVector` (`supports_channel_v2()`), which `list_peers` does not expose.
pub fn graph_node_supports_channel_v2(features: &[String], version: Option<&str>) -> bool {
    if supports_channel_v2(features) {
        return true;
    }
    // Explicit feature list without CHANNEL_V2 means the announcement does not claim it.
    if !features.is_empty() {
        return false;
    }
    version.is_some_and(|raw| crate::fnn::version::version_at_least(raw, "0.10.0"))
}

/// Human-readable labels for common Fiber feature bits.
pub fn feature_display_label(feature: &str) -> &str {
    let upper = feature.to_ascii_uppercase();
    if upper.contains("CHANNEL_V2") {
        "Channel V2"
    } else if upper.contains("BASIC_MPP") {
        "Multi-part payments"
    } else if upper.contains("TRAMPOLINE") {
        "Trampoline routing"
    } else if upper.contains("GOSSIP") {
        "Gossip queries"
    } else {
        feature
    }
}

/// Map raw feature strings to unique friendly labels (stable order).
pub fn feature_labels(features: &[String]) -> Vec<String> {
    let mut labels = Vec::new();
    for feature in features {
        let label = feature_display_label(feature).to_string();
        if !labels.iter().any(|existing| existing == &label) {
            labels.push(label);
        }
    }
    labels
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn detects_channel_v2_required_and_optional() {
        assert!(supports_channel_v2(&[
            "GOSSIP_QUERIES_REQUIRED".into(),
            "CHANNEL_V2_REQUIRED".into(),
        ]));
        assert!(supports_channel_v2(&["channel_v2_optional".into()]));
        assert!(!supports_channel_v2(&[
            "GOSSIP_QUERIES_REQUIRED".into(),
            "BASIC_MPP_REQUIRED".into(),
        ]));
    }

    #[test]
    fn graph_node_v2_uses_features_then_version_fallback() {
        assert!(graph_node_supports_channel_v2(
            &["CHANNEL_V2_OPTIONAL".into()],
            Some("0.9.1")
        ));
        assert!(!graph_node_supports_channel_v2(
            &["GOSSIP_QUERIES_REQUIRED".into()],
            Some("0.10.0")
        ));
        assert!(graph_node_supports_channel_v2(&[], Some("0.10.0")));
        assert!(!graph_node_supports_channel_v2(&[], Some("0.9.1")));
        assert!(!graph_node_supports_channel_v2(&[], None));
    }

    #[test]
    fn dedupes_friendly_labels() {
        let labels = feature_labels(&[
            "CHANNEL_V2_REQUIRED".into(),
            "CHANNEL_V2_OPTIONAL".into(),
            "BASIC_MPP_REQUIRED".into(),
        ]);
        assert_eq!(
            labels,
            vec![
                "Channel V2".to_string(),
                "Multi-part payments".to_string(),
            ]
        );
    }
}
