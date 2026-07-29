(() => {
  'use strict';

  const VERSION = 'V317';
  const REVISION = 'R21';
  const BUILD = 'V317-20260729-SOCIAL-LOADER-ESCALATOR-CLEARANCE-R21';

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
      '/js/ucan_v305_external_tropical_patio_fix.js?build=V317-20260729-COMMON-PATIO-R21',
      'data-ucan-v317-external-patio',
      '[UCAN V317] No se pudo cargar el patio común.'
    );
  }

  function loadFloorOneBranding() {
    return appendScript(
      '/js/ucan_v306_floor1_brand_orientation_r10.js?build=V317-20260729-COMMON-BRANDING-R21',
      'data-ucan-v317-floor1-branding',
      '[UCAN V317] No se pudo cargar la orientación de anuncios.'
    );
  }

  function loadParallelScene() {
    return appendScript(
      '/js/ucan_v313_parallel_scene.js?build=V317-20260729-CANONICAL-SCENE-R21',
      'data-ucan-v317-parallel-scene',
      '[UCAN V317] No se pudo cargar la escena canónica.'
    );
  }

  function loadEscalatorClearance() {
    return appendScript(
      '/js/ucan_v317_escalator_clearance.js?build=V317-20260729-ESCALATOR-CLEARANCE-R21',
      'data-ucan-v317-escalator-clearance',
      '[UCAN V317] No se pudo cargar el despeje de escaleras eléctricas.'
    );
  }

  function loadVoiceBridge() {
    return appendScript(
      '/js/ucan_v306_voice_xr_bridge.js?build=V317-20260729-SHARED-VOICE-R21',
      'data-ucan-v317-voice-bridge',
      '[UCAN V317] No se pudo cargar el puente de audio.'
    );
  }

  function loadRealtimeWorld() {
    return appendScript(
      '/js/ucan_v312_realtime_world.js?build=V317-20260729-REALTIME-WORLD-R21',
      'data-ucan-v317-realtime-world',
      '[UCAN V317] No se pudo cargar la presencia en tiempo real.'
    );
  }

  function loadSharedInteraction() {
    return appendScript(
      '/js/ucan_v313_parallel_interaction.js?build=V317-20260729-SHARED-INTERACTION-R21',
      'data-ucan-v317-shared-interaction',
      '[UCAN V317] No se pudo cargar la interacción compartida.'
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
      parallelSceneLoaded:Boolean(document.querySelector('script[data-ucan-v317-parallel-scene="true"]')),
      escalatorClearanceLoaded:Boolean(document.querySelector('script[data-ucan-v317-escalator-clearance="true"]')),
      realtimeWorldLoaded:Boolean(document.querySelector('script[data-ucan-v317-realtime-world="true"]')),
      interactionLoaded:Boolean(document.querySelector('script[data-ucan-v317-shared-interaction="true"]')),
      voiceLoaded:Boolean(document.querySelector('script[data-ucan-v317-voice-bridge="true"]')),
      legacyV313XrEntryLoaded:Boolean(document.querySelector('script[src*="ucan_v313_xr_entry.js"]'))
    };
    window.__UCAN_SOCIAL_LOADER_V317__ = window.__UCAN_SOCIAL_LOADER_V316__;
    console.info('[UCAN V317 R21] Cargador social y despeje de escaleras instalados.');
  }

  chain(loadExternalPatio, () =>
    chain(loadFloorOneBranding, () =>
      chain(loadParallelScene, () =>
        chain(loadEscalatorClearance, () =>
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