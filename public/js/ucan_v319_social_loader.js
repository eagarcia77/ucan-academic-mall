(() => {
  'use strict';

  const VERSION = 'V319';
  const REVISION = 'R23';
  const BUILD = 'V319-20260730-SAFE-LANDING-VISUAL-COMFORT-LOADER-R23';

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

  const loadExternalPatio = () => appendScript(
    '/js/ucan_v305_external_tropical_patio_fix.js?build=V319-20260730-COMMON-PATIO-R23',
    'data-ucan-v319-external-patio',
    '[UCAN V319] No se pudo cargar el patio común.'
  );

  const loadFloorOneBranding = () => appendScript(
    '/js/ucan_v306_floor1_brand_orientation_r10.js?build=V319-20260730-COMMON-BRANDING-R23',
    'data-ucan-v319-floor1-branding',
    '[UCAN V319] No se pudo cargar la orientación de anuncios.'
  );

  const loadParallelScene = () => appendScript(
    '/js/ucan_v313_parallel_scene.js?build=V319-20260730-CANONICAL-SCENE-R23',
    'data-ucan-v319-parallel-scene',
    '[UCAN V319] No se pudo cargar la escena canónica.'
  );

  const loadStairRules = () => appendScript(
    '/js/ucan_v318_stairs_all_environments.js?build=V319-20260730-CLEAR-ESCALATORS-R23',
    'data-ucan-v319-stair-rules',
    '[UCAN V319] No se pudieron cargar las reglas de escaleras.'
  );

  const loadFloorController = () => appendScript(
    '/js/ucan_v319_floor_route_controller.js?build=V319-20260730-SINGLE-GROUND-CONTROLLER-SAFE-LANDING-R23',
    'data-ucan-v319-floor-controller',
    '[UCAN V319] No se pudo cargar el controlador único de altura.'
  );

  const loadAccessibility = () => appendScript(
    '/js/ucan_v319_vr_accessibility.js?build=V319-20260730-VR-SAFE-LANDING-VISUAL-COMFORT-R23',
    'data-ucan-v319-accessibility',
    '[UCAN V319] No se pudo cargar la accesibilidad VR.'
  );

  const loadVoiceBridge = () => appendScript(
    '/js/ucan_v306_voice_xr_bridge.js?build=V319-20260730-SHARED-VOICE-R23',
    'data-ucan-v319-voice-bridge',
    '[UCAN V319] No se pudo cargar el audio compartido.'
  );

  const loadRealtimeWorld = () => appendScript(
    '/js/ucan_v312_realtime_world.js?build=V319-20260730-REALTIME-WORLD-R23',
    'data-ucan-v319-realtime-world',
    '[UCAN V319] No se pudo cargar la presencia en tiempo real.'
  );

  const loadSharedInteraction = () => appendScript(
    '/js/ucan_v313_parallel_interaction.js?build=V319-20260730-SHARED-INTERACTION-R23',
    'data-ucan-v319-shared-interaction',
    '[UCAN V319] No se pudo cargar la interacción compartida.'
  );

  function finish() {
    window.__UCAN_SOCIAL_LOADER_V319__ = {
      version:VERSION,
      revision:REVISION,
      build:BUILD,
      installed:true,
      parallelSceneLoaded:Boolean(document.querySelector('script[data-ucan-v319-parallel-scene="true"]')),
      stairRulesLoaded:Boolean(document.querySelector('script[data-ucan-v319-stair-rules="true"]')),
      floorControllerLoaded:Boolean(document.querySelector('script[data-ucan-v319-floor-controller="true"]')),
      accessibilityLoaded:Boolean(document.querySelector('script[data-ucan-v319-accessibility="true"]')),
      voiceLoaded:Boolean(document.querySelector('script[data-ucan-v319-voice-bridge="true"]')),
      realtimeWorldLoaded:Boolean(document.querySelector('script[data-ucan-v319-realtime-world="true"]')),
      interactionLoaded:Boolean(document.querySelector('script[data-ucan-v319-shared-interaction="true"]')),
      legacyFloorControllerV318Loaded:Boolean(document.querySelector('script[src*="ucan_v318_floor_route_controller.js"]')),
      duplicateXrEntryLoaded:Boolean(document.querySelector('script[src*="ucan_v313_xr_entry.js"]'))
    };
    console.info('[UCAN V319 R23] Cargador de salida segura y confort visual instalado.');
  }

  chain(loadExternalPatio, () =>
    chain(loadFloorOneBranding, () =>
      chain(loadParallelScene, () =>
        chain(loadStairRules, () =>
          chain(loadFloorController, () =>
            chain(loadAccessibility, () =>
              chain(loadVoiceBridge, () =>
                chain(loadRealtimeWorld, () =>
                  chain(loadSharedInteraction, finish)
                )
              )
            )
          )
        )
      )
    )
  );
})();
