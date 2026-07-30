(() => {
  'use strict';

  const VERSION = 'V323';
  const REVISION = 'R27';
  const BUILD = 'V323-20260730-PANEL-AWARE-VISUAL-COMFORT-R27';
  const MODES = Object.freeze(['comfort', 'dim', 'normal']);
  const LABELS = Object.freeze({ comfort:'Brillo: cómodo', dim:'Brillo: tenue', normal:'Brillo: normal' });
  const state = { scene:null, installed:false, mode:'comfort', highContrast:false, base:null, applications:0, lastError:null };

  function readStored(key, fallback) {
    try { return localStorage.getItem(key) ?? fallback; }
    catch (_) { return fallback; }
  }

  function readMode() {
    const value = readStored('ucanV323VisualMode', readStored('ucanV322VisualMode', 'comfort'));
    return MODES.includes(value) ? value : 'comfort';
  }

  function captureBase() {
    if (state.base || !state.scene) return;
    const image = state.scene.imageProcessingConfiguration;
    state.base = {
      exposure:Number(image?.exposure ?? 1),
      contrast:Number(image?.contrast ?? 1),
      environment:Number(state.scene.environmentIntensity ?? 1),
      lights:(state.scene.lights || []).map(light => ({ light, intensity:Number(light.intensity ?? 1) }))
    };
  }

  function profileFor(mode) {
    if (mode === 'dim') return { exposure:0.58, contrast:1.02, environment:0.52, light:0.60 };
    if (mode === 'normal') return {
      exposure:state.base?.exposure ?? 1,
      contrast:state.base?.contrast ?? 1,
      environment:state.base?.environment ?? 1,
      light:1
    };
    return { exposure:0.72, contrast:1.04, environment:0.65, light:0.74 };
  }

  function apply(mode = state.mode, announce = false) {
    if (!state.scene) return false;
    const next = MODES.includes(mode) ? mode : 'comfort';
    state.mode = next;
    captureBase();
    const profile = profileFor(next);
    const image = state.scene.imageProcessingConfiguration;
    if (image) {
      image.exposure = profile.exposure;
      image.contrast = state.highContrast ? Math.max(1.28, profile.contrast) : profile.contrast;
      if ('toneMappingEnabled' in image) image.toneMappingEnabled = true;
    }
    state.scene.environmentIntensity = profile.environment;
    for (const item of state.base?.lights || []) {
      if (item.light && !item.light.isDisposed?.()) item.light.intensity = item.intensity * profile.light;
    }
    state.applications += 1;
    try {
      localStorage.setItem('ucanV323VisualMode', next);
      localStorage.setItem('ucanV323HighContrast', String(state.highContrast));
    } catch (_) {}
    if (announce) window.__UCAN_API__?.setStatus?.(`${LABELS[next]} aplicado en browser y VR.`);
    publish();
    return true;
  }

  function setMode(mode, announce = true) { return apply(mode, announce); }
  function cycle() {
    const index = MODES.indexOf(state.mode);
    return apply(MODES[(index + 1) % MODES.length], true);
  }
  function setHighContrast(enabled, announce = false) {
    state.highContrast = Boolean(enabled);
    apply(state.mode, false);
    if (announce) window.__UCAN_API__?.setStatus?.(`Alto contraste ${state.highContrast ? 'activado' : 'desactivado'}.`);
    return state.highContrast;
  }

  function getState() {
    return {
      installed:state.installed,
      visualOnly:true,
      movesCamera:false,
      changesGround:false,
      sameBrowserVr:true,
      panelAware:true,
      mode:state.mode,
      label:LABELS[state.mode],
      highContrast:state.highContrast,
      exposure:Number(state.scene?.imageProcessingConfiguration?.exposure ?? 1),
      contrast:Number(state.scene?.imageProcessingConfiguration?.contrast ?? 1),
      environmentIntensity:Number(state.scene?.environmentIntensity ?? 1),
      applications:state.applications,
      lastError:state.lastError
    };
  }

  function publish() {
    window.__UCAN_VISUAL_COMFORT_V323__ = {
      version:VERSION,
      revision:REVISION,
      build:BUILD,
      ...getState(),
      setMode,
      cycle,
      setHighContrast,
      getState
    };
  }

  function install() {
    if (state.installed) return true;
    state.scene = window.__UCAN_API__?.getScene?.() || null;
    if (!state.scene) return false;
    state.mode = readMode();
    state.highContrast = readStored('ucanV323HighContrast', 'false') === 'true';
    state.installed = true;
    apply(state.mode);
    window.setInterval(() => {
      try { apply(state.mode); }
      catch (reason) { state.lastError = String(reason?.message || reason); publish(); }
    }, 1800);
    window.__UCAN_XR_HELPER__?.baseExperience?.onStateChangedObservable?.add?.(() => window.setTimeout(() => apply(state.mode), 100));
    publish();
    console.info('[UCAN V323 R27] Confort visual controlado por el panel instalado.');
    return true;
  }

  let attempts = 0;
  if (install()) { publish(); return; }
  const timer = window.setInterval(() => {
    attempts += 1;
    try {
      if (install() || attempts >= 700) window.clearInterval(timer);
    } catch (reason) {
      state.lastError = String(reason?.message || reason);
      publish();
      if (attempts >= 700) window.clearInterval(timer);
    }
  }, 100);

  publish();
})();