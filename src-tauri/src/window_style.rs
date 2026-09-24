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

#[cfg(target_os = "macos")]
pub fn apply_webview_autoresize(window: &tauri::WebviewWindow) -> tauri::Result<()> {
    use cocoa::base::{id, nil};
    use cocoa::foundation::NSRect;
    use objc::{msg_send, sel, sel_impl};

    const AUTORESIZE_WIDTH_HEIGHT: u64 = (1 << 1) | (1 << 4);

    window.with_webview(|webview| unsafe {
        let wk = webview.inner() as id;
        let superview: id = msg_send![wk, superview];
        if superview != nil {
            let bounds: NSRect = msg_send![superview, bounds];
            let _: () = msg_send![wk, setFrame: bounds];
        }
        let _: () = msg_send![wk, setAutoresizingMask: AUTORESIZE_WIDTH_HEIGHT];
    })?;
    Ok(())
}

#[cfg(not(target_os = "macos"))]
pub fn apply_webview_autoresize(_window: &tauri::WebviewWindow) -> tauri::Result<()> {
    Ok(())
}

#[cfg(target_os = "macos")]
pub fn start_resize(window: &tauri::WebviewWindow, direction: &str) -> tauri::Result<()> {
    use cocoa::base::{id, nil, YES};
    use cocoa::foundation::{NSPoint, NSRect, NSSize, NSString, NSUInteger};
    use objc::{class, msg_send, sel, sel_impl};

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

        let start_mouse: NSPoint = msg_send![class!(NSEvent), mouseLocation];
        let start_frame: NSRect = msg_send![ns_window, frame];
        let min_size: NSSize = msg_send![ns_window, minSize];

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

            if east {
                w = start_frame.size.width + dx;
            }
            if west {
                w = start_frame.size.width - dx;
                x = start_frame.origin.x + dx;
            }
            if north {
                h = start_frame.size.height + dy;
            }
            if south {
                h = start_frame.size.height - dy;
                y = start_frame.origin.y + dy;
            }

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
