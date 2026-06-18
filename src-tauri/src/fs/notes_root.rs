use std::path::PathBuf;

use anyhow::{Context, Result};

pub const DEFAULT_CAPTURE_FOLDER: &str = "Inbox";
pub const ATTACHMENTS_FOLDER: &str = "attachments";

pub fn notes_root() -> Result<PathBuf> {
    let home = dirs::home_dir().context("could not resolve $HOME")?;
    Ok(home.join("Notes"))
}

pub fn capture_folder() -> Result<PathBuf> {
    Ok(notes_root()?.join(DEFAULT_CAPTURE_FOLDER))
}

/// `~/Notes/Inbox/attachments` — where pasted images are stored. Markdown
/// references them relative to the capture folder (`attachments/<file>`).
pub fn attachments_folder() -> Result<PathBuf> {
    Ok(capture_folder()?.join(ATTACHMENTS_FOLDER))
}

pub fn ensure_layout() -> Result<()> {
    let inbox = capture_folder()?;
    std::fs::create_dir_all(&inbox)
        .with_context(|| format!("creating {}", inbox.display()))?;
    Ok(())
}
