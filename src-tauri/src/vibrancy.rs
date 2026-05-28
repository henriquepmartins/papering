//! Attach a real NSVisualEffectView behind the capture webview so the panel
//! gets light/translucent vibrancy instead of relying on CSS `backdrop-filter`.

#![cfg(target_os = "macos")]

use anyhow::{anyhow, Result};
use tauri::WebviewWindow;
use window_vibrancy::{apply_vibrancy, NSVisualEffectMaterial, NSVisualEffectState};

pub fn apply_hud(window: &WebviewWindow) -> Result<()> {
    // Sidebar material gives the light, slightly cool vibrancy seen in Raycast
    // Notes / Spotlight. Do NOT force dark appearance — we want a light panel.
    apply_vibrancy(
        window,
        NSVisualEffectMaterial::Sidebar,
        Some(NSVisualEffectState::Active),
        Some(14.0),
    )
    .map_err(|e| anyhow!("apply_vibrancy failed: {e:?}"))
}
