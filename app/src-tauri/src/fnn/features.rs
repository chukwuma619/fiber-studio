/// Whether a Fiber feature list advertises Channel V2 support.
pub fn supports_channel_v2(features: &[String]) -> bool {
    features.iter().any(|feature| {
        let upper = feature.to_ascii_uppercase();
        upper.contains("CHANNEL_V2")
    })
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
