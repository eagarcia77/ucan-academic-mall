(() => {
  'use strict';

  const VERSION = 'V316';
  const REVISION = 'R20';
  const BUILD = 'V316-20260729-SOCIAL-LOADER-NO-DUPLICATE-XR-R20';

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
    } else {
      next();
    }
  }

  function loadExternalPatio() {
    return appendScript(
      '/js/ucan_v305_external_tropical_patio_fix.js?build=V316-20260729-COMMON-PATIO-R20',
      'data-ucan-v316-external-patio',
      '[UCAN V316] No se pudo cargar el patio común.'
    );
  }

  function loadFloorOneBranding() {
    return appendScript(
      '/js/ucan_v306_floor1_brand_orientation_r10.js?build=V316-20260729-COMMON-BRANDING-R20',
      'data-ucan-v316-floor1-branding',
      '[UCAN V316] No se pudo cargar la orientación de anuncios.'
    );
  }

  function loadParallelScene() {
    return appendScript(
      '/js/ucan_v313_parallel_scene.js?build=V316-20260729-CANONICAL-SCENE-R20',
      'data-ucan-v316-parallel-scene',
      '[UCAN V316] No se pudo cargar la escena canónica.'
    );
  }

  function loadVoiceBridge() {
    return appendScript(
      '/js/ucan_v306_voice_xr_bridge.js?build=V316-20260729-SHARED-VOICE-R20',
      'data-ucan-v316-voice-bridge',
      '[UCAN V316] No se pudo cargar el puente de audio.'
    );
  }

  function loadRealtimeWorld() {
    return appendScript(
      '/js/ucan_v312_realtime_world.js?build=V316-20260729-REALTIME-WORLD-R20',
      'data-ucan-v316-realtime-world',
      '[UCAN V316] No se pudo cargar la presencia en tiempo real.'
    );
  }

  function loadSharedInteraction() {
    return appendScript(
      '/js/ucan_v313_parallel_interaction.js?build=V316-20260729-SHARED-INTERACTION-R20',
      'data-ucan-v316-shared-interaction',
      '[UCAN V316] No se pudo cargar la interacción compartida.'
    );
  }

  function finish() {
    window.__UCAN_SOCIAL_LOADER_V316__ = {
      version:VERSION,
      revision:REVISION,
      build:BUILD,
      installed:true,
      xrEntryOwnedByV316:true,
      duplicateXrEntryLoaded:false,
      parallelSceneLoaded:Boolean(document.querySelector('script[data-ucan-v316-parallel-scene="true"]')),
      realtimeWorldLoaded:Boolean(document.querySelector('script[data-ucan-v316-realtime-world="true"]')),
      interactionLoaded:Boolean(document.querySelector('script[data-ucan-v316-shared-interaction="true"]')),
      voiceLoaded:Boolean(document.querySelector('script[data-ucan-v316-voice-bridge="true"]')),
      legacyV313XrEntryLoaded:Boolean(document.querySelector('script[src*="ucan_v313_xr_entry.js"]'))
    };
    console.info('[UCAN V316 R20] Cargador social instalado sin una segunda entrada XR.');
  }

  chain(loadExternalPatio, () =>
    chain(loadFloorOneBranding, () =>
      chain(loadParallelScene, () =>
        chain(loadVoiceBridge, () =>
          chain(loadRealtimeWorld, () =>
            chain(loadSharedInteraction, finish)
          )
        )
      )
    )
  );
})();
