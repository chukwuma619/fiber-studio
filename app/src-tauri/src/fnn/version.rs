/// Parse a dotted semver-ish version (`0.10.0`, `v0.9.1`, `Fiber v0.10.0 (abc)`).
/// Finds the first digit run and ignores surrounding text / suffixes.
pub fn parse_version(raw: &str) -> Option<(u64, u64, u64)> {
    let cleaned = raw.trim();
    let start = cleaned.find(|c: char| c.is_ascii_digit())?;
    let numeric = cleaned[start..]
        .split(|c: char| !(c.is_ascii_digit() || c == '.'))
        .next()
        .unwrap_or("");
    let mut parts = numeric.split('.');
    let major = parts.next()?.parse().ok()?;
    let minor = parts.next().unwrap_or("0").parse().unwrap_or(0);
    let patch = parts.next().unwrap_or("0").parse().unwrap_or(0);
    Some((major, minor, patch))
}

pub fn version_cmp(left: &str, right: &str) -> Option<std::cmp::Ordering> {
    Some(parse_version(left)?.cmp(&parse_version(right)?))
}

pub fn version_less_than(left: &str, right: &str) -> bool {
    matches!(version_cmp(left, right), Some(std::cmp::Ordering::Less))
}

pub fn version_at_least(left: &str, right: &str) -> bool {
    let Some(left_parsed) = parse_version(left) else {
        return false;
    };
    let Some(right_parsed) = parse_version(right) else {
        return false;
    };
    left_parsed >= right_parsed
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn compares_fiber_versions() {
        assert!(version_less_than("0.9.1", "0.10.0"));
        assert!(version_at_least("0.10.0", "0.10.0"));
        assert!(version_at_least("0.10.1", "0.10.0"));
        assert!(!version_less_than("0.10.0", "0.9.1"));
        assert!(version_at_least("Fiber v0.10.0 (d6868d1 2026-11-13)", "0.10.0"));
        assert!(version_less_than("fnn Fiber v0.9.1", "0.10.0"));
    }
}
