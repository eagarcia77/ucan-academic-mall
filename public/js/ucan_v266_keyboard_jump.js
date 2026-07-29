(() => {
  'use strict';

  const VERSION = 'V311';
  const BUILD = 'V311-20260729-CANONICAL-ONE-SCENE-LOADER-R15';
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
    return Boolean(document.querySelector('#ucanProfileModal.open, #boardPanel.open, #livePanelViewer.open, #ucanVisualValidationV310.open, #ucanUnifiedWorldV311.open'));
  }

  function releaseMovementKeys() {
    for (const code of MOVEMENT_CODES) {
      window.dispatchEvent(new KeyboardEvent('keyup', { code, key: code === 'Space' ? ' ' : '', bubbles:false }));
    }
  }

  function controlsAreBlocked(event) {
    return isTextEntryTarget(event.target) || isInteractiveTarget(event.target) || modalIsOpen();
  }

  document.addEventListener('keydown', event => {
    if (!MOVEMENT_CODES.has(event.code)) return;
    if (controlsAreBlocked(event)) {
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
      canvas.focus({ preventScroll:true });
    }
  });

  window.addEventListener('blur', releaseMovementKeys);
  document.addEventListener('visibilitychange', () => { if (document.hidden) releaseMovementKeys(); });

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
    camera.position.y = jumpBaseY + 4 * JUMP_HEIGHT * normalized * (1 - normalized);
  }

  function connectToScene() {
    scene = window.__UCAN_API__?.getScene?.() || null;
    camera = window.__UCAN_API__?.getCamera?.() || null;
    if (!scene || !camera) return false;
    scene.onBeforeRenderObservable.add(updateJump);
    const canvas = document.getElementById('renderCanvas');
    if (canvas) canvas.tabIndex = 0;
    const status = document.getElementById('status');
    if (status) status.textContent = 'Browser y VR utilizan una sola escena. Use W/A/S/D o las flechas para caminar y la barra espaciadora para saltar.';
    window.__UCAN_KEYBOARD_JUMP_AUDIT__ = {
      version:VERSION,
      build:BUILD,
      formTypingProtected:true,
      protectedKeys:[...MOVEMENT_CODES],
      jumpEnabled:true,
      jumpKey:'Space',
      durationMs:JUMP_DURATION_MS,
      height:JUMP_HEIGHT,
      connected:true
    };
    return true;
  }

  function appendScript(src, marker, errorMessage) {
    if (document.querySelector(`script[${marker}="true"]`)) return null;
    const script = document.createElement('script');
    script.src = src;
    script.async = false;
    script.setAttribute(marker, 'true');
    script.addEventListener('error', () => console.error(errorMessage));
    document.head.appendChild(script);
    return script;
  }

  function chain(loader, next) {
    const runtime = loader();
    if (runtime) {
      runtime.addEventListener('load', next, { once:true });
      runtime.addEventListener('error', next, { once:true });
    } else next();
  }

  function loadUnifiedWorldV311() {
    const runtime = appendScript(
      '/js/ucan_v311_unified_world.js?build=V311-20260729-ONE-SCENE-ONE-WORLD-R15',
      'data-ucan-v311-unified-world',
      '[UCAN V311] No se pudo cargar el mundo unificado.'
    );
    window.__UCAN_CANONICAL_LOADER_V311__ = {
      version:VERSION,
      build:BUILD,
      installed:true,
      oneScene:true,
      oldQuestVisualLayersLoaded:false,
      oldPresenceV307Loaded:false,
      oldInteractionV308Loaded:false,
      unifiedWorldLoaded:Boolean(runtime || document.querySelector('script[data-ucan-v311-unified-world="true"]')),
      environmentSpecificGeometryDisabled:true,
      cameraAndControlsOnlyDifference:true
    };
  }

  function loadVoiceBridgeV306() {
    return appendScript(
      '/js/ucan_v306_voice_xr_bridge.js?build=V306-20260728-VOICE-XR-ROOM-BRIDGE',
      'data-ucan-v306-voice-xr-bridge',
      '[UCAN Voice V306] No se pudo cargar el audio compartido.'
    );
  }

  function loadStrictParityV309() {
    return appendScript(
      '/js/ucan_v309_strict_visual_parity.js?build=V309-20260728-STRICT-BROWSER-VR-VISUAL-PARITY-R13',
      'data-ucan-v309-strict-visual-parity',
      '[UCAN V309] No se pudo cargar la paridad visual estricta.'
    );
  }

  function loadFloor1BrandR10() {
    return appendScript(
      '/js/ucan_v306_floor1_brand_orientation_r10.js?build=V306-20260728-FLOOR1-BRAND-UPRIGHT-VR-R10',
      'data-ucan-v306-floor1-brand-r10',
      '[UCAN R10] No se pudo cargar la orientación canónica de anuncios.'
    );
  }

  function loadExternalPatioV305() {
    return appendScript(
      '/js/ucan_v305_external_tropical_patio_fix.js?build=V305-20260728-EXTERNAL-TROPICAL-PATIO-PERIMETER-R1',
      'data-ucan-v305-external-tropical-patio',
      '[UCAN V305] No se pudo cargar el patio exterior canónico.'
    );
  }

  function loadCanonicalRuntime() {
    chain(loadExternalPatioV305, () =>
      chain(loadFloor1BrandR10, () =>
        chain(loadStrictParityV309, () =>
          chain(loadVoiceBridgeV306, loadUnifiedWorldV311)
        )
      )
    );
  }

  let attempts = 0;
  const timer = window.setInterval(() => {
    attempts += 1;
    if (connectToScene() || attempts >= 300) window.clearInterval(timer);
  }, 100);

  loadCanonicalRuntime();
})();
