use anyhow::{anyhow, Context, Result};
use chrono::Local;
use serde::Serialize;

use crate::fs::notes_root::{attachments_folder, capture_folder};

#[derive(Debug, Serialize)]
pub struct SaveImageResult {
    pub relative: String,
    pub absolute: String,
}

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
pub async fn save_image(bytes: Vec<u8>, ext: String) -> Result<SaveImageResult, String> {
    save_image_inner(bytes, ext).map_err(|err| format!("{err:#}"))
}

#[tauri::command]
pub fn attachments_base() -> Result<String, String> {
    capture_folder()
        .map(|p| p.to_string_lossy().into_owned())
        .map_err(|err| format!("{err:#}"))
}
