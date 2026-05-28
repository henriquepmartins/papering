use std::path::{Path, PathBuf};

use anyhow::{anyhow, Context, Result};
use chrono::Local;

use super::notes_root::{capture_folder, notes_root};

pub struct PersistOutcome {
    pub path: PathBuf,
    pub created: bool,
}

/// Save `content` to the existing `path`, after verifying it lives inside the
/// notes root. Used when reopening a previously-saved note from the picker.
pub fn persist_to_path(path: &str, content: &str) -> Result<PersistOutcome> {
    let root = notes_root()?.canonicalize().context("canonicalize root")?;
    let target = Path::new(path);
    // Allow non-existent target (writing fresh) but verify the parent chain
    // resolves under the notes root.
    let parent = target.parent().ok_or_else(|| anyhow!("path has no parent"))?;
    let parent_canonical = parent.canonicalize().context("canonicalize parent")?;
    if !parent_canonical.starts_with(&root) {
        return Err(anyhow!("path outside notes root"));
    }
    let created = !target.exists();
    atomic_write(target, content)?;
    Ok(PersistOutcome {
        path: target.to_path_buf(),
        created,
    })
}

/// Save `content` to `<capture_folder>/<slug-from-first-line>.md`.
///
/// If the slug collides with an existing file written more than 60s ago, a
/// numeric suffix is appended. Otherwise the existing file is overwritten
/// (so successive saves of the same note land in the same file).
pub fn persist_note(content: &str) -> Result<PersistOutcome> {
    let folder = capture_folder()?;
    std::fs::create_dir_all(&folder).ok();

    let slug = slug_from_content(content);
    let mut target = folder.join(format!("{slug}.md"));
    let created = !target.exists();

    if !created {
        // Heuristic: if the existing file is "fresh" (modified in the last 60s),
        // treat this as the same note being saved again. Otherwise, suffix.
        if let Ok(meta) = std::fs::metadata(&target) {
            if let Ok(modified) = meta.modified() {
                if modified
                    .elapsed()
                    .map(|d| d.as_secs() > 60)
                    .unwrap_or(false)
                {
                    target = unique_suffix(&folder, &slug);
                }
            }
        }
    }

    atomic_write(&target, content)?;
    Ok(PersistOutcome {
        path: target,
        created,
    })
}

fn atomic_write(path: &std::path::Path, content: &str) -> Result<()> {
    let tmp = path.with_extension("md.tmp");
    std::fs::write(&tmp, content).with_context(|| format!("writing {}", tmp.display()))?;
    std::fs::rename(&tmp, path)
        .with_context(|| format!("rename {} -> {}", tmp.display(), path.display()))?;
    Ok(())
}

fn unique_suffix(folder: &std::path::Path, slug: &str) -> PathBuf {
    for n in 1..1000 {
        let candidate = folder.join(format!("{slug}-{n}.md"));
        if !candidate.exists() {
            return candidate;
        }
    }
    folder.join(format!("{slug}-{}.md", Local::now().format("%H%M%S")))
}

fn slug_from_content(content: &str) -> String {
    let first_line = content
        .lines()
        .map(str::trim)
        .find(|line| !line.is_empty())
        .unwrap_or("");

    let slug = slugify(first_line);
    if slug.is_empty() {
        format!("untitled-{}", Local::now().format("%Y-%m-%d-%H%M"))
    } else {
        // Cap length so paths stay sane.
        slug.chars().take(80).collect::<String>()
    }
}

fn slugify(raw: &str) -> String {
    let mut out = String::with_capacity(raw.len());
    let mut prev_dash = false;
    for ch in raw.chars() {
        let mapped = if ch.is_ascii_alphanumeric() {
            ch.to_ascii_lowercase()
        } else if ch.is_alphanumeric() {
            // keep non-ASCII letters (é, ç, ñ) but lowercase
            ch.to_lowercase().next().unwrap_or(ch)
        } else {
            '-'
        };
        if mapped == '-' {
            if prev_dash {
                continue;
            }
            prev_dash = true;
            out.push('-');
        } else {
            prev_dash = false;
            out.push(mapped);
        }
    }
    out.trim_matches('-').to_string()
}
