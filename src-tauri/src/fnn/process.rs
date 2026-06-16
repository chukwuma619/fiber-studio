use std::process::Command;

pub fn kill_process_on_port(port: u16) -> Result<(), String> {
    #[cfg(unix)]
    {
        let port_arg = format!(":{port}");
        let output = Command::new("lsof")
            .args(["-ti", &port_arg])
            .output()
            .map_err(|error| format!("failed to find fnn process: {error}"))?;

        if output.stdout.is_empty() {
            return Ok(());
        }

        let pids = String::from_utf8_lossy(&output.stdout);
        for pid in pids.lines().map(str::trim).filter(|line| !line.is_empty()) {
            Command::new("kill")
                .arg(pid)
                .status()
                .map_err(|error| format!("failed to stop fnn process {pid}: {error}"))?;
        }

        return Ok(());
    }

    #[cfg(windows)]
    {
        let output = Command::new("netstat")
            .args(["-ano"])
            .output()
            .map_err(|error| format!("failed to find fnn process: {error}"))?;

        let needle = format!(":{port}");
        let stdout = String::from_utf8_lossy(&output.stdout);

        for line in stdout.lines() {
            if !line.contains(&needle) || !line.contains("LISTENING") {
                continue;
            }

            let Some(pid) = line.split_whitespace().last() else {
                continue;
            };

            Command::new("taskkill")
                .args(["/PID", pid, "/F"])
                .status()
                .map_err(|error| format!("failed to stop fnn process {pid}: {error}"))?;
        }

        Ok(())
    }

    #[cfg(not(any(unix, windows)))]
    {
        let _ = port;
        Err("stopping fnn is not supported on this platform".into())
    }
}
