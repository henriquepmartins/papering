mod commands;
mod db;
mod fs;
mod hotkey;
mod vibrancy;
mod window_style;

use commands::{capture, images, notes};
use tauri::Manager;
use tauri_plugin_autostart::{MacosLauncher, ManagerExt};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_autostart::init(
            MacosLauncher::LaunchAgent,
            None,
        ))
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            notes::save_note,
            notes::list_notes,
            notes::load_note,
            notes::delete_note,
            images::save_image,
            images::attachments_base,
            capture::hide_capture,
            capture::capture_ready,
            capture::start_resize,
        ])
        .setup(|app| {
            // 0. macOS: run as an accessory app — no Dock icon, no Cmd-Tab entry.
            #[cfg(target_os = "macos")]
            {
                let _ = app.set_activation_policy(tauri::ActivationPolicy::Accessory);
            }

            // 1. Ensure ~/Notes/Inbox exists.
            fs::notes_root::ensure_layout()?;

            // 2. Initialize SQLite (slice 1 uses the schema only as a sanity check).
            if let Err(err) = db::init() {
                eprintln!("[papering] sqlite init failed: {err:#}");
            }

            // 3. Surface the capture window. Vibrancy is a real, always-active
            // NSVisualEffectView inset to the card (see `vibrancy.rs`), so the
            // frosted glass never fades on focus loss the way CSS
            // `backdrop-filter` does. The inset keeps the transparent padding
            // (where tooltips render over the desktop) clear.
            if let Some(capture_window) = app.get_webview_window("capture") {
                // Restore the resizable/miniaturizable/closable style mask on
                // macOS. With `decorations: false`, Tauri creates the NSWindow
                // as borderless, which silently strips `NSResizableWindowMask`
                // and makes `startResizeDragging` / `startDragging` no-op even
                // though the JS calls succeed.
                window_style::apply_mac_style_mask(&capture_window)?;

                // Pin the native frosted-glass layer behind the card.
                if let Err(err) = vibrancy::apply_card_vibrancy(&capture_window) {
                    eprintln!("[papering] vibrancy failed: {err}");
                }

                // Make the WKWebView track the window size. Our native resize
                // drives the NSWindow via raw `setFrame:`, which tao never sees,
                // so without an autoresizing mask the webview frame (and its CSS
                // viewport) would freeze at the initial size on resize.
                if let Err(err) = window_style::apply_webview_autoresize(&capture_window) {
                    eprintln!("[papering] webview autoresize failed: {err}");
                }

                // Centre on the active screen at startup.
                let _ = capture_window.center();

                // In dev, surface the panel on launch so the visual is
                // verifiable without first triggering the global hotkey
                // (which can be silently blocked by macOS permissions).
                #[cfg(debug_assertions)]
                {
                    let _ = capture_window.show();
                    let _ = capture_window.set_focus();
                }
            }

            // 4. Register global hotkey (⌃⌥N → toggle capture).
            hotkey::register(app.handle().clone())?;

            // 5. Enable launch-at-login so the global hotkey works after a reboot
            // without the user having to open the app manually first.
            let autostart = app.autolaunch();
            if !autostart.is_enabled().unwrap_or(false) {
                let _ = autostart.enable();
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running papering");
}
