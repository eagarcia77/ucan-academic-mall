(() => {
  'use strict';

  const VERSION = 'V289';
  const BUILD = 'V289-20260720-QUEST-XR-COMPAT-DIAGNOSTICS';
  const B = window.BABYLON;
  if (!B?.Scene?.prototype?.createDefaultXRExperienceAsync) return;

  const XR_STATE = B.WebXRState || Object.freeze({ NOT_IN_XR:0, ENTERING_XR:1, IN_XR:2, EXITING_XR:3 });
  const state = {
    helper:null,
    scene:null,
    installed:false,
    entering:false,
    inXR:false,
    supported:null,
    preflight:null,
    lastError:null,
    errors:[],
    attempts:0,
    successfulEntries:0,
    exits:0,
    buttonBound:false,
    panel:null,
    panelBody:null,
    panelTitle:null,
    originalHardwareScaling:null,
    compatibilityOptionsUsed:false,
    directUserGestureEntry:true
  };

  const isQuest = () => /OculusBrowser|Quest|VR/i.test(navigator.userAgent || '');
  const isTopLevel = () => {
    try { return window.top === window.self; }
    catch (_) { return false; }
  };

  function messageFor(error) {
    const name = String(error?.name || 'Error');
    const detail = String(error?.message || error || 'Error XR desconocido');
    if (name === 'SecurityError') return 'WebXR requiere una página HTTPS abierta directamente, no dentro de una vista previa incrustada.';
    if (name === 'NotSupportedError') return 'Este navegador o dispositivo no informó soporte para una sesión immersive-vr.';
    if (name === 'NotAllowedError') return 'Meta Quest no autorizó la sesión. Presione Entrar en VR directamente y acepte el permiso del visor.';
    if (name === 'InvalidStateError') return 'Ya existe otra sesión XR activa o el navegador quedó en un estado incompleto. Salga de VR y recargue la página.';
    if (/context lost|webgl/i.test(detail)) return 'El contexto gráfico se perdió. Recargue la página y use calidad automática antes de entrar en VR.';
    return `${name}: ${detail}`;
  }

  function recordError(stage, error) {
    const item = {
      stage,
      name:String(error?.name || 'Error'),
      message:String(error?.message || error || 'Error XR desconocido'),
      friendly:messageFor(error),
      at:new Date().toISOString()
    };
    state.lastError = item;
    state.errors.push(item);
    if (state.errors.length > 16) state.errors.shift();
    updateAudit();
    console.error(`[UCAN ${VERSION}] ${stage}:`, error);
    return item;
  }

  async function preflight(force = false) {
    if (state.preflight && !force) return state.preflight;
    const result = {
      checkedAt:new Date().toISOString(),
      secureContext:window.isSecureContext === true,
      protocol:location.protocol,
      topLevel:isTopLevel(),
      navigatorXR:Boolean(navigator.xr),
      immersiveVRSupported:false,
      questBrowser:isQuest(),
      userAgent:String(navigator.userAgent || ''),
      visibility:document.visibilityState,
      userActivation:Boolean(navigator.userActivation?.isActive),
      host:location.host,
      path:location.pathname
    };
    if (navigator.xr?.isSessionSupported) {
      try { result.immersiveVRSupported = await navigator.xr.isSessionSupported('immersive-vr'); }
      catch (error) { result.supportCheckError = String(error?.message || error); }
    }
    result.ready = result.secureContext && result.topLevel && result.navigatorXR && result.immersiveVRSupported;
    state.supported = result.immersiveVRSupported;
    state.preflight = result;
    updateAudit();
    return result;
  }

  function ensurePanel() {
    if (state.panel) return;
    const style = document.createElement('style');
    style.id = 'ucanQuestDiagStylesV289';
    style.textContent = `
      #ucanQuestDiagV289{position:fixed;inset:0;z-index:120;display:none;align-items:center;justify-content:center;padding:16px;background:rgba(0,0,0,.76);backdrop-filter:blur(8px)}
      #ucanQuestDiagV289.open{display:flex}
      #ucanQuestDiagV289 .card{width:min(560px,96vw);max-height:88vh;overflow:auto;border:2px solid #fed141;border-radius:18px;background:#071826;color:#fff;box-shadow:0 24px 90px rgba(0,0,0,.65)}
      #ucanQuestDiagV289 header{position:sticky;top:0;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 14px;background:#0b3d38;border-bottom:1px solid rgba(255,255,255,.18)}
      #ucanQuestDiagV289 h2{margin:0;font-size:18px}
      #ucanQuestDiagV289 .close{min-width:40px;width:40px;height:38px;padding:4px;background:#fff;color:#102b28;font-size:23px;line-height:1}
      #ucanQuestDiagBodyV289{padding:14px;font-size:14px;line-height:1.5}
      #ucanQuestDiagBodyV289 .ok{color:#9ff0c8}#ucanQuestDiagBodyV289 .bad{color:#ffb4a8}#ucanQuestDiagBodyV289 code{color:#fed141;word-break:break-word}
      #ucanQuestDiagV289 .actions{display:flex;flex-wrap:wrap;gap:8px;padding:0 14px 14px}
      #ucanQuestDiagV289 .actions button{flex:1;min-width:160px}
    `;
    document.head.appendChild(style);

    const panel = document.createElement('section');
    panel.id = 'ucanQuestDiagV289';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('aria-hidden', 'true');
    panel.innerHTML = `<div class="card"><header><h2 id="ucanQuestDiagTitleV289">Diagnóstico Meta Quest</h2><button class="close" id="ucanQuestDiagCloseV289" aria-label="Cerrar">×</button></header><div id="ucanQuestDiagBodyV289"></div><div class="actions"><button id="ucanQuestDiagRetryV289">Volver a comprobar</button><button id="ucanQuestDiagEnterV289">Entrar en VR</button></div></div>`;
    document.body.appendChild(panel);
    state.panel = panel;
    state.panelBody = panel.querySelector('#ucanQuestDiagBodyV289');
    state.panelTitle = panel.querySelector('#ucanQuestDiagTitleV289');
    panel.querySelector('#ucanQuestDiagCloseV289').addEventListener('click', closePanel);
    panel.querySelector('#ucanQuestDiagRetryV289').addEventListener('click', async () => {
      await preflight(true);
      renderPanel('Diagnóstico Meta Quest');
    });
    panel.querySelector('#ucanQuestDiagEnterV289').addEventListener('click', () => enterOrExitXR());
  }

  function closePanel() {
    state.panel?.classList.remove('open');
    state.panel?.setAttribute('aria-hidden', 'true');
  }

  function renderPanel(title = 'Diagnóstico Meta Quest') {
    ensurePanel();
    const p = state.preflight || {};
    const row = (label, value, pass) => `<p class="${pass ? 'ok' : 'bad'}"><strong>${label}:</strong> ${value}</p>`;
    const advice = [];
    if (!p.secureContext) advice.push('Abra la dirección HTTPS del puerto 3000. WebXR no funciona mediante HTTP normal.');
    if (!p.topLevel) advice.push('Abra el campus con Open in Browser o el icono del globo. No use la vista previa integrada de VS Code/Codespaces.');
    if (!p.navigatorXR) advice.push('Use Meta Quest Browser dentro del visor y actualícelo desde la tienda o configuración del dispositivo.');
    if (p.navigatorXR && !p.immersiveVRSupported) advice.push('El navegador no habilitó immersive-vr para esta página. Cierre otras sesiones VR y vuelva a abrir la pestaña.');
    if (state.lastError) advice.push(state.lastError.friendly);
    state.panelTitle.textContent = title;
    state.panelBody.innerHTML = [
      row('Contexto seguro', p.secureContext ? 'Sí' : 'No', p.secureContext),
      row('Página abierta directamente', p.topLevel ? 'Sí' : 'No', p.topLevel),
      row('API WebXR', p.navigatorXR ? 'Disponible' : 'No disponible', p.navigatorXR),
      row('Sesión immersive-vr', p.immersiveVRSupported ? 'Compatible' : 'No confirmada', p.immersiveVRSupported),
      row('Meta Quest detectado', p.questBrowser ? 'Sí' : 'No', p.questBrowser),
      `<p><strong>Dirección:</strong> <code>${p.protocol || location.protocol}//${p.host || location.host}${p.path || location.pathname}</code></p>`,
      advice.length ? `<hr><p><strong>Qué hacer:</strong></p><ol>${advice.map(item => `<li>${item}</li>`).join('')}</ol>` : '<p class="ok"><strong>Preflight correcto.</strong> El visor puede intentar iniciar la sesión.</p>'
    ].join('');
    state.panel.classList.add('open');
    state.panel.setAttribute('aria-hidden', 'false');
  }

  async function showDiagnostic(title, error = null) {
    if (error) recordError(title, error);
    await preflight(true);
    renderPanel(title);
  }

  function setStatus(message) {
    window.__UCAN_API__?.setStatus?.(message);
    const element = document.getElementById('status');
    if (element && !window.__UCAN_API__?.setStatus) element.textContent = message;
  }

  function updateButton() {
    const button = document.getElementById('xrBtn');
    if (!button) return;
    button.disabled = state.entering || !state.helper;
    button.textContent = state.inXR ? 'Salir de VR' : state.entering ? 'Entrando en VR…' : 'Entrar en VR';
    button.setAttribute('aria-pressed', state.inXR ? 'true' : 'false');
  }

  async function enterOrExitXR() {
    const helper = state.helper || window.__UCAN_XR_HELPER__;
    if (!helper?.baseExperience) {
      await showDiagnostic('WebXR todavía no está listo', new Error('No se creó el ayudante WebXR de Babylon.js.'));
      return false;
    }
    if (state.entering) return false;
    if (state.inXR || helper.baseExperience.state === XR_STATE.IN_XR) {
      try {
        await helper.baseExperience.exitXRAsync();
        return true;
      } catch (error) {
        await showDiagnostic('No se pudo salir de VR', error);
        return false;
      }
    }

    state.attempts += 1;
    state.entering = true;
    updateButton();
    try {
      const check = await preflight(true);
      if (!check.ready) {
        renderPanel('Meta Quest no puede iniciar todavía');
        return false;
      }

      const engine = state.scene?.getEngine?.();
      if (engine?.getHardwareScalingLevel && state.originalHardwareScaling == null) state.originalHardwareScaling = engine.getHardwareScalingLevel();
      if (isQuest() && engine?.setHardwareScalingLevel) {
        const current = Number(engine.getHardwareScalingLevel?.() || 1);
        engine.setHardwareScalingLevel(Math.max(current, 1.25));
      }

      closePanel();
      setStatus('Solicitando permiso para entrar en Meta Quest…');
      await helper.baseExperience.enterXRAsync('immersive-vr', 'local-floor');
      state.successfulEntries += 1;
      setStatus('Meta Quest conectado mediante una sesión immersive-vr local-floor.');
      return true;
    } catch (error) {
      await showDiagnostic('Error al entrar en Meta Quest', error);
      return false;
    } finally {
      state.entering = false;
      updateButton();
      updateAudit();
    }
  }

  function bindButtons() {
    const button = document.getElementById('xrBtn');
    if (button && !button.dataset.ucanV289Bound) {
      button.dataset.ucanV289Bound = 'true';
      button.addEventListener('click', event => {
        event.preventDefault();
        event.stopImmediatePropagation();
        enterOrExitXR();
      }, true);
      state.buttonBound = true;
    }

    const utility = document.getElementById('utilityActions') || document.querySelector('.control-grid');
    if (utility && !document.getElementById('questDiagBtnV289')) {
      const diagnostics = document.createElement('button');
      diagnostics.id = 'questDiagBtnV289';
      diagnostics.className = 'secondary';
      diagnostics.textContent = 'Diagnóstico VR';
      diagnostics.addEventListener('click', async () => {
        await preflight(true);
        renderPanel();
      });
      utility.appendChild(diagnostics);
    }
    updateButton();
  }

  function installHelper(scene, helper) {
    if (!helper?.baseExperience) throw new Error('Babylon.js no devolvió una experiencia WebXR válida.');
    state.scene = scene;
    state.helper = helper;
    state.installed = true;
    window.__UCAN_XR_HELPER__ = helper;
    helper.baseExperience.onStateChangedObservable?.add?.(xrState => {
      state.inXR = xrState === XR_STATE.ENTERING_XR || xrState === XR_STATE.IN_XR;
      if (xrState === XR_STATE.NOT_IN_XR) {
        if (state.inXR) state.exits += 1;
        state.inXR = false;
        const engine = state.scene?.getEngine?.();
        if (engine?.setHardwareScalingLevel && state.originalHardwareScaling != null) engine.setHardwareScalingLevel(state.originalHardwareScaling);
      }
      updateButton();
      updateAudit();
    });
    bindButtons();
    preflight(true).catch(error => recordError('preflight', error));
    updateAudit();
    return helper;
  }

  function updateAudit() {
    window.__UCAN_QUEST_XR_AUDIT__ = {
      version:VERSION,
      build:BUILD,
      installed:state.installed,
      helperReady:Boolean(state.helper),
      buttonBound:state.buttonBound,
      directUserGestureEntry:true,
      defaultBabylonXRUI:false,
      sessionMode:'immersive-vr',
      referenceSpaceType:'local-floor',
      optionalFeaturesArray:true,
      optionalFeaturesValue:[],
      compatibilityOptionsUsed:state.compatibilityOptionsUsed,
      secureContext:state.preflight?.secureContext ?? null,
      topLevel:state.preflight?.topLevel ?? null,
      navigatorXR:state.preflight?.navigatorXR ?? null,
      immersiveVRSupported:state.preflight?.immersiveVRSupported ?? null,
      questBrowser:state.preflight?.questBrowser ?? isQuest(),
      entering:state.entering,
      inXR:state.inXR,
      attempts:state.attempts,
      successfulEntries:state.successfulEntries,
      exits:state.exits,
      lastError:state.lastError,
      errors:[...state.errors],
      getState:() => ({
        installed:state.installed,
        helperReady:Boolean(state.helper),
        preflight:state.preflight ? { ...state.preflight } : null,
        entering:state.entering,
        inXR:state.inXR,
        attempts:state.attempts,
        successfulEntries:state.successfulEntries,
        lastError:state.lastError
      }),
      runPreflight:() => preflight(true),
      enter:() => enterOrExitXR(),
      showDiagnostics:async () => { await preflight(true); renderPanel(); }
    };
  }

  ensurePanel();
  const priorCreate = B.Scene.prototype.createDefaultXRExperienceAsync;
  if (!priorCreate.__ucanV289QuestPatched) {
    async function questCompatibleCreate(options = {}) {
      const compatible = {
        ...options,
        disableDefaultUI:true,
        disableTeleportation:true,
        optionalFeatures:[],
        uiOptions:{
          ...(options.uiOptions || {}),
          sessionMode:'immersive-vr',
          referenceSpaceType:'local-floor',
          optionalFeatures:[],
          requiredFeatures:[],
          onError:error => showDiagnostic('Error del botón WebXR', error)
        }
      };
      delete compatible.outputCanvasOptions;
      delete compatible.ignoreNativeCameraTransformation;
      state.compatibilityOptionsUsed = true;
      try {
        const helper = await priorCreate.call(this, compatible);
        return installHelper(this, helper);
      } catch (error) {
        recordError('createDefaultXRExperienceAsync', error);
        await preflight(true);
        renderPanel('No se pudo preparar WebXR');
        throw error;
      }
    }
    questCompatibleCreate.__ucanV289QuestPatched = true;
    questCompatibleCreate.__ucanPrevious = priorCreate;
    B.Scene.prototype.createDefaultXRExperienceAsync = questCompatibleCreate;
  }

  window.addEventListener('error', event => {
    const message = String(event?.message || '');
    if (/xr|webgl|oculus|quest/i.test(message)) recordError('window-error', event.error || message);
  });
  window.addEventListener('unhandledrejection', event => {
    const text = String(event?.reason?.message || event?.reason || '');
    if (/xr|webgl|session|immersive/i.test(text)) recordError('unhandled-rejection', event.reason || text);
  });
  document.getElementById('renderCanvas')?.addEventListener('webglcontextlost', event => {
    event.preventDefault();
    showDiagnostic('Se perdió el contexto WebGL', new Error('WebGL context lost'));
  });

  const bindTimer = window.setInterval(() => {
    bindButtons();
    if (state.helper && state.buttonBound) window.clearInterval(bindTimer);
  }, 200);
  window.setTimeout(() => window.clearInterval(bindTimer), 30000);
  updateAudit();
  console.info('[UCAN V289] Compatibilidad y diagnóstico de Meta Quest instalados.');
})();
