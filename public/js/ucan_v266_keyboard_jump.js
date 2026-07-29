(() => {
  'use strict';

  const VERSION = 'V313';
  const BUILD = 'V313-20260729-PARALLEL-LOADER-R17';
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
    return Boolean(document.querySelector('#ucanProfileModal.open, #boardPanel.open, #livePanelViewer.open, #ucanRealtimeWorldV312.open'));
  }

  function releaseMovementKeys() {
    for (const code of MOVEMENT_CODES) {
      window.dispatchEvent(new KeyboardEvent('keyup', { code, key:code === 'Space' ? ' ' : '', bubbles:false }));
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
    if (status) status.textContent = 'Browser, móvil, VR y MR utilizan una sola escena. Use W/A/S/D o las flechas para caminar y la barra espaciadora para saltar.';
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

  function loadXrEntryV313() {
    const runtime = appendScript(
      '/js/ucan_v313_xr_entry.js?build=V313-20260729-PARALLEL-XR-ENTRY-R17',
      'data-ucan-v313-xr-entry',
      '[UCAN V313] No se pudo cargar la entrada XR paralela.'
    );
    window.__UCAN_PARALLEL_LOADER_V313__ = {
      version:VERSION,
      build:BUILD,
      installed:true,
      oneScene:true,
      allEnvironmentsParallel:true,
      sceneRuntimeLoaded:Boolean(document.querySelector('script[data-ucan-v313-parallel-scene="true"]')),
      interactionRuntimeLoaded:Boolean(document.querySelector('script[data-ucan-v313-parallel-interaction="true"]')),
      xrEntryLoaded:Boolean(runtime || document.querySelector('script[data-ucan-v313-xr-entry="true"]')),
      realtimeWorldLoaded:Boolean(document.querySelector('script[data-ucan-v312-realtime-world="true"]')),
      oldQuestVisualLayersLoaded:false,
      strictParityV309Loaded:false,
      oldXrEntryV304Loaded:false,
      oldPresenceV307Loaded:false,
      oldInteractionV308Loaded:false,
      oldUnifiedV311Loaded:false,
      oldVrCanonicalV312Loaded:false,
      modeSpecificGeometryDisabled:true,
      cameraAndInputAdapterOnlyDifference:true
    };
  }

  function loadParallelInteractionV313() {
    return appendScript(
      '/js/ucan_v313_parallel_interaction.js?build=V313-20260729-PARALLEL-INTERACTION-R17',
      'data-ucan-v313-parallel-interaction',
      '[UCAN V313] No se pudo cargar la interacción paralela.'
    );
  }

  function loadRealtimeWorldV312() {
    return appendScript(
      '/js/ucan_v312_realtime_world.js?build=V313-20260729-PARALLEL-REALTIME-TRANSPORT-R17',
      'data-ucan-v312-realtime-world',
      '[UCAN V313] No se pudo cargar la presencia en tiempo real.'
    );
  }

  function loadVoiceBridgeV306() {
    return appendScript(
      '/js/ucan_v306_voice_xr_bridge.js?build=V313-20260729-PARALLEL-VOICE-R17',
      'data-ucan-v306-voice-xr-bridge',
      '[UCAN V313] No se pudo cargar el audio compartido.'
    );
  }

  function loadParallelSceneV313() {
    return appendScript(
      '/js/ucan_v313_parallel_scene.js?build=V313-20260729-PARALLEL-CANONICAL-SCENE-R17',
      'data-ucan-v313-parallel-scene',
      '[UCAN V313] No se pudo cargar la escena canónica paralela.'
    );
  }

  function loadFloor1BrandR10() {
    return appendScript(
      '/js/ucan_v306_floor1_brand_orientation_r10.js?build=V313-20260729-PARALLEL-BRAND-R17',
      'data-ucan-v306-floor1-brand-r10',
      '[UCAN V313] No se pudo cargar la orientación canónica de anuncios.'
    );
  }

  function loadExternalPatioV305() {
    return appendScript(
      '/js/ucan_v305_external_tropical_patio_fix.js?build=V313-20260729-PARALLEL-PATIO-R17',
      'data-ucan-v305-external-tropical-patio',
      '[UCAN V313] No se pudo cargar el patio exterior común.'
    );
  }

  function loadParallelRuntime() {
    chain(loadExternalPatioV305, () =>
      chain(loadFloor1BrandR10, () =>
        chain(loadParallelSceneV313, () =>
          chain(loadVoiceBridgeV306, () =>
            chain(loadRealtimeWorldV312, () =>
              chain(loadParallelInteractionV313, loadXrEntryV313)
            )
          )
        )
      )
    );
  }

  let attempts = 0;
  const timer = window.setInterval(() => {
    attempts += 1;
    if (connectToScene() || attempts >= 300) window.clearInterval(timer);
  }, 100);

  loadParallelRuntime();
})();
