(() => {
  'use strict';

  const VERSION = 'V320';
  const REVISION = 'R24';
  const BUILD = 'V320-20260730-FLOOR-TWO-STICKY-LOCK-LOADER-R24';

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
    '/js/ucan_v305_external_tropical_patio_fix.js?build=V320-20260730-COMMON-PATIO-R24',
    'data-ucan-v320-external-patio',
    '[UCAN V320] No se pudo cargar el patio común.'
  );

  const loadFloorOneBranding = () => appendScript(
    '/js/ucan_v306_floor1_brand_orientation_r10.js?build=V320-20260730-COMMON-BRANDING-R24',
    'data-ucan-v320-floor1-branding',
    '[UCAN V320] No se pudo cargar la orientación de anuncios.'
  );

  const loadParallelScene = () => appendScript(
    '/js/ucan_v313_parallel_scene.js?build=V320-20260730-CANONICAL-SCENE-R24',
    'data-ucan-v320-parallel-scene',
    '[UCAN V320] No se pudo cargar la escena canónica.'
  );

  const loadStairRules = () => appendScript(
    '/js/ucan_v318_stairs_all_environments.js?build=V320-20260730-CLEAR-ESCALATORS-R24',
    'data-ucan-v320-stair-rules',
    '[UCAN V320] No se pudieron cargar las reglas de escaleras.'
  );

  const loadFloorController = () => appendScript(
    '/js/ucan_v320_floor_lock_controller.js?build=V320-20260730-FLOOR-TWO-STICKY-LOCK-R24',
    'data-ucan-v320-floor-controller',
    '[UCAN V320] No se pudo cargar el bloqueo estable del Piso 2.'
  );

  const loadAccessibility = () => appendScript(
    '/js/ucan_v319_vr_accessibility.js?build=V320-20260730-VR-SAFE-LANDING-VISUAL-COMFORT-R24',
    'data-ucan-v320-accessibility',
    '[UCAN V320] No se pudo cargar la accesibilidad VR.'
  );

  const loadVoiceBridge = () => appendScript(
    '/js/ucan_v306_voice_xr_bridge.js?build=V320-20260730-SHARED-VOICE-R24',
    'data-ucan-v320-voice-bridge',
    '[UCAN V320] No se pudo cargar el audio compartido.'
  );

  const loadRealtimeWorld = () => appendScript(
    '/js/ucan_v312_realtime_world.js?build=V320-20260730-REALTIME-WORLD-R24',
    'data-ucan-v320-realtime-world',
    '[UCAN V320] No se pudo cargar la presencia en tiempo real.'
  );

  const loadSharedInteraction = () => appendScript(
    '/js/ucan_v313_parallel_interaction.js?build=V320-20260730-SHARED-INTERACTION-R24',
    'data-ucan-v320-shared-interaction',
    '[UCAN V320] No se pudo cargar la interacción compartida.'
  );

  function finish() {
    window.__UCAN_SOCIAL_LOADER_V320__ = {
      version:VERSION,
      revision:REVISION,
      build:BUILD,
      installed:true,
      floorControllerLoaded:Boolean(document.querySelector('script[data-ucan-v320-floor-controller="true"]')),
      accessibilityLoaded:Boolean(document.querySelector('script[data-ucan-v320-accessibility="true"]')),
      realtimeWorldLoaded:Boolean(document.querySelector('script[data-ucan-v320-realtime-world="true"]')),
      legacyFloorControllerV318Loaded:Boolean(document.querySelector('script[src*="ucan_v318_floor_route_controller.js"]')),
      legacyFloorControllerV319Loaded:Boolean(document.querySelector('script[src*="ucan_v319_floor_route_controller.js"]'))
    };
    console.info('[UCAN V320 R24] Bloqueo estable del Piso 2 instalado.');
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
