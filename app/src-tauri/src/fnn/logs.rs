/// Strip terminal color/formatting codes so log lines render cleanly in the UI.
pub fn normalize_log_line(text: &str) -> String {
    let stripped = strip_ansi_escapes::strip(text.as_bytes());
    String::from_utf8_lossy(&stripped).trim().to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn strips_color_codes_and_surrounding_space() {
        assert_eq!(normalize_log_line("\u{1b}[31merror\u{1b}[0m  "), "error");
        assert_eq!(normalize_log_line("  plain  "), "plain");
        assert_eq!(normalize_log_line("\u{1b}[2J"), "");
    }
}
