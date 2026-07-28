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

  function loadVoiceBridgeV306() {
    const src = '/js/ucan_v306_voice_xr_bridge.js?build=V306-20260728-VOICE-XR-ROOM-BRIDGE';
    appendScript(src, 'data-ucan-v306-voice-xr-bridge', '[UCAN Voice V306] No se pudo cargar el puente de audio para Meta Quest.');
  }

  function loadFloor1TerraceR9() {
    const src = '/js/ucan_v305_floor1_terrace_vr_r9.js?build=V305-20260728-FLOOR1-ADS-TERRACE-XR-R9';
    const runtime = appendScript(src, 'data-ucan-v305-floor1-terrace-r9', '[UCAN V305 R9] No se pudo cargar la corrección real de anuncios y joystick XR.');
    if (runtime) {
      runtime.addEventListener('load', loadVoiceBridgeV306, { once:true });
      runtime.addEventListener('error', loadVoiceBridgeV306, { once:true });
    } else loadVoiceBridgeV306();
  }

  function loadVrSignsR7() {
    const src = '/js/ucan_v305_vr_signs_interaction_r7.js?build=V305-20260728-VR-UPRIGHT-SIGNS-INTERACTION-R7';
    const runtime = appendScript(src, 'data-ucan-v305-vr-signs-r7', '[UCAN V305 R7] No se pudo cargar la corrección final de carteles e interacción VR.');
    if (runtime) runtime.addEventListener('load', loadFloor1TerraceR9);
    else loadFloor1TerraceR9();
  }

  function loadExternalPatioV305() {
    const src = '/js/ucan_v305_external_tropical_patio_fix.js?build=V305-20260728-EXTERNAL-TROPICAL-PATIO-PERIMETER-R1';
    const runtime = appendScript(src, 'data-ucan-v305-external-tropical-patio', '[UCAN V305] No se pudo cargar la reubicación exterior del patio tropical.');
    if (runtime) runtime.addEventListener('load', loadVrSignsR7);
    else loadVrSignsR7();
  }

  function loadR6Guard() {
    const src = '/js/ucan_v304_r6_legacy_sign_guard.js?build=V304-20260728-R6-LEGACY-SIGN-GUARD';
    const runtime = appendScript(src, 'data-ucan-v304-r6-sign-guard', '[UCAN V304 R6] No se pudo cargar la protección contra carteles antiguos.');
    if (runtime) runtime.addEventListener('load', loadExternalPatioV305);
    else loadExternalPatioV305();
  }

  function loadInteractionR6() {
    const src = '/js/ucan_v304_signs_terrace_interaction_r6.js?build=V304-20260728-UPRIGHT-SIGNS-TERRACE-XR-INTERACTION-R6';
    const runtime = appendScript(src, 'data-ucan-v304-interaction-r6', '[UCAN V304 R6] No se pudo cargar la corrección de carteles e interacción de terraza.');
    if (runtime) runtime.addEventListener('load', loadR6Guard);
    else loadR6Guard();
  }

  function loadGlobalVisualR5() {
    const src = '/js/ucan_v304_global_glass_signs_r5.js?build=V304-20260725-GLOBAL-GLASS-UPRIGHT-SIGNS-R5';
    const runtime = appendScript(src, 'data-ucan-v304-global-r5', '[UCAN V304 R5] No se pudo cargar la corrección global de cristales y carteles.');
    if (runtime) runtime.addEventListener('load', loadInteractionR6);
    else loadInteractionR6();
  }

  function loadQuestVisualR4() {
    const runtimeSrc = '/js/ucan_v304_quest_glass_rails_holiday_r4.js?build=V304-20260725-QUEST-GLASS-RAILS-HOLIDAY-R4';
    const protectionSrc = '/js/ucan_v304_r4_geometry_protection.js?build=V304-20260725-R4-GEOMETRY-PROTECTION';
    const runtime = appendScript(runtimeSrc, 'data-ucan-v304-quest-r4', '[UCAN V304 R4] No se pudo cargar la corrección de cristales, barandas y feriados.');
    const loadProtectionAndR5 = () => {
      const protection = appendScript(protectionSrc, 'data-ucan-v304-r4-protection', '[UCAN V304 R4] No se pudo cargar la protección geométrica.');
      if (protection) protection.addEventListener('load', loadGlobalVisualR5);
      else loadGlobalVisualR5();
    };
    if (runtime) runtime.addEventListener('load', loadProtectionAndR5);
    else loadProtectionAndR5();
  }

  let attempts = 0;
  const timer = window.setInterval(() => {
    attempts += 1;
    if (connectToScene() || attempts >= 200) window.clearInterval(timer);
  }, 100);

  loadQuestVisualR4();
})();
