# Sphere star-map validation

## Rotation and auto-rotation

- Idle rotation: `120.51deg` → `124.03deg` (`+3.52deg`) during the measured idle interval.
- Immediately after drag: `{ x: 31.37, y: 198.33 }`.
- 700ms after release: `{ x: 31.37, y: 198.33 }` (`0deg` change, still paused).
- After the 1500ms resume delay: Y rotation resumed and increased by `2.12deg` in the next measured interval.
- Large vertical drag was clamped to exactly `rotationX = -65deg`.

## Zoom and labels

- Minimum scale: `0.72`; labels hidden; aura measured approximately `253 × 253px`.
- Maximum scale: `1.80`; labels visible; aura measured approximately `633 × 633px`.
- Label threshold in source: `1.22`.

## Depth

The same `Today I learned a small but useful phrase at the cafe.` star was measured before and after a half turn with the sphere tilt near zero:

| Position | Depth | Opacity | Element size |
| --- | ---: | ---: | ---: |
| Front | 0.911 | 0.916633 | 32.97px |
| Back | 0.041 | 0.0983581 | 12.11px |

Review brightness remains a separate `star-bright`, `star-medium`, or `star-dim` class and is multiplied visually with this node-level depth opacity and scale.

## Card anchoring

- At scale `1.80`, the selected star rect was approximately `84 × 84px`; the card remained inside the viewport and touched its right side.
- At scale `0.72`, rotation X `-65deg`, the selected star rect was approximately `33 × 33px`; the card again remained inside the viewport and next to the star.
- With the first card open, measured auto-rotation Y delta over 1050ms was exactly `0deg`.

## Mobile simulation

The mobile evidence uses a `390 × 844` browser viewport. A pointer drag through the same Pointer Events path changed rotation by `{ x: +20.4deg, y: +34.5deg }`; rotation stayed unchanged during the post-release pause. The browser test surface cannot emit two concurrent touch contacts, so pinch is represented by continuous zoom input in the mobile recording. The production code distinguishes one pointer (`rotate`) from two pointers (`pinch`) by `pointersRef.current.size`.
