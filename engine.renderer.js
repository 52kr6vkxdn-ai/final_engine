/* ============================================================
   Zengine — engine.renderer.js
   Scene graph, grid, camera bounds, gizmo size ticker.
   ============================================================ */

import { state, PIXELS_PER_UNIT } from './engine.state.js';

export function initScene() {
    const { app } = state;

    // ── GPU / Quality settings ────────────────────────────
    PIXI.settings.SCALE_MODE          = PIXI.SCALE_MODES.LINEAR;
    PIXI.settings.RESOLUTION          = window.devicePixelRatio || 1;
    PIXI.settings.SPRITE_MAX_TEXTURES = 32;
    // Mipmaps so distant/small sprites are GPU-filtered not CPU-sampled
    PIXI.settings.MIPMAP_TEXTURES     = PIXI.MIPMAP_MODES.ON;

    // ── Scene hierarchy ───────────────────────────────────
    state.gridLayer = new PIXI.Graphics();
    state.gridLayer.name = '__grid__';
    app.stage.addChild(state.gridLayer);

    state.sceneContainer = new PIXI.Container();
    // sortableChildren lets PIXI batch children by z-order on the GPU
    state.sceneContainer.sortableChildren = true;
    app.stage.addChild(state.sceneContainer);
    state.sceneContainer.position.set(
        app.screen.width  / 2,
        app.screen.height / 2
    );

    state.cameraBounds = new PIXI.Graphics();
    app.stage.addChild(state.cameraBounds);

    app.ticker.add(_syncGridTransform);
    // Frustum culling: mark off-screen objects as non-renderable each frame
    // so the GPU never processes their draw calls.
    app.ticker.add(_cullOffscreenObjects);

    drawGrid();
}

// ── Per-frame frustum culling ─────────────────────────────────
// Objects fully outside the visible viewport are set renderable=false.
// PIXI skips non-renderable objects entirely — zero GPU cost for off-screen objects.
function _cullOffscreenObjects() {
    const sc = state.sceneContainer;
    // Only cull during active play — editor needs all objects visible at all times
    if (!sc || !state.isPlaying) return;
    const sw = state.app.screen.width;
    const sh = state.app.screen.height;
    const MARGIN = 160; // px — buffer prevents visible pop-in at screen edge
    const scaleX = Math.abs(sc.scale.x);
    const scaleY = Math.abs(sc.scale.y);
    for (const obj of state.gameObjects) {
        if (!obj.isImage && !obj.isText) continue;
        // Objects with active physics bodies must always be rendered=true so their
        // gizmos and debug overlays work correctly; the GPU skips invisible sprites anyway.
        if (obj.physicsBody && obj.physicsBody !== 'none') {
            obj.renderable = obj.visible !== false;
            continue;
        }
        const pos = obj.position ?? { x: obj.x ?? 0, y: obj.y ?? 0 };
        const gp  = sc.toGlobal(pos);
        const hw  = ((obj.width  ?? 64) * scaleX) * 0.5 + MARGIN;
        const hh  = ((obj.height ?? 64) * scaleY) * 0.5 + MARGIN;
        obj.renderable = (
            obj.visible !== false &&
            gp.x + hw >= 0 && gp.x - hw <= sw &&
            gp.y + hh >= 0 && gp.y - hh <= sh
        );
    }
}

/** Re-enable renderable on all objects when leaving play mode. */
export function resetCulling() {
    for (const obj of state.gameObjects) {
        if (obj.renderable === false) obj.renderable = true;
    }
}

function _syncGridTransform() {
    if (!state.gridLayer || !state.sceneContainer) return;
    state.gridLayer.position.copyFrom(state.sceneContainer.position);
    state.gridLayer.scale.copyFrom(state.sceneContainer.scale);
    state.gridLayer.visible = state.showGrid && !state.isPlaying;
}

/** Toggle the editor grid on/off */
export function setGridVisible(visible) {
    state.showGrid = visible;
    if (state.gridLayer) state.gridLayer.visible = visible && !state.isPlaying;
    // Update toolbar badge
    const badge = document.getElementById('grid-toggle-badge');
    if (badge) badge.style.display = visible ? 'block' : 'none';
    const btn = document.getElementById('btn-grid-toggle');
    if (btn) btn.style.color = visible ? '#6adf88' : '#555';
}

export function drawGrid() {
    const { gridLayer } = state;
    if (!gridLayer) return;
    gridLayer.clear();

    // ── Subtle grid ──
    gridLayer.lineStyle(1, 0x2a2a2a, 1);
    const size = 8000, step = 25;
    for (let i = -size; i <= size; i += step) {
        gridLayer.moveTo(i, -size); gridLayer.lineTo(i,  size);
        gridLayer.moveTo(-size, i); gridLayer.lineTo(size, i);
    }
    // Major grid lines every 100 units
    gridLayer.lineStyle(1, 0x3a3a3a, 1);
    for (let i = -size; i <= size; i += 100) {
        gridLayer.moveTo(i, -size); gridLayer.lineTo(i,  size);
        gridLayer.moveTo(-size, i); gridLayer.lineTo(size, i);
    }
    // Origin axes
    gridLayer.lineStyle(2, 0x444455, 1);
    gridLayer.moveTo(0, -size); gridLayer.lineTo(0,  size);
    gridLayer.moveTo(-size, 0); gridLayer.lineTo(size, 0);

    // Store ref and sync visibility
    state.gridGraphics = gridLayer;
    gridLayer.visible  = state.showGrid && !state.isPlaying;

    // Redraw HTML camera bounds overlay
    import('./engine.playmode.js').then(m => m.drawCameraBounds());
}

export function startGizmoSizeTicker() {
    state.app.ticker.add(() => {
        const camScale = state.sceneContainer.scale.x;
        for (const obj of state.gameObjects) {
            const gc = obj._gizmoContainer;
            if (!gc) continue;
            // Lights and tilemaps: constant screen-size gizmo
            if (obj.isLight || obj.isTilemap) {
                gc.scale.set(1 / camScale, 1 / camScale);
            } else {
                gc.scale.set(
                    1 / (camScale * obj.scale.x),
                    1 / (camScale * obj.scale.y)
                );
            }
        }
    });
}
