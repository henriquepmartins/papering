//! Force `NSResizableWindowMask` (and friends) onto the capture NSWindow, and
//! implement interactive edge/corner resizing natively.
//!
//! Tauri's `decorations: false` creates the window as `NSBorderlessWindowMask`,
//! which strips the resizable mask even when `resizable: true` is set in the
//! config. Worse, tao (Tauri's windowing layer) hardcodes
//! `drag_resize_window` to `NotSupported` on macOS, so the JS
//! `startResizeDragging` API *always* rejects and can never resize the window.
//!
//! So we do two things:
//!   1. Re-apply the resizable/miniaturizable/closable style mask (keeps the
//!      window programmatically resizable and miniaturizable).
//!   2. Implement the resize gesture ourselves: when a grab handle fires
//!      `mousedown`, run an AppKit event-tracking loop on the main thread that
//!      reads `NSLeftMouseDragged` events and calls `setFrame:display:` until
//!      mouse-up — exactly how AppKit's own modal resize works, but anchored to
//!      the visible card edges and respecting the configured min size.

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

/// Begin an interactive resize from `direction` (one of North/South/East/West
/// and the four diagonals). Returns immediately; the drag runs on the main
/// thread until mouse-up.
#[cfg(target_os = "macos")]
pub fn start_resize(window: &tauri::WebviewWindow, direction: &str) -> tauri::Result<()> {
    use cocoa::base::{id, nil, YES};
    use cocoa::foundation::{NSPoint, NSRect, NSSize, NSString, NSUInteger};
    use objc::{class, msg_send, sel, sel_impl};

    // Raw AppKit pointers aren't `Send`; pass the address as a `usize` (which
    // is) and rebuild the pointer on the main thread.
    let ns_window_addr = window.ns_window()? as id as usize;
    let direction = direction.to_string();

    window.run_on_main_thread(move || unsafe {
        let ns_window = ns_window_addr as id;
        let dir = direction.as_str();

        let east = dir.contains("East");
        let west = dir.contains("West");
        let north = dir.contains("North");
        let south = dir.contains("South");

        let app: id = msg_send![class!(NSApplication), sharedApplication];

        // Screen coordinates: origin bottom-left, y increases upward — the same
        // space `NSWindow.frame` and `NSEvent.mouseLocation` both use.
        let start_mouse: NSPoint = msg_send![class!(NSEvent), mouseLocation];
        let start_frame: NSRect = msg_send![ns_window, frame];
        // tao applies the configured minWidth/minHeight via `setMinSize:`, so
        // read it back and clamp our programmatic `setFrame:` to it.
        let min_size: NSSize = msg_send![ns_window, minSize];

        // NSLeftMouseUp (1<<2) | NSLeftMouseDragged (1<<6).
        let mask: NSUInteger = (1 << 2) | (1 << 6);
        let distant_future: id = msg_send![class!(NSDate), distantFuture];
        let mode: id = NSString::alloc(nil).init_str("NSEventTrackingRunLoopMode");

        loop {
            let event: id = msg_send![app,
                nextEventMatchingMask: mask
                untilDate: distant_future
                inMode: mode
                dequeue: YES];
            if event == nil {
                continue;
            }
            let etype: NSUInteger = msg_send![event, type];
            // NSEventTypeLeftMouseUp == 2 → gesture finished.
            if etype == 2 {
                break;
            }

            let cur: NSPoint = msg_send![class!(NSEvent), mouseLocation];
            let dx = cur.x - start_mouse.x;
            let dy = cur.y - start_mouse.y;

            let mut x = start_frame.origin.x;
            let mut y = start_frame.origin.y;
            let mut w = start_frame.size.width;
            let mut h = start_frame.size.height;

            // Right edge follows the cursor; left edge moves the origin.
            if east {
                w = start_frame.size.width + dx;
            }
            if west {
                w = start_frame.size.width - dx;
                x = start_frame.origin.x + dx;
            }
            // Top edge grows height (origin pinned at bottom); bottom edge moves
            // the origin down and grows height (screen y is up).
            if north {
                h = start_frame.size.height + dy;
            }
            if south {
                h = start_frame.size.height - dy;
                y = start_frame.origin.y + dy;
            }

            // Clamp to the min size while keeping the anchored (opposite) edge
            // fixed, so dragging past the min doesn't drift the whole window.
            if min_size.width > 0.0 && w < min_size.width {
                if west {
                    x = start_frame.origin.x + start_frame.size.width - min_size.width;
                }
                w = min_size.width;
            }
            if min_size.height > 0.0 && h < min_size.height {
                if south {
                    y = start_frame.origin.y + start_frame.size.height - min_size.height;
                }
                h = min_size.height;
            }

            let frame = NSRect::new(NSPoint::new(x, y), NSSize::new(w, h));
            let _: () = msg_send![ns_window, setFrame: frame display: YES];
        }
    })?;

    Ok(())
}

#[cfg(not(target_os = "macos"))]
pub fn start_resize(_window: &tauri::WebviewWindow, _direction: &str) -> tauri::Result<()> {
    Ok(())
}
