use std::fs::{File, OpenOptions};
use std::io::{self, BufRead, BufReader, Seek, SeekFrom, Write};
use std::path::{Path, PathBuf};

use super::logs::normalize_log_line;

const LOG_FILE_NAME: &str = "fiber-studio-fnn.log";

pub fn log_file_path(data_directory: &Path) -> PathBuf {
    data_directory.join(LOG_FILE_NAME)
}

pub fn clear_log_file(path: &Path) -> io::Result<()> {
    let mut file = OpenOptions::new()
        .create(true)
        .write(true)
        .truncate(true)
        .open(path)?;
    file.flush()?;
    Ok(())
}

pub fn file_len(path: &Path) -> io::Result<u64> {
    if !path.exists() {
        return Ok(0);
    }

    Ok(path.metadata()?.len())
}

pub fn read_tail_lines(path: &Path, max_lines: usize) -> io::Result<Vec<String>> {
    if !path.exists() || max_lines == 0 {
        return Ok(Vec::new());
    }

    let content = std::fs::read_to_string(path)?;
    let lines = content
        .lines()
        .map(|line| normalize_log_line(line))
        .filter(|line| !line.is_empty())
        .collect::<Vec<_>>();
    let skip = lines.len().saturating_sub(max_lines);
    Ok(lines.into_iter().skip(skip).collect())
}

pub fn read_new_lines(path: &Path, offset: &mut u64) -> io::Result<Vec<String>> {
    if !path.exists() {
        *offset = 0;
        return Ok(Vec::new());
    }

    let len = path.metadata()?.len();
    if *offset > len {
        *offset = 0;
    }

    if *offset == len {
        return Ok(Vec::new());
    }

    let mut file = File::open(path)?;
    file.seek(SeekFrom::Start(*offset))?;

    let mut reader = BufReader::new(file);
    let mut lines = Vec::new();

    loop {
        let mut buffer = String::new();
        let bytes = reader.read_line(&mut buffer)?;
        if bytes == 0 {
            break;
        }

        let position = reader.stream_position()?;
        if buffer.ends_with('\n') {
            let line = normalize_log_line(&buffer);
            if !line.is_empty() {
                lines.push(line);
            }
            *offset = position;
        } else {
            *offset = position - bytes as u64;
            break;
        }
    }

    Ok(lines)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs::{self, OpenOptions};
    use std::io::Write;
    use std::path::PathBuf;

    fn temp_dir() -> PathBuf {
        let nanos = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .expect("time")
            .as_nanos();
        let dir = std::env::temp_dir().join(format!("fiber-studio-logs-{nanos}"));
        fs::create_dir_all(&dir).expect("mkdir");
        dir
    }

    #[test]
    fn tail_keeps_the_newest_non_empty_lines() {
        let dir = temp_dir();
        let path = log_file_path(&dir);
        fs::write(&path, "\u{1b}[32mone\u{1b}[0m\n\n two \nthree\n").unwrap();

        assert_eq!(
            read_tail_lines(&path, 2).unwrap(),
            vec!["two".to_string(), "three".to_string()]
        );
        assert!(read_tail_lines(&path, 0).unwrap().is_empty());
        assert!(read_tail_lines(dir.join("missing.log").as_path(), 5)
            .unwrap()
            .is_empty());
        assert_eq!(file_len(dir.join("missing.log").as_path()).unwrap(), 0);
        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn new_lines_wait_for_a_newline_and_reread_after_the_file_shrinks() {
        let dir = temp_dir();
        let path = log_file_path(&dir);
        fs::write(&path, "alpha\nbet").unwrap();

        let mut offset = 0;
        assert_eq!(read_new_lines(&path, &mut offset).unwrap(), vec!["alpha"]);

        let mut file = OpenOptions::new().append(true).open(&path).unwrap();
        write!(file, "a\n").unwrap();
        assert_eq!(read_new_lines(&path, &mut offset).unwrap(), vec!["beta"]);

        offset = 10_000;
        let lines = read_new_lines(&path, &mut offset).unwrap();
        assert_eq!(lines, vec!["alpha", "beta"]);
        assert_eq!(offset, file_len(&path).unwrap());

        clear_log_file(&path).unwrap();
        assert_eq!(file_len(&path).unwrap(), 0);
        let _ = fs::remove_dir_all(dir);
    }
}
