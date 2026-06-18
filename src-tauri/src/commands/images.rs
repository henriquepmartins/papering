use anyhow::{anyhow, Context, Result};
use chrono::Local;
use serde::Serialize;

use crate::fs::notes_root::{attachments_folder, capture_folder};

#[derive(Debug, Serialize)]
pub struct SaveImageResult {
    /// Path relative to the capture folder, e.g. `attachments/img-….png`.
    /// This is what gets written into the note's markdown.
    pub relative: String,
    /// Absolute on-disk path, used by the frontend to build an `asset:` URL.
    pub absolute: String,
}

/// Sanitise a clipboard MIME-derived extension against an allowlist. Anything
/// unexpected falls back to `png` so we never write an arbitrary extension.
fn sanitize_ext(ext: &str) -> &'static str {
    match ext.trim().trim_start_matches('.').to_ascii_lowercase().as_str() {
        "png" => "png",
        "jpg" | "jpeg" => "jpg",
        "gif" => "gif",
        "webp" => "webp",
        _ => "png",
    }
}

fn save_image_inner(bytes: Vec<u8>, ext: String) -> Result<SaveImageResult> {
    if bytes.is_empty() {
        return Err(anyhow!("empty image data"));
    }
    let ext = sanitize_ext(&ext);
    let folder = attachments_folder()?;
    std::fs::create_dir_all(&folder)
        .with_context(|| format!("creating {}", folder.display()))?;

    // Microsecond timestamp keeps successive pastes unique without a counter.
    let name = format!("img-{}.{ext}", Local::now().format("%Y%m%d-%H%M%S-%6f"));
    let target = folder.join(&name);

    std::fs::write(&target, &bytes)
        .with_context(|| format!("writing {}", target.display()))?;

    Ok(SaveImageResult {
        relative: format!(
            "{}/{name}",
            crate::fs::notes_root::ATTACHMENTS_FOLDER
        ),
        absolute: target.to_string_lossy().into_owned(),
    })
}

#[tauri::command]
pub fn save_image(bytes: Vec<u8>, ext: String) -> Result<SaveImageResult, String> {
    save_image_inner(bytes, ext).map_err(|err| format!("{err:#}"))
}

/// Absolute path of the capture folder (`~/Notes/Inbox`). The frontend joins
/// this with relative `attachments/…` paths to resolve images for display.
#[tauri::command]
pub fn attachments_base() -> Result<String, String> {
    capture_folder()
        .map(|p| p.to_string_lossy().into_owned())
        .map_err(|err| format!("{err:#}"))
}
