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
            #[cfg(target_os = "macos")]
            {
                let _ = app.set_activation_policy(tauri::ActivationPolicy::Accessory);
            }

            fs::notes_root::ensure_layout()?;

            if let Err(err) = db::init() {
                eprintln!("[papering] sqlite init failed: {err:#}");
            }

            if let Some(capture_window) = app.get_webview_window("capture") {
                window_style::apply_mac_style_mask(&capture_window)?;

                if let Err(err) = vibrancy::apply_card_vibrancy(&capture_window) {
                    eprintln!("[papering] vibrancy failed: {err}");
                }

                if let Err(err) = window_style::apply_webview_autoresize(&capture_window) {
                    eprintln!("[papering] webview autoresize failed: {err}");
                }

                let _ = capture_window.center();

                #[cfg(debug_assertions)]
                {
                    let _ = capture_window.show();
                    let _ = capture_window.set_focus();
                }
            }

            hotkey::register(app.handle().clone())?;

            let autostart = app.autolaunch();
            if !autostart.is_enabled().unwrap_or(false) {
                let _ = autostart.enable();
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running papering");
}
