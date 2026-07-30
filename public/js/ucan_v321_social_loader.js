(() => {
  'use strict';

  const VERSION = 'V321';
  const REVISION = 'R25';
  const BUILD = 'V321-20260730-SINGLE-STAIR-AUTHORITY-LOADER-R25';

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
    '/js/ucan_v305_external_tropical_patio_fix.js?build=V321-20260730-COMMON-PATIO-R25',
    'data-ucan-v321-external-patio',
    '[UCAN V321] No se pudo cargar el patio común.'
  );

  const loadFloorOneBranding = () => appendScript(
    '/js/ucan_v306_floor1_brand_orientation_r10.js?build=V321-20260730-COMMON-BRANDING-R25',
    'data-ucan-v321-floor1-branding',
    '[UCAN V321] No se pudo cargar la orientación de anuncios.'
  );

  const loadParallelScene = () => appendScript(
    '/js/ucan_v313_parallel_scene.js?build=V321-20260730-CANONICAL-SCENE-R25',
    'data-ucan-v321-parallel-scene',
    '[UCAN V321] No se pudo cargar la escena canónica.'
  );

  const loadStairRules = () => appendScript(
    '/js/ucan_v318_stairs_all_environments.js?build=V321-20260730-CLEAR-STAIR-CORRIDORS-R25',
    'data-ucan-v321-stair-rules',
    '[UCAN V321] No se pudieron cargar las reglas de despeje.'
  );

  const loadStairAuthority = () => appendScript(
    '/js/ucan_v321_stair_authority.js?build=V321-20260730-SINGLE-STAIR-AUTHORITY-R25',
    'data-ucan-v321-stair-authority',
    '[UCAN V321] No se pudo cargar la autoridad única de escaleras.'
  );

  const loadAccessibility = () => appendScript(
    '/js/ucan_v319_vr_accessibility.js?build=V321-20260730-VR-ACCESSIBILITY-R25',
    'data-ucan-v321-accessibility',
    '[UCAN V321] No se pudo cargar la accesibilidad VR.'
  );

  const loadVoiceBridge = () => appendScript(
    '/js/ucan_v306_voice_xr_bridge.js?build=V321-20260730-SHARED-VOICE-R25',
    'data-ucan-v321-voice-bridge',
    '[UCAN V321] No se pudo cargar el audio compartido.'
  );

  const loadRealtimeWorld = () => appendScript(
    '/js/ucan_v312_realtime_world.js?build=V321-20260730-REALTIME-WORLD-R25',
    'data-ucan-v321-realtime-world',
    '[UCAN V321] No se pudo cargar la presencia en tiempo real.'
  );

  const loadSharedInteraction = () => appendScript(
    '/js/ucan_v313_parallel_interaction.js?build=V321-20260730-SHARED-INTERACTION-R25',
    'data-ucan-v321-shared-interaction',
    '[UCAN V321] No se pudo cargar la interacción compartida.'
  );

  function finish() {
    window.__UCAN_SOCIAL_LOADER_V321__ = {
      version:VERSION,
      revision:REVISION,
      build:BUILD,
      installed:true,
      parallelSceneLoaded:Boolean(document.querySelector('script[data-ucan-v321-parallel-scene="true"]')),
      stairRulesLoaded:Boolean(document.querySelector('script[data-ucan-v321-stair-rules="true"]')),
      stairAuthorityLoaded:Boolean(document.querySelector('script[data-ucan-v321-stair-authority="true"]')),
      accessibilityLoaded:Boolean(document.querySelector('script[data-ucan-v321-accessibility="true"]')),
      voiceLoaded:Boolean(document.querySelector('script[data-ucan-v321-voice-bridge="true"]')),
      realtimeWorldLoaded:Boolean(document.querySelector('script[data-ucan-v321-realtime-world="true"]')),
      interactionLoaded:Boolean(document.querySelector('script[data-ucan-v321-shared-interaction="true"]')),
      legacyFloorControllersLoaded:Boolean(document.querySelector('script[src*="ucan_v318_floor_route_controller.js"],script[src*="ucan_v319_floor_route_controller.js"],script[src*="ucan_v320_floor_lock_controller.js"]')),
      duplicateXrEntryLoaded:Boolean(document.querySelector('script[src*="ucan_v313_xr_entry.js"]'))
    };
    console.info('[UCAN V321 R25] Cargador de autoridad única de escaleras instalado.');
  }

  chain(loadExternalPatio, () =>
    chain(loadFloorOneBranding, () =>
      chain(loadParallelScene, () =>
        chain(loadStairRules, () =>
          chain(loadStairAuthority, () =>
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
