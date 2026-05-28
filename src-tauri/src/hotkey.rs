use anyhow::Result;
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

/// Default warm-capture hotkey: Control+Option+N (⌃⌥N).
fn default_hotkey() -> Shortcut {
    Shortcut::new(Some(Modifiers::CONTROL | Modifiers::ALT), Code::KeyN)
}

pub fn register(app: AppHandle) -> Result<()> {
    let shortcut_mgr = app.global_shortcut();
    let hotkey = default_hotkey();

    shortcut_mgr.on_shortcut(hotkey, move |handle, _shortcut, event| {
        if event.state() != ShortcutState::Pressed {
            return;
        }
        if let Some(window) = handle.get_webview_window("capture") {
            // Toggle: if visible & focused, hide; otherwise show & focus.
            let is_visible = window.is_visible().unwrap_or(false);
            let is_focused = window.is_focused().unwrap_or(false);

            if is_visible && is_focused {
                let _ = window.hide();
            } else {
                let _ = window.center();
                let _ = window.show();
                let _ = window.set_focus();
                let _ = window.emit("pap://open-last-or-new", ());
            }
        }
    })?;

    Ok(())
}
