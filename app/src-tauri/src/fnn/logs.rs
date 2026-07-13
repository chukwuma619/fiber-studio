/// Strip terminal color/formatting codes so log lines render cleanly in the UI.
pub fn normalize_log_line(text: &str) -> String {
    let stripped = strip_ansi_escapes::strip(text.as_bytes());
    String::from_utf8_lossy(&stripped).trim().to_string()
}
