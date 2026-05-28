use std::path::PathBuf;

use anyhow::{Context, Result};
use rusqlite::Connection;

use crate::fs::notes_root::notes_root;

const SCHEMA: &str = include_str!("schema.sql");

fn db_path() -> Result<PathBuf> {
    let root = notes_root()?.join(".index");
    std::fs::create_dir_all(&root)
        .with_context(|| format!("creating {}", root.display()))?;
    Ok(root.join("notes.sqlite"))
}

pub fn open() -> Result<Connection> {
    let path = db_path()?;
    let conn = Connection::open(&path)
        .with_context(|| format!("opening sqlite at {}", path.display()))?;
    conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL;")?;
    Ok(conn)
}

/// Run schema migrations. Idempotent — safe to call on every boot.
pub fn init() -> Result<()> {
    let conn = open()?;
    conn.execute_batch(SCHEMA)?;
    Ok(())
}
