import { isTauri } from "./ipc";

// Checks the GitHub release endpoint (see tauri.conf.json `plugins.updater`)
// for a newer version. If one is available it is downloaded, installed in
// place, and the app relaunches. No-op outside the Tauri runtime (e.g. plain
// `next dev`), and failures are swallowed so a flaky network never blocks the
// capture window from opening.
export async function checkForUpdates(): Promise<void> {
  if (!isTauri()) return;

  try {
    const { check } = await import("@tauri-apps/plugin-updater");
    const update = await check();
    if (!update) return;

    await update.downloadAndInstall();

    const { relaunch } = await import("@tauri-apps/plugin-process");
    await relaunch();
  } catch (err) {
    console.error("[updater] check failed", err);
  }
}
