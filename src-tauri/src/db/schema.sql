-- Papering — SQLite schema.
-- Slice 1: schema is created but not actively queried (notes are still file-only).
-- Slices 2+ populate and query these tables.

CREATE TABLE IF NOT EXISTS notes (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    path        TEXT NOT NULL UNIQUE,
    folder      TEXT NOT NULL,
    title       TEXT NOT NULL DEFAULT '',
    created_at  INTEGER NOT NULL,
    updated_at  INTEGER NOT NULL,
    pinned      INTEGER NOT NULL DEFAULT 0,
    body_size   INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS notes_folder_idx ON notes(folder);
CREATE INDEX IF NOT EXISTS notes_updated_idx ON notes(updated_at DESC);

CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts USING fts5(
    title,
    body,
    content='notes',
    content_rowid='id',
    tokenize='unicode61 remove_diacritics 2'
);

CREATE TABLE IF NOT EXISTS folders (
    name                TEXT PRIMARY KEY,
    accent_hex          TEXT,
    sort_order          INTEGER NOT NULL DEFAULT 0,
    default_for_capture INTEGER NOT NULL DEFAULT 0
);

INSERT OR IGNORE INTO folders(name, sort_order, default_for_capture)
VALUES ('Inbox', 0, 1);

CREATE TABLE IF NOT EXISTS app_state (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
