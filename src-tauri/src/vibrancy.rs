//! Pin a real, always-active NSVisualEffectView behind the capture card so the
//! frosted glass never fades.
//!
//! Why not CSS `backdrop-filter`? WebKit weakens (fades toward zero) any
//! `backdrop-filter` whenever its window isn't the key/active window — so the
//! panel kept losing its matte-glass look on focus loss, and JS focus-tracking
//! to compensate was racy. A native NSVisualEffectView with `state = .active`
//! is focus-independent: the blur is constant.
//!
//! The effect view is inset to match the card's *fixed* padding (see
//! `.capture-window` in `app/globals.css`: padding 50px 20px 10px) and rounded
//! to the card radius (14px). This keeps the surrounding transparent padding —
//! where tooltips render over the desktop — clear, and preserves the floating
//! rounded-card look. The webview is transparent (`transparent: true` +
//! `macOSPrivateApi: true`), so the card's translucent tint composites over this
//! native blur.

#[cfg(target_os = "macos")]
pub fn apply_card_vibrancy(window: &tauri::WebviewWindow) -> tauri::Result<()> {
    use cocoa::base::{id, nil, YES};
    use cocoa::foundation::{NSPoint, NSRect, NSSize};
    use objc::{class, msg_send, sel, sel_impl};

    // Card insets in points, matching `.capture-window` padding (top/right/
    // bottom/left = 50/20/10/20) and `--radius-panel` (14px).
    const PAD_TOP: f64 = 50.0;
    const PAD_LEFT: f64 = 20.0;
    const PAD_RIGHT: f64 = 20.0;
    const PAD_BOTTOM: f64 = 10.0;
    const CARD_RADIUS: f64 = 14.0;

    // NSVisualEffectMaterial.sidebar (light, slightly cool — Spotlight/Raycast).
    const MATERIAL_SIDEBAR: i64 = 7;
    // NSVisualEffectBlendingMode.behindWindow.
    const BLENDING_BEHIND_WINDOW: i64 = 0;
    // NSVisualEffectState.active — never follow the window's active state.
    const STATE_ACTIVE: i64 = 1;
    // NSViewWidthSizable (1<<1) | NSViewHeightSizable (1<<4): the view grows with
    // the content view while its (fixed) margins stay constant on resize.
    const AUTORESIZE_WIDTH_HEIGHT: u64 = (1 << 1) | (1 << 4);
    // NSWindowOrderingMode.below — insert behind the (transparent) webview.
    const ORDER_BELOW: i64 = -1;

    let ns_window = window.ns_window()? as id;
    unsafe {
        let content_view: id = msg_send![ns_window, contentView];
        let bounds: NSRect = msg_send![content_view, bounds];

        // AppKit origin is bottom-left: x = left pad, y = bottom pad.
        let frame = NSRect::new(
            NSPoint::new(PAD_LEFT, PAD_BOTTOM),
            NSSize::new(
                (bounds.size.width - PAD_LEFT - PAD_RIGHT).max(0.0),
                (bounds.size.height - PAD_TOP - PAD_BOTTOM).max(0.0),
            ),
        );

        let effect: id = msg_send![class!(NSVisualEffectView), alloc];
        let effect: id = msg_send![effect, initWithFrame: frame];
        let _: () = msg_send![effect, setMaterial: MATERIAL_SIDEBAR];
        let _: () = msg_send![effect, setBlendingMode: BLENDING_BEHIND_WINDOW];
        let _: () = msg_send![effect, setState: STATE_ACTIVE];
        let _: () = msg_send![effect, setAutoresizingMask: AUTORESIZE_WIDTH_HEIGHT];

        // Round corners to match the card so the native rect doesn't poke out
        // through the card's rounded corners.
        let _: () = msg_send![effect, setWantsLayer: YES];
        let layer: id = msg_send![effect, layer];
        let _: () = msg_send![layer, setCornerRadius: CARD_RADIUS];
        let _: () = msg_send![layer, setMasksToBounds: YES];

        let _: () =
            msg_send![content_view, addSubview: effect positioned: ORDER_BELOW relativeTo: nil];
    }
    Ok(())
}

#[cfg(not(target_os = "macos"))]
pub fn apply_card_vibrancy(_window: &tauri::WebviewWindow) -> tauri::Result<()> {
    Ok(())
}
