(() => {
  'use strict';

  const VERSION = 'V266';
  const MOVEMENT_CODES = new Set([
    'KeyW', 'KeyA', 'KeyS', 'KeyD',
    'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
    'ShiftLeft', 'ShiftRight', 'KeyR', 'Space'
  ]);

  let scene = null;
  let camera = null;
  let jumpRequested = false;
  let jumpActive = false;
  let jumpStart = 0;
  let jumpBaseY = 0;
  const JUMP_DURATION_MS = 760;
  const JUMP_HEIGHT = 1.08;

  function elementFromTarget(target) {
    return target instanceof Element ? target : null;
  }

  function isTextEntryTarget(target) {
    const element = elementFromTarget(target);
    return Boolean(element?.closest('input, textarea, select, [contenteditable="true"], [contenteditable=""], [role="textbox"]'));
  }

  function isInteractiveTarget(target) {
    const element = elementFromTarget(target);
    return Boolean(element?.closest('button, a, summary, option, label, [role="button"], [role="link"]'));
  }

  function modalIsOpen() {
    return Boolean(document.querySelector('#ucanProfileModal.open, #boardPanel.open, #livePanelViewer.open'));
  }

  function releaseMovementKeys() {
    for (const code of MOVEMENT_CODES) {
      window.dispatchEvent(new KeyboardEvent('keyup', { code, key: code === 'Space' ? ' ' : '', bubbles: false }));
    }
  }

  function controlsAreBlocked(event) {
    return isTextEntryTarget(event.target) || isInteractiveTarget(event.target) || modalIsOpen();
  }

  document.addEventListener('keydown', event => {
    if (!MOVEMENT_CODES.has(event.code)) return;

    if (controlsAreBlocked(event)) {
      // Detiene el controlador global del campus, pero no cancela la escritura ni
      // el comportamiento normal de botones, campos, selectores o enlaces.
      event.stopPropagation();
      return;
    }

    if (event.code === 'Space') {
      event.preventDefault();
      event.stopPropagation();
      if (!event.repeat) jumpRequested = true;
    }
  }, false);

  document.addEventListener('keyup', event => {
    if (!MOVEMENT_CODES.has(event.code)) return;
    if (controlsAreBlocked(event) || event.code === 'Space') event.stopPropagation();
  }, false);

  document.addEventListener('focusin', event => {
    if (isTextEntryTarget(event.target) || isInteractiveTarget(event.target)) releaseMovementKeys();
  });

  document.addEventListener('pointerdown', event => {
    const canvas = event.target?.closest?.('#renderCanvas');
    if (canvas) {
      canvas.tabIndex = 0;
      canvas.focus({ preventScroll: true });
    }
  });

  window.addEventListener('blur', releaseMovementKeys);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) releaseMovementKeys();
  });

  function canJump() {
    if (!scene || !camera || modalIsOpen()) return false;
    if (window.__ucanV254IsRiding?.()) return false;
    return true;
  }

  function beginJump() {
    if (!canJump() || jumpActive) return;
    jumpActive = true;
    jumpRequested = false;
    jumpStart = performance.now();
    jumpBaseY = camera.position.y;
    window.__UCAN_API__?.setStatus?.('Salto activado. Use W, A, S y D para desplazarse.');
  }

  function updateJump() {
    if (jumpRequested && !jumpActive) beginJump();
    if (!jumpActive) return;

    if (!canJump()) {
      camera.position.y = jumpBaseY;
      jumpActive = false;
      jumpRequested = false;
      return;
    }

    const progress = (performance.now() - jumpStart) / JUMP_DURATION_MS;
    if (progress >= 1) {
      camera.position.y = jumpBaseY;
      jumpActive = false;
      return;
    }

    const normalized = Math.max(0, Math.min(1, progress));
    const offset = 4 * JUMP_HEIGHT * normalized * (1 - normalized);
    camera.position.y = jumpBaseY + offset;
  }

  function connectToScene() {
    scene = window.__UCAN_API__?.getScene?.() || null;
    camera = window.__UCAN_API__?.getCamera?.() || null;
    if (!scene || !camera) return false;

    scene.onBeforeRenderObservable.add(updateJump);
    const canvas = document.getElementById('renderCanvas');
    if (canvas) canvas.tabIndex = 0;

    const status = document.getElementById('status');
    if (status) status.textContent = 'Use W/A/S/D o las flechas para caminar, la barra espaciadora para saltar y R para reubicarse. Los controles se desactivan automáticamente mientras escribe.';

    window.__UCAN_KEYBOARD_JUMP_AUDIT__ = {
      version: VERSION,
      formTypingProtected: true,
      protectedKeys: [...MOVEMENT_CODES],
      jumpEnabled: true,
      jumpKey: 'Space',
      durationMs: JUMP_DURATION_MS,
      height: JUMP_HEIGHT,
      connected: true
    };
    console.info('[UCAN V266] Teclado y salto:', window.__UCAN_KEYBOARD_JUMP_AUDIT__);
    return true;
  }

  let attempts = 0;
  const timer = window.setInterval(() => {
    attempts += 1;
    if (connectToScene() || attempts >= 200) window.clearInterval(timer);
  }, 100);
})();
