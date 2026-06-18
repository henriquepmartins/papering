import { invoke } from "@tauri-apps/api/core";

export type SaveNoteResult = { path: string; created: boolean };
export type NoteMeta = { path: string; title: string; updated_at: number };
export type SaveImageResult = { relative: string; absolute: string };

export function isTauri(): boolean {
  return (
    typeof window !== "undefined" &&
    "__TAURI_INTERNALS__" in (window as unknown as Record<string, unknown>)
  );
}

export function saveNote(content: string, path?: string | null): Promise<SaveNoteResult> {
  if (!isTauri()) {
    return Promise.resolve({ path: path ?? "/dev/null", created: false });
  }
  return invoke<SaveNoteResult>("save_note", { content, path: path ?? null });
}

export function listNotes(): Promise<NoteMeta[]> {
  if (!isTauri()) return Promise.resolve([]);
  return invoke<NoteMeta[]>("list_notes");
}

export function loadNote(path: string): Promise<string> {
  if (!isTauri()) return Promise.resolve("");
  return invoke<string>("load_note", { path });
}

export function deleteNote(path: string): Promise<void> {
  if (!isTauri()) return Promise.resolve();
  return invoke<void>("delete_note", { path });
}

export function saveImage(bytes: Uint8Array, ext: string): Promise<SaveImageResult> {
  if (!isTauri()) {
    return Promise.resolve({ relative: "", absolute: "" });
  }
  return invoke<SaveImageResult>("save_image", { bytes: Array.from(bytes), ext });
}

export function attachmentsBase(): Promise<string> {
  if (!isTauri()) return Promise.resolve("");
  return invoke<string>("attachments_base");
}

export function hideCapture(): Promise<void> {
  if (!isTauri()) return Promise.resolve();
  return invoke<void>("hide_capture");
}

export function captureReady(): Promise<void> {
  if (!isTauri()) return Promise.resolve();
  return invoke<void>("capture_ready");
}
