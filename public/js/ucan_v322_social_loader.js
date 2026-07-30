(() => {
  'use strict';

  const VERSION = 'V322';
  const REVISION = 'R26';
  const BUILD = 'V322-20260730-CLEAN-SOCIAL-LOADER-R26';

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
    '/js/ucan_v305_external_tropical_patio_fix.js?build=V322-20260730-COMMON-PATIO-R26',
    'data-ucan-v322-external-patio',
    '[UCAN V322] No se pudo cargar el patio común.'
  );
  const loadFloorOneBranding = () => appendScript(
    '/js/ucan_v306_floor1_brand_orientation_r10.js?build=V322-20260730-COMMON-BRANDING-R26',
    'data-ucan-v322-floor1-branding',
    '[UCAN V322] No se pudo cargar la orientación de anuncios.'
  );
  const loadParallelScene = () => appendScript(
    '/js/ucan_v313_parallel_scene.js?build=V322-20260730-CANONICAL-SCENE-R26',
    'data-ucan-v322-parallel-scene',
    '[UCAN V322] No se pudo cargar la escena canónica.'
  );
  const loadVisualComfort = () => appendScript(
    '/js/ucan_v322_visual_comfort.js?build=V322-20260730-VISUAL-ONLY-R26',
    'data-ucan-v322-visual-comfort',
    '[UCAN V322] No se pudo cargar el perfil visual.'
  );
  const loadVoiceBridge = () => appendScript(
    '/js/ucan_v306_voice_xr_bridge.js?build=V322-20260730-SHARED-VOICE-R26',
    'data-ucan-v322-voice-bridge',
    '[UCAN V322] No se pudo cargar el audio compartido.'
  );
  const loadRealtimeWorld = () => appendScript(
    '/js/ucan_v312_realtime_world.js?build=V322-20260730-REALTIME-WORLD-R26',
    'data-ucan-v322-realtime-world',
    '[UCAN V322] No se pudo cargar la presencia en tiempo real.'
  );
  const loadSharedInteraction = () => appendScript(
    '/js/ucan_v313_parallel_interaction.js?build=V322-20260730-SHARED-INTERACTION-R26',
    'data-ucan-v322-shared-interaction',
    '[UCAN V322] No se pudo cargar la interacción compartida.'
  );

  function finish() {
    window.__UCAN_SOCIAL_LOADER_V322__ = {
      version:VERSION,
      revision:REVISION,
      build:BUILD,
      installed:true,
      visualComfortLoaded:Boolean(document.querySelector('script[data-ucan-v322-visual-comfort="true"]')),
      voiceLoaded:Boolean(document.querySelector('script[data-ucan-v322-voice-bridge="true"]')),
      realtimeWorldLoaded:Boolean(document.querySelector('script[data-ucan-v322-realtime-world="true"]')),
      interactionLoaded:Boolean(document.querySelector('script[data-ucan-v322-shared-interaction="true"]')),
      legacyV318Loaded:Boolean(document.querySelector('script[src*="ucan_v318_stairs_all_environments.js"]')),
      legacyV319Loaded:Boolean(document.querySelector('script[src*="ucan_v319_vr_accessibility.js"]')),
      legacyV321Loaded:Boolean(document.querySelector('script[src*="ucan_v321_stair_authority.js"]'))
    };
    console.info('[UCAN V322 R26] Cargador limpio instalado sin V318/V319/V321.');
  }

  chain(loadExternalPatio, () =>
    chain(loadFloorOneBranding, () =>
      chain(loadParallelScene, () =>
        chain(loadVisualComfort, () =>
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