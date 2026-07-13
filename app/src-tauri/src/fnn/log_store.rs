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
