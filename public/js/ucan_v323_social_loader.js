(() => {
  'use strict';

  const VERSION = 'V323';
  const REVISION = 'R27';
  const BUILD = 'V323-20260730-BROWSER-PANEL-SOCIAL-LOADER-R27';

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
    const script = loader();
    if (!script) return next();
    script.addEventListener('load', next, { once:true });
    script.addEventListener('error', next, { once:true });
  }

  const loadExternalPatio = () => appendScript(
    '/js/ucan_v305_external_tropical_patio_fix.js?build=V323-20260730-COMMON-PATIO-R27',
    'data-ucan-v323-external-patio',
    '[UCAN V323] No se pudo cargar el patio común.'
  );
  const loadFloorOneBranding = () => appendScript(
    '/js/ucan_v306_floor1_brand_orientation_r10.js?build=V323-20260730-COMMON-BRANDING-R27',
    'data-ucan-v323-floor1-branding',
    '[UCAN V323] No se pudo cargar la orientación de anuncios.'
  );
  const loadParallelScene = () => appendScript(
    '/js/ucan_v313_parallel_scene.js?build=V323-20260730-CANONICAL-SCENE-R27',
    'data-ucan-v323-parallel-scene',
    '[UCAN V323] No se pudo cargar la escena canónica.'
  );
  const loadVoiceBridge = () => appendScript(
    '/js/ucan_v306_voice_xr_bridge.js?build=V323-20260730-SHARED-VOICE-R27',
    'data-ucan-v323-voice-bridge',
    '[UCAN V323] No se pudo cargar el audio compartido.'
  );
  const loadRealtimeWorld = () => appendScript(
    '/js/ucan_v312_realtime_world.js?build=V323-20260730-REALTIME-WORLD-R27',
    'data-ucan-v323-realtime-world',
    '[UCAN V323] No se pudo cargar la presencia en tiempo real.'
  );
  const loadSharedInteraction = () => appendScript(
    '/js/ucan_v313_parallel_interaction.js?build=V323-20260730-SHARED-INTERACTION-R27',
    'data-ucan-v323-shared-interaction',
    '[UCAN V323] No se pudo cargar la interacción compartida.'
  );

  function finish() {
    window.__UCAN_SOCIAL_LOADER_V323__ = {
      version:VERSION,
      revision:REVISION,
      build:BUILD,
      installed:true,
      visualComfortLoaded:Boolean(document.querySelector('script[data-ucan-v323-visual-comfort="true"]')),
      browserPanelLoaded:Boolean(document.querySelector('script[data-ucan-v323-browser-panel="true"]')),
      voiceLoaded:Boolean(document.querySelector('script[data-ucan-v323-voice-bridge="true"]')),
      realtimeWorldLoaded:Boolean(document.querySelector('script[data-ucan-v323-realtime-world="true"]')),
      interactionLoaded:Boolean(document.querySelector('script[data-ucan-v323-shared-interaction="true"]')),
      legacyV316PanelControllerActive:Boolean(window.__UCAN_LEGACY_PANEL_CONTROLLER_DISABLED_V323__ !== true),
      legacyV318Loaded:Boolean(document.querySelector('script[src*="ucan_v318_stairs_all_environments.js"]')),
      legacyV319Loaded:Boolean(document.querySelector('script[src*="ucan_v319_vr_accessibility.js"]')),
      legacyV321Loaded:Boolean(document.querySelector('script[src*="ucan_v321_stair_authority.js"]')),
      legacyV322VisualLoaded:Boolean(document.querySelector('script[src*="ucan_v322_visual_comfort.js"]'))
    };
    console.info('[UCAN V323 R27] Cargador del panel único instalado.');
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