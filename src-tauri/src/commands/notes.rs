use std::path::Path;

use serde::Serialize;

use crate::fs::notes_root;
use crate::fs::save::{persist_note, persist_to_path, PersistOutcome};

#[derive(Debug, Serialize)]
pub struct SaveNoteResult {
    pub path: String,
    pub created: bool,
}

#[derive(Debug, Serialize)]
pub struct NoteMeta {
    pub path: String,
    pub title: String,
    pub updated_at: i64,
}

#[tauri::command]
pub fn save_note(content: String, path: Option<String>) -> Result<SaveNoteResult, String> {
    let outcome = match path {
        Some(p) => persist_to_path(&p, &content).map_err(|err| format!("{err:#}"))?,
        None => persist_note(&content).map_err(|err| format!("{err:#}"))?,
    };
    let PersistOutcome { path, created } = outcome;
    Ok(SaveNoteResult {
        path: path.to_string_lossy().to_string(),
        created,
    })
}

#[tauri::command]
pub fn list_notes() -> Result<Vec<NoteMeta>, String> {
    let folder = notes_root::capture_folder().map_err(|e| e.to_string())?;
    let mut out = Vec::new();
    let read = match std::fs::read_dir(&folder) {
        Ok(r) => r,
        Err(_) => return Ok(out),
    };
    for entry in read {
        let entry = match entry {
            Ok(e) => e,
            Err(_) => continue,
        };
        let path = entry.path();
        if path.extension().and_then(|s| s.to_str()) != Some("md") {
            continue;
        }
        let meta = match entry.metadata() {
            Ok(m) => m,
            Err(_) => continue,
        };
        let mtime = meta
            .modified()
            .ok()
            .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
            .map(|d| d.as_secs() as i64)
            .unwrap_or(0);
        let content = std::fs::read_to_string(&path).unwrap_or_default();
        let title = derive_title(&content);
        out.push(NoteMeta {
            path: path.to_string_lossy().into_owned(),
            title,
            updated_at: mtime,
        });
    }
    out.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));
    out.truncate(20);
    Ok(out)
}

#[tauri::command]
pub fn load_note(path: String) -> Result<String, String> {
    let root = notes_root::notes_root().map_err(|e| e.to_string())?;
    let p = Path::new(&path);
    let canonical = p
        .canonicalize()
        .map_err(|e| format!("canonicalize: {e}"))?;
    let root_canonical = root.canonicalize().map_err(|e| format!("canonicalize: {e}"))?;
    if !canonical.starts_with(&root_canonical) {
        return Err("path outside notes root".into());
    }
    std::fs::read_to_string(&canonical).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_note(path: String) -> Result<(), String> {
    let root = notes_root::notes_root().map_err(|e| e.to_string())?;
    let p = Path::new(&path);
    let canonical = p
        .canonicalize()
        .map_err(|e| format!("canonicalize: {e}"))?;
    let root_canonical = root.canonicalize().map_err(|e| format!("canonicalize: {e}"))?;
    if !canonical.starts_with(&root_canonical) {
        return Err("path outside notes root".into());
    }
    std::fs::remove_file(&canonical).map_err(|e| e.to_string())
}

/// Remove inline image markdown (`![alt](src)`) so a note that opens with a
/// pasted image still derives a sensible title from the following text.
fn strip_image_markdown(line: &str) -> String {
    let mut out = String::with_capacity(line.len());
    let mut rest = line;
    while let Some(start) = rest.find("![") {
        out.push_str(&rest[..start]);
        let after = &rest[start + 2..];
        // Expect `]( … )` to close the image; otherwise keep the text as-is.
        if let Some(close_alt) = after.find("](") {
            let after_paren = &after[close_alt + 2..];
            if let Some(close_paren) = after_paren.find(')') {
                rest = &after_paren[close_paren + 1..];
                continue;
            }
        }
        out.push_str("![");
        rest = after;
    }
    out.push_str(rest);
    out
}

fn derive_title(content: &str) -> String {
    for raw in content.lines() {
        let line = strip_image_markdown(raw.trim());
        let line = line.trim();
        if line.is_empty() {
            continue;
        }
        if let Some(stripped) = line
            .strip_prefix("### ")
            .or_else(|| line.strip_prefix("## "))
            .or_else(|| line.strip_prefix("# "))
        {
            return stripped.trim().to_string();
        }
        return line.chars().take(80).collect();
    }
    "Untitled".to_string()
}
