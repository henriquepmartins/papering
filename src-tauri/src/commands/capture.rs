use tauri::{AppHandle, Manager};

#[tauri::command]
pub fn hide_capture(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("capture") {
        window.hide().map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// Best-effort signal from the webview that it has rendered its first frame.
/// Used by the hotkey timing harness; intentionally a no-op for now.
#[tauri::command]
pub fn capture_ready() -> Result<(), String> {
    Ok(())
}
