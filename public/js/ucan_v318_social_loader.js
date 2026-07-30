(() => {
  'use strict';

  const VERSION = 'V318';
  const REVISION = 'R22';
  const BUILD = 'V318-20260730-SOCIAL-LOADER-R22';

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

  function loadExternalPatio() {
    return appendScript(
      '/js/ucan_v305_external_tropical_patio_fix.js?build=V318-20260730-COMMON-PATIO-R22',
      'data-ucan-v318-external-patio',
      '[UCAN V318] No se pudo cargar el patio común.'
    );
  }

  function loadFloorOneBranding() {
    return appendScript(
      '/js/ucan_v306_floor1_brand_orientation_r10.js?build=V318-20260730-COMMON-BRANDING-R22',
      'data-ucan-v318-floor1-branding',
      '[UCAN V318] No se pudo cargar la orientación de anuncios.'
    );
  }

  function loadParallelScene() {
    return appendScript(
      '/js/ucan_v313_parallel_scene.js?build=V318-20260730-WIDE-ROOFTOP-CANONICAL-SCENE-R22',
      'data-ucan-v318-parallel-scene',
      '[UCAN V318] No se pudo cargar la escena canónica.'
    );
  }

  function loadStairRules() {
    return appendScript(
      '/js/ucan_v318_stairs_all_environments.js?build=V318-20260730-ISOLATED-ESCALATORS-WIDE-ROOFTOP-R22',
      'data-ucan-v318-stair-rules',
      '[UCAN V318] No se pudieron cargar las reglas definitivas de escaleras.'
    );
  }

  function loadVoiceBridge() {
    return appendScript(
      '/js/ucan_v306_voice_xr_bridge.js?build=V318-20260730-SHARED-VOICE-R22',
      'data-ucan-v318-voice-bridge',
      '[UCAN V318] No se pudo cargar el puente de audio.'
    );
  }

  function loadRealtimeWorld() {
    return appendScript(
      '/js/ucan_v312_realtime_world.js?build=V318-20260730-REALTIME-WORLD-R22',
      'data-ucan-v318-realtime-world',
      '[UCAN V318] No se pudo cargar la presencia en tiempo real.'
    );
  }

  function loadSharedInteraction() {
    return appendScript(
      '/js/ucan_v313_parallel_interaction.js?build=V318-20260730-SHARED-INTERACTION-R22',
      'data-ucan-v318-shared-interaction',
      '[UCAN V318] No se pudo cargar la interacción compartida.'
    );
  }

  function finish() {
    window.__UCAN_SOCIAL_LOADER_V318__ = {
      version:VERSION,
      revision:REVISION,
      build:BUILD,
      installed:true,
      xrEntryOwnedByV316:true,
      duplicateXrEntryLoaded:false,
      parallelSceneLoaded:Boolean(document.querySelector('script[data-ucan-v318-parallel-scene="true"]')),
      stairRulesLoaded:Boolean(document.querySelector('script[data-ucan-v318-stair-rules="true"]')),
      realtimeWorldLoaded:Boolean(document.querySelector('script[data-ucan-v318-realtime-world="true"]')),
      interactionLoaded:Boolean(document.querySelector('script[data-ucan-v318-shared-interaction="true"]')),
      voiceLoaded:Boolean(document.querySelector('script[data-ucan-v318-voice-bridge="true"]')),
      legacyV317Loaded:Boolean(document.querySelector('script[src*="ucan_v317_escalator_clearance.js"]')),
      legacyV313XrEntryLoaded:Boolean(document.querySelector('script[src*="ucan_v313_xr_entry.js"]'))
    };
    console.info('[UCAN V318 R22] Cargador social y reglas definitivas de escaleras instalados.');
  }

  chain(loadExternalPatio, () =>
    chain(loadFloorOneBranding, () =>
      chain(loadParallelScene, () =>
        chain(loadStairRules, () =>
          chain(loadVoiceBridge, () =>
            chain(loadRealtimeWorld, () =>
              chain(loadSharedInteraction, finish)
            )
          )
        )
      )
    )
  );
})();
