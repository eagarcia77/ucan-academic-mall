(() => {
  'use strict';

  const VERSION = 'V324';
  const REVISION = 'R28';
  const BUILD = 'V324-20260730-XR-STAIRS-ENTRY-SOCIAL-LOADER-R28';

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
    '/js/ucan_v305_external_tropical_patio_fix.js?build=V324-20260730-COMMON-PATIO-R28',
    'data-ucan-v324-external-patio',
    '[UCAN V324] No se pudo cargar el patio común.'
  );
  const loadFloorOneBranding = () => appendScript(
    '/js/ucan_v306_floor1_brand_orientation_r10.js?build=V324-20260730-COMMON-BRANDING-R28',
    'data-ucan-v324-floor1-branding',
    '[UCAN V324] No se pudo cargar la orientación de anuncios.'
  );
  const loadParallelScene = () => appendScript(
    '/js/ucan_v313_parallel_scene.js?build=V324-20260730-CANONICAL-SCENE-R28',
    'data-ucan-v324-parallel-scene',
    '[UCAN V324] No se pudo cargar la escena canónica.'
  );
  const loadXrStairsEntry = () => appendScript(
    '/js/ucan_v324_xr_stairs_entry.js?build=V324-20260730-XR-PARENT-RIG-QUEST-ENTRY-R28',
    'data-ucan-v324-xr-stairs-entry',
    '[UCAN V324] No se pudo cargar la locomoción WebXR ni el botón derecho.'
  );
  const loadVoiceBridge = () => appendScript(
    '/js/ucan_v306_voice_xr_bridge.js?build=V324-20260730-SHARED-VOICE-R28',
    'data-ucan-v324-voice-bridge',
    '[UCAN V324] No se pudo cargar el audio compartido.'
  );
  const loadRealtimeWorld = () => appendScript(
    '/js/ucan_v312_realtime_world.js?build=V324-20260730-REALTIME-WORLD-R28',
    'data-ucan-v324-realtime-world',
    '[UCAN V324] No se pudo cargar la presencia en tiempo real.'
  );
  const loadSharedInteraction = () => appendScript(
    '/js/ucan_v313_parallel_interaction.js?build=V324-20260730-SHARED-INTERACTION-R28',
    'data-ucan-v324-shared-interaction',
    '[UCAN V324] No se pudo cargar la interacción compartida.'
  );

  function finish() {
    window.__UCAN_SOCIAL_LOADER_V323__ = window.__UCAN_SOCIAL_LOADER_V324__ = {
      version:VERSION,
      revision:REVISION,
      build:BUILD,
      installed:true,
      visualComfortLoaded:Boolean(document.querySelector('script[data-ucan-v323-visual-comfort="true"]')),
      browserPanelLoaded:Boolean(document.querySelector('script[data-ucan-v323-browser-panel="true"]')),
      xrStairsEntryLoaded:Boolean(document.querySelector('script[data-ucan-v324-xr-stairs-entry="true"]')),
      voiceLoaded:Boolean(document.querySelector('script[data-ucan-v324-voice-bridge="true"]')),
      realtimeWorldLoaded:Boolean(document.querySelector('script[data-ucan-v324-realtime-world="true"]')),
      interactionLoaded:Boolean(document.querySelector('script[data-ucan-v324-shared-interaction="true"]')),
      legacyV316PanelControllerActive:Boolean(window.__UCAN_LEGACY_PANEL_CONTROLLER_DISABLED_V323__ !== true),
      legacyV318Loaded:Boolean(document.querySelector('script[src*="ucan_v318_stairs_all_environments.js"]')),
      legacyV319Loaded:Boolean(document.querySelector('script[src*="ucan_v319_vr_accessibility.js"]')),
      legacyV321Loaded:Boolean(document.querySelector('script[src*="ucan_v321_stair_authority.js"]')),
      legacyV322VisualLoaded:Boolean(document.querySelector('script[src*="ucan_v322_visual_comfort.js"]'))
    };
    console.info('[UCAN V324 R28] Cargador con locomoción WebXR y botón derecho instalado.');
  }

  chain(loadExternalPatio, () =>
    chain(loadFloorOneBranding, () =>
      chain(loadParallelScene, () =>
        chain(loadXrStairsEntry, () =>
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