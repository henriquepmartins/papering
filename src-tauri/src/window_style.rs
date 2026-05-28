//! Force `NSResizableWindowMask` (and friends) onto the capture NSWindow.
//!
//! Tauri's `decorations: false` creates the window as `NSBorderlessWindowMask`,
//! which strips the resizable mask even when `resizable: true` is set in the
//! config. The result is that `startResizeDragging` / `startDragging` resolve
//! without error but the OS ignores them. Re-applying the mask here restores
//! programmatic resize and drag while keeping the chromeless look.

#[cfg(target_os = "macos")]
pub fn apply_mac_style_mask(window: &tauri::WebviewWindow) -> tauri::Result<()> {
    use cocoa::appkit::{NSWindow, NSWindowStyleMask};
    use cocoa::base::id;

    let ns_window = window.ns_window()? as id;
    unsafe {
        let current = ns_window.styleMask();
        let next = current
            | NSWindowStyleMask::NSResizableWindowMask
            | NSWindowStyleMask::NSMiniaturizableWindowMask
            | NSWindowStyleMask::NSClosableWindowMask
            | NSWindowStyleMask::NSFullSizeContentViewWindowMask;
        ns_window.setStyleMask_(next);
    }
    Ok(())
}

#[cfg(not(target_os = "macos"))]
pub fn apply_mac_style_mask(_window: &tauri::WebviewWindow) -> tauri::Result<()> {
    Ok(())
}
