import { isTauri } from "./ipc";

const RELEASE_TOPIC_URL = "https://ntfy.sh/papering-release-1134eb869c079610/sse";

const RECONNECT_MS = 60 * 1000;

let installed = false;

async function relaunchWhenHidden(): Promise<void> {
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  const { relaunch } = await import("@tauri-apps/plugin-process");
  const win = getCurrentWindow();
  if (!(await win.isVisible())) {
    await relaunch();
    return;
  }
  const unlisten = await win.onFocusChanged(async ({ payload: focused }) => {
    if (focused) return;
    await new Promise((resolve) => setTimeout(resolve, 300));
    if (await win.isVisible()) return;
    unlisten();
    await relaunch();
  });
}

async function checkOnce(): Promise<void> {
  if (installed) return;
  try {
    const { check } = await import("@tauri-apps/plugin-updater");
    const update = await check();
    if (!update) return;
    await update.downloadAndInstall();
    installed = true;
    await relaunchWhenHidden();
  } catch (err) {
    console.error("[updater] check failed", err);
  }
}

export function startAutoUpdate(): () => void {
  if (!isTauri() || process.env.NODE_ENV === "development") return () => {};

  let source: EventSource | null = null;
  let retry: ReturnType<typeof setTimeout> | null = null;

  const connect = () => {
    source = new EventSource(RELEASE_TOPIC_URL);
    source.onopen = () => void checkOnce();
    source.onmessage = () => void checkOnce();
    source.onerror = () => {
      if (source?.readyState !== EventSource.CLOSED) return;
      retry = setTimeout(connect, RECONNECT_MS);
    };
  };

  connect();
  return () => {
    if (retry) clearTimeout(retry);
    source?.close();
  };
}
