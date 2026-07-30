(() => {
  'use strict';

  const VERSION = 'V322';
  const REVISION = 'R26';
  const MODES = Object.freeze(['comfort','dim','normal']);
  const LABELS = Object.freeze({ comfort:'Brillo: cómodo', dim:'Brillo: tenue', normal:'Brillo: normal' });
  const state = { scene:null, installed:false, mode:'comfort', button:null, base:null, lastError:null };

  function readMode() {
    try {
      const value = localStorage.getItem('ucanV322VisualMode') || localStorage.getItem('ucanV319VisualMode') || 'comfort';
      return MODES.includes(value) ? value : 'comfort';
    } catch (_) { return 'comfort'; }
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

  function apply(mode = state.mode, announce = false) {
    if (!state.scene) return false;
    const next = MODES.includes(mode) ? mode : 'comfort';
    state.mode = next;
    captureBase();
    const profile = next === 'dim'
      ? { exposure:0.58, contrast:1.02, environment:0.52, light:0.60 }
      : next === 'normal'
        ? { exposure:state.base.exposure, contrast:state.base.contrast, environment:state.base.environment, light:1 }
        : { exposure:0.72, contrast:1.04, environment:0.65, light:0.74 };
    const image = state.scene.imageProcessingConfiguration;
    if (image) {
      image.exposure = profile.exposure;
      image.contrast = profile.contrast;
      if ('toneMappingEnabled' in image) image.toneMappingEnabled = true;
    }
    state.scene.environmentIntensity = profile.environment;
    for (const item of state.base.lights) {
      if (item.light && !item.light.isDisposed?.()) item.light.intensity = item.intensity * profile.light;
    }
    try { localStorage.setItem('ucanV322VisualMode', next); } catch (_) {}
    if (state.button) state.button.textContent = LABELS[next];
    if (announce) window.__UCAN_API__?.setStatus?.(`${LABELS[next]} aplicado por igual en browser y VR.`);
    publish();
    return true;
  }

  function cycle() {
    const index = MODES.indexOf(state.mode);
    apply(MODES[(index + 1) % MODES.length], true);
  }

  function ensureButton() {
    if (state.button?.isConnected) return;
    const host = document.getElementById('utilityActions') || document.querySelector('.control-grid') || document.querySelector('#leftPanel .actions');
    if (!host) return;
    let button = document.getElementById('visualComfortV322Btn');
    if (!button) {
      button = document.createElement('button');
      button.id = 'visualComfortV322Btn';
      button.type = 'button';
      button.className = 'secondary';
      button.addEventListener('click', cycle);
      host.appendChild(button);
    }
    state.button = button;
    button.textContent = LABELS[state.mode];
    button.title = 'Ajusta la iluminación compartida sin modificar la locomoción ni las cámaras.';
  }

  function getState() {
    return {
      installed:state.installed,
      visualOnly:true,
      movesCamera:false,
      changesGround:false,
      sameBrowserVr:true,
      mode:state.mode,
      exposure:Number(state.scene?.imageProcessingConfiguration?.exposure ?? 1),
      environmentIntensity:Number(state.scene?.environmentIntensity ?? 1),
      lastError:state.lastError
    };
  }

  function publish() {
    window.__UCAN_VISUAL_COMFORT_V322__ = { version:VERSION, revision:REVISION, ...getState(), setMode:mode => apply(mode, true), getState };
  }

  function install() {
    if (state.installed) return true;
    state.scene = window.__UCAN_API__?.getScene?.() || null;
    if (!state.scene) return false;
    state.mode = readMode();
    state.installed = true;
    ensureButton();
    apply(state.mode);
    window.setInterval(() => {
      try { ensureButton(); apply(state.mode); }
      catch (reason) { state.lastError = String(reason?.message || reason); publish(); }
    }, 1800);
    window.__UCAN_XR_HELPER__?.baseExperience?.onStateChangedObservable?.add?.(() => window.setTimeout(() => apply(state.mode), 100));
    publish();
    console.info('[UCAN V322 R26] Confort visual independiente instalado.');
    return true;
  }

  let attempts = 0;
  const timer = window.setInterval(() => {
    attempts += 1;
    if (install() || attempts >= 700) window.clearInterval(timer);
  }, 100);
  publish();
})();