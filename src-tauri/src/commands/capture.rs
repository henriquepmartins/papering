use tauri::{AppHandle, Manager};

#[tauri::command]
pub fn hide_capture(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("capture") {
        window.hide().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn capture_ready() -> Result<(), String> {
    Ok(())
}

#[tauri::command]
pub fn start_resize(app: AppHandle, direction: String) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("capture") {
        crate::window_style::start_resize(&window, &direction).map_err(|e| e.to_string())?;
    }
    Ok(())
}
