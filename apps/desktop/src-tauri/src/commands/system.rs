use tauri::command;

/// Apre un URL nel browser di sistema usando il comando `open` di macOS
#[cfg(target_os = "macos")]
#[command]
pub async fn open_url_in_browser(url: String) -> Result<(), String> {
    use std::process::Command;
    
    println!("[System] Apertura URL nel browser: {}", url);
    
    let output = Command::new("open")
        .arg(&url)
        .output()
        .map_err(|e| format!("Errore nell'esecuzione del comando open: {}", e))?;
    
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Comando open fallito: {}", stderr));
    }
    
    println!("[System] URL aperto con successo");
    Ok(())
}

/// Apre un URL nel browser di sistema (Windows/Linux)
#[cfg(not(target_os = "macos"))]
#[command]
pub async fn open_url_in_browser(url: String) -> Result<(), String> {
    use std::process::Command;
    
    println!("[System] Apertura URL nel browser: {}", url);
    
    #[cfg(target_os = "windows")]
    let command = Command::new("cmd")
        .args(["/C", "start", "", &url])
        .output();
    
    #[cfg(not(target_os = "windows"))]
    let command = Command::new("xdg-open")
        .arg(&url)
        .output();
    
    let output = command
        .map_err(|e| format!("Errore nell'esecuzione del comando: {}", e))?;
    
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Comando fallito: {}", stderr));
    }
    
    println!("[System] URL aperto con successo");
    Ok(())
}

