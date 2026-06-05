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

/// Begin an interactive edge/corner resize of the capture window. tao's
/// `startResizeDragging` is a no-op on macOS, so the grab handles call this
/// instead — it runs a native AppKit drag loop until mouse-up.
#[tauri::command]
pub fn start_resize(app: AppHandle, direction: String) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("capture") {
        crate::window_style::start_resize(&window, &direction).map_err(|e| e.to_string())?;
    }
    Ok(())
}
