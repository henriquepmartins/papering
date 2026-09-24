#[cfg(target_os = "macos")]
pub fn apply_card_vibrancy(window: &tauri::WebviewWindow) -> tauri::Result<()> {
    use cocoa::base::{id, nil, YES};
    use cocoa::foundation::{NSPoint, NSRect, NSSize, NSString};
    use objc::{class, msg_send, sel, sel_impl};

    const PAD_TOP: f64 = 50.0;
    const PAD_LEFT: f64 = 20.0;
    const PAD_RIGHT: f64 = 20.0;
    const PAD_BOTTOM: f64 = 10.0;
    const CARD_RADIUS: f64 = 14.0;

    const MATERIAL_POPOVER: i64 = 6;
    const BLENDING_BEHIND_WINDOW: i64 = 0;
    const STATE_ACTIVE: i64 = 1;
    const AUTORESIZE_WIDTH_HEIGHT: u64 = (1 << 1) | (1 << 4);
    const ORDER_BELOW: i64 = -1;

    let ns_window = window.ns_window()? as id;
    unsafe {
        let content_view: id = msg_send![ns_window, contentView];
        let bounds: NSRect = msg_send![content_view, bounds];

        let frame = NSRect::new(
            NSPoint::new(PAD_LEFT, PAD_BOTTOM),
            NSSize::new(
                (bounds.size.width - PAD_LEFT - PAD_RIGHT).max(0.0),
                (bounds.size.height - PAD_TOP - PAD_BOTTOM).max(0.0),
            ),
        );

        let effect: id = msg_send![class!(NSVisualEffectView), alloc];
        let effect: id = msg_send![effect, initWithFrame: frame];
        let _: () = msg_send![effect, setMaterial: MATERIAL_POPOVER];
        let _: () = msg_send![effect, setBlendingMode: BLENDING_BEHIND_WINDOW];
        let _: () = msg_send![effect, setState: STATE_ACTIVE];
        let _: () = msg_send![effect, setAutoresizingMask: AUTORESIZE_WIDTH_HEIGHT];
        let aqua_name: id = NSString::alloc(nil).init_str("NSAppearanceNameAqua");
        let aqua: id = msg_send![class!(NSAppearance), appearanceNamed: aqua_name];
        let _: () = msg_send![effect, setAppearance: aqua];

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
