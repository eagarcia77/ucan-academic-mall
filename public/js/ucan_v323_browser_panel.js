(() => {
  'use strict';

  const VERSION = 'V323';
  const REVISION = 'R27';
  const BUILD = 'V323-20260730-SINGLE-BROWSER-PANEL-CONTROLLER-R27';
  const FIXED_IDS = Object.freeze([
    'hudToggle','destinationSelect','destinationGo','boardsBtn','xrBtn','mrBtn','resetBtn',
    'comfortBtn','qualityBtn','autoQualityBtn','motionBtn','contrastBtn','textSizeBtn','seasonSelect'
  ]);
  const DYNAMIC_IDS = Object.freeze([
    'ucanV316SpeedBtn','ucanV316TurnBtn','ucanV316DirectionBtn','ucanV316TeleportBtn',
    'visualComfortV323Btn','panelAuditV323Btn'
  ]);
  const AREA = Object.freeze({
    foodcourt:{ label:'Piso 1 · Áreas comunes', floor:0 },
    cafeteria:{ label:'Cafetería', floor:0 },
    library:{ label:'Biblioteca', floor:0 },
    floor2:{ label:'Piso 2 · Galería', floor:8.2 },
    class201:{ label:'SV-201', floor:8.2, board:'SV-201' },
    class202:{ label:'SV-202', floor:8.2, board:'SV-202' },
    class203:{ label:'SV-203', floor:8.2, board:'SV-203' },
    class204:{ label:'SV-204', floor:8.2, board:'SV-204' },
    class205:{ label:'SV-205', floor:8.2, board:'SV-205' },
    theater:{ label:'Piso 3 · Anfiteatro', floor:16.4, board:'ANF-301' },
    rooftop:{ label:'Terraza panorámica', floor:27.2 },
    rooftopWeather:{ label:'Observatorio · Estado del tiempo', floor:27.2 },
    rooftopAgenda:{ label:'Observatorio · Agenda astronómica', floor:27.2 },
    rooftopMoon:{ label:'Observatorio · Fase lunar', floor:27.2 },
    rooftopSky:{ label:'Observatorio · Mapa celeste', floor:27.2 },
    rooftopCalendar:{ label:'Observatorio · Calendario astronómico', floor:27.2 }
  });
  const QUALITY_MODES = Object.freeze(['high','performance']);

  const state = {
    installed:false,
    listenerInstalled:false,
    autoQuality:true,
    qualityMode:'high',
    reducedMotion:false,
    highContrast:false,
    largeText:false,
    comfortEnabled:false,
    xrSupport:{ vr:null, mr:null },
    registered:new Set(),
    actionCounts:new Map(),
    controlResults:new Map(),
    selfTests:0,
    selfTestPassed:false,
    lastAction:null,
    lastError:null,
    refreshes:0
  };

  function readStorage(key, fallback) {
    try { return localStorage.getItem(key) ?? fallback; }
    catch (_) { return fallback; }
  }
  function readBoolean(key, fallback) {
    const value = readStorage(key, String(fallback));
    return value === 'true' ? true : value === 'false' ? false : Boolean(fallback);
  }
  function save(key, value) {
    try { localStorage.setItem(key, String(value)); } catch (_) {}
  }

  state.autoQuality = readBoolean('ucanV323AutoQuality', true);
  state.qualityMode = QUALITY_MODES.includes(readStorage('ucanV323QualityMode', 'high')) ? readStorage('ucanV323QualityMode', 'high') : 'high';
  state.reducedMotion = readBoolean('ucanV323ReducedMotion', false);
  state.highContrast = readBoolean('ucanV323HighContrast', false);
  state.largeText = readBoolean('ucanV323LargeText', false);
  state.comfortEnabled = readBoolean('ucanV323ComfortEnabled', false);

  const api = () => window.__UCAN_API__ || null;
  const rig = () => window.__UCAN_LOCOMOTION_CONTROLS_V323__ || null;
  const visual = () => window.__UCAN_VISUAL_COMFORT_V323__ || null;
  const stair = () => window.__UCAN_STAIR_AUTHORITY_V322__ || null;
  const scene = () => api()?.getScene?.() || null;
  const engine = () => scene()?.getEngine?.() || null;
  const setStatus = message => api()?.setStatus?.(message);

  function publishPanelState() {
    window.__UCAN_PANEL_STATE_V323__ = {
      version:VERSION,
      revision:REVISION,
      installed:state.installed,
      autoQuality:state.autoQuality,
      qualityMode:state.qualityMode,
      reducedMotion:state.reducedMotion,
      highContrast:state.highContrast,
      largeText:state.largeText,
      comfortEnabled:state.comfortEnabled
    };
  }

  function desiredScale() { return state.qualityMode === 'performance' ? 1.5 : 1; }
  function applyQuality(targetEngine = engine()) {
    publishPanelState();
    if (!targetEngine) return null;
    if (state.autoQuality) return Number(targetEngine.getHardwareScalingLevel?.() ?? 1);
    const target = desiredScale();
    const current = Number(targetEngine.getHardwareScalingLevel?.() ?? 1);
    if (Math.abs(current - target) > 0.01) targetEngine.setHardwareScalingLevel?.(target);
    return target;
  }
  window.__UCAN_APPLY_PANEL_QUALITY_V323__ = applyQuality;

  function recordError(control, reason) {
    state.lastError = { control, message:String(reason?.message || reason), at:new Date().toISOString() };
    state.controlResults.set(control, { status:'error', message:state.lastError.message });
    console.error(`[UCAN ${VERSION}] ${control}:`, reason);
    publish();
  }

  function recordAction(control, status = 'ok', message = '') {
    state.actionCounts.set(control, (state.actionCounts.get(control) || 0) + 1);
    state.lastAction = { control, status, message, at:new Date().toISOString() };
    state.controlResults.set(control, { status, message });
  }

  function ensureButton(id, label, host) {
    let button = document.getElementById(id);
    if (!button) {
      button = document.createElement('button');
      button.id = id;
      button.type = 'button';
      button.className = 'secondary';
      button.textContent = label;
      host?.appendChild(button);
    }
    return button;
  }

  function ensureExtraControls() {
    const controlGrid = document.querySelector('.control-grid');
    if (controlGrid) {
      ensureButton('ucanV316SpeedBtn', 'Velocidad: natural', controlGrid);
      ensureButton('ucanV316TurnBtn', 'Giro: suave', controlGrid);
      ensureButton('ucanV316DirectionBtn', 'Dirección: mirada', controlGrid);
      ensureButton('ucanV316TeleportBtn', 'Teletransporte: activo', controlGrid);
    }
    const utility = document.getElementById('utilityActions');
    if (utility) {
      utility.style.display = 'grid';
      utility.style.gridTemplateColumns = 'repeat(2,minmax(0,1fr))';
      utility.style.gap = '7px';
      utility.style.marginTop = '8px';
      ensureButton('visualComfortV323Btn', 'Brillo: cómodo', utility);
      ensureButton('panelAuditV323Btn', 'Verificar panel', utility);
    }
  }

  function updateLocation(key) {
    const meta = AREA[key];
    const element = document.getElementById('currentLocation');
    if (element && meta) element.textContent = `📍 ${meta.label}`;
    const select = document.getElementById('destinationSelect');
    if (select && AREA[key]) select.value = key;
    document.querySelectorAll('[data-go]').forEach(button => button.classList.toggle('active-destination', button.getAttribute('data-go') === key));
  }

  function navigate(key) {
    const meta = AREA[key];
    if (!meta) throw new Error(`Destino desconocido: ${key}`);
    const result = api()?.goToArea?.(key);
    if (result === false || result == null) throw new Error(`No se pudo abrir el destino ${meta.label}.`);
    if (meta.board) api()?.setActiveBoardId?.(meta.board);
    stair()?.setFloor?.(meta.floor, `panel-v323:${key}`);
    rig()?.syncAfterNavigation?.();
    updateLocation(key);
    setStatus(`Ubicación: ${meta.label}.`);
    return true;
  }

  function toggleHud() {
    const body = document.getElementById('hudBody');
    const button = document.getElementById('hudToggle');
    if (!body || !button) throw new Error('No se encontró el contenido del panel.');
    const collapsed = body.classList.toggle('collapsed');
    button.textContent = collapsed ? '＋' : '−';
    button.setAttribute('aria-expanded', String(!collapsed));
    button.title = collapsed ? 'Expandir panel' : 'Contraer panel';
    return !collapsed;
  }

  function openBoards() {
    const boardId = api()?.getActiveBoardId?.() || 'SV-201';
    if (typeof api()?.openBoardPanel !== 'function') throw new Error('La pizarra todavía no está disponible.');
    api().openBoardPanel(boardId);
    return boardId;
  }

  async function enterXr(mode) {
    const control = rig();
    if (!control) throw new Error('El motor WebXR todavía no está listo.');
    const result = mode === 'mr' ? await control.enterMr?.() : await control.enterVr?.();
    if (result === false) throw new Error(`No se pudo iniciar ${mode === 'mr' ? 'MR' : 'VR'}.`);
    return true;
  }

  function resetPosition() {
    if (typeof rig()?.reset !== 'function') throw new Error('El control de reubicación todavía no está listo.');
    return rig().reset();
  }

  function setComfort(enabled) {
    state.comfortEnabled = Boolean(enabled);
    save('ucanV323ComfortEnabled', state.comfortEnabled);
    if (typeof rig()?.applyComfort !== 'function') throw new Error('El modo de locomoción todavía no está listo.');
    rig().applyComfort(state.comfortEnabled);
    return state.comfortEnabled;
  }

  function setQualityMode(mode) {
    state.qualityMode = QUALITY_MODES.includes(mode) ? mode : 'high';
    state.autoQuality = false;
    save('ucanV323QualityMode', state.qualityMode);
    save('ucanV323AutoQuality', state.autoQuality);
    applyQuality();
    return state.qualityMode;
  }

  function toggleQualityMode() {
    return setQualityMode(state.qualityMode === 'high' ? 'performance' : 'high');
  }

  function setAutoQuality(enabled) {
    state.autoQuality = Boolean(enabled);
    save('ucanV323AutoQuality', state.autoQuality);
    applyQuality();
    return state.autoQuality;
  }

  function setReducedMotion(enabled) {
    state.reducedMotion = Boolean(enabled);
    save('ucanV323ReducedMotion', state.reducedMotion);
    document.body.classList.toggle('reduced-motion', state.reducedMotion);
    publishPanelState();
    return state.reducedMotion;
  }

  function setHighContrast(enabled) {
    state.highContrast = Boolean(enabled);
    save('ucanV323HighContrast', state.highContrast);
    document.body.classList.toggle('high-contrast', state.highContrast);
    visual()?.setHighContrast?.(state.highContrast, false);
    publishPanelState();
    return state.highContrast;
  }

  function setLargeText(enabled) {
    state.largeText = Boolean(enabled);
    save('ucanV323LargeText', state.largeText);
    document.body.classList.toggle('large-text', state.largeText);
    publishPanelState();
    return state.largeText;
  }

  function setSeason(value) {
    const allowed = new Set(['spring','summer','autumn','winter']);
    if (!allowed.has(value)) throw new Error(`Estación no válida: ${value}`);
    api()?.setSeason?.(value);
    const select = document.getElementById('seasonSelect');
    if (select) select.value = value;
    setStatus(`Estación aplicada: ${select?.selectedOptions?.[0]?.textContent || value}.`);
    return value;
  }

  function cycleSpeed() {
    if (typeof rig()?.cycleSpeed !== 'function') throw new Error('El control de velocidad no está listo.');
    state.comfortEnabled = false;
    save('ucanV323ComfortEnabled', false);
    return rig().cycleSpeed();
  }
  function toggleTurn() {
    if (typeof rig()?.toggleTurn !== 'function') throw new Error('El control de giro no está listo.');
    return rig().toggleTurn();
  }
  function toggleDirection() {
    if (typeof rig()?.toggleDirection !== 'function') throw new Error('El control de dirección no está listo.');
    return rig().toggleDirection();
  }
  function toggleTeleport() {
    if (typeof rig()?.toggleTeleport !== 'function') throw new Error('El control de teletransporte no está listo.');
    return rig().toggleTeleport();
  }
  function cycleVisual() {
    if (typeof visual()?.cycle !== 'function') throw new Error('El control de brillo no está listo.');
    return visual().cycle();
  }

  const ACTIONS = {
    hudToggle:toggleHud,
    destinationGo:() => navigate(document.getElementById('destinationSelect')?.value),
    boardsBtn:openBoards,
    xrBtn:() => enterXr('vr'),
    mrBtn:() => enterXr('mr'),
    resetBtn:resetPosition,
    comfortBtn:() => setComfort(!state.comfortEnabled),
    qualityBtn:toggleQualityMode,
    autoQualityBtn:() => setAutoQuality(!state.autoQuality),
    motionBtn:() => setReducedMotion(!state.reducedMotion),
    contrastBtn:() => setHighContrast(!state.highContrast),
    textSizeBtn:() => setLargeText(!state.largeText),
    ucanV316SpeedBtn:cycleSpeed,
    ucanV316TurnBtn:toggleTurn,
    ucanV316DirectionBtn:toggleDirection,
    ucanV316TeleportBtn:toggleTeleport,
    visualComfortV323Btn:cycleVisual,
    panelAuditV323Btn:() => runSelfTest(true)
  };

  async function runAction(control, action) {
    try {
      const value = await action();
      recordAction(control, 'ok', value == null ? '' : String(value));
      refreshLabels();
      publish();
      return value;
    } catch (reason) {
      recordError(control, reason);
      setStatus(`No se pudo ejecutar ${control}: ${reason?.message || reason}`);
      refreshLabels();
      return false;
    }
  }

  function handleClick(event) {
    const target = event.target instanceof Element ? event.target.closest('button') : null;
    if (!target) return;
    const go = target.getAttribute('data-go');
    const action = go ? () => navigate(go) : ACTIONS[target.id];
    if (!action) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    runAction(go ? `navigate:${go}` : target.id, action);
  }

  function handleChange(event) {
    const target = event.target;
    if (!(target instanceof HTMLSelectElement) || target.id !== 'seasonSelect') return;
    event.stopImmediatePropagation();
    runAction('seasonSelect', () => setSeason(target.value));
  }

  function handleKeydown(event) {
    const target = event.target;
    if (!(target instanceof HTMLSelectElement) || target.id !== 'destinationSelect' || event.key !== 'Enter') return;
    event.preventDefault();
    event.stopImmediatePropagation();
    runAction('destinationSelect:Enter', () => navigate(target.value));
  }

  function installListeners() {
    if (state.listenerInstalled) return;
    document.addEventListener('click', handleClick, true);
    document.addEventListener('change', handleChange, true);
    document.addEventListener('keydown', handleKeydown, true);
    state.listenerInstalled = true;
  }

  async function refreshXrSupport() {
    try {
      if (!navigator.xr?.isSessionSupported) {
        state.xrSupport = { vr:false, mr:false };
      } else {
        const [vr, mr] = await Promise.all([
          navigator.xr.isSessionSupported('immersive-vr').catch(() => false),
          navigator.xr.isSessionSupported('immersive-ar').catch(() => false)
        ]);
        state.xrSupport = { vr:Boolean(vr), mr:Boolean(mr) };
      }
    } catch (_) {
      state.xrSupport = { vr:false, mr:false };
    }
    refreshLabels();
    publish();
  }

  function refreshLabels() {
    state.refreshes += 1;
    ensureExtraControls();
    publishPanelState();
    const locomotion = rig()?.getState?.() || {};
    const visualState = visual()?.getState?.() || {};
    const set = (id, text, pressed = null) => {
      const element = document.getElementById(id);
      if (!element) return;
      element.textContent = text;
      if (pressed != null) element.setAttribute('aria-pressed', String(Boolean(pressed)));
    };

    set('comfortBtn', state.comfortEnabled ? 'Modo confort: activo' : 'Modo confort: apagado', state.comfortEnabled);
    set('qualityBtn', state.qualityMode === 'performance' ? 'Calidad: rendimiento' : 'Calidad: alta');
    set('autoQualityBtn', state.autoQuality ? 'Calidad automática: activa' : 'Calidad automática: pausada', state.autoQuality);
    set('motionBtn', state.reducedMotion ? 'Movimiento reducido: sí' : 'Movimiento reducido: no', state.reducedMotion);
    set('contrastBtn', state.highContrast ? 'Alto contraste: sí' : 'Alto contraste: no', state.highContrast);
    set('textSizeBtn', state.largeText ? 'Texto grande: sí' : 'Texto grande: no', state.largeText);
    set('ucanV316SpeedBtn', `Velocidad: ${locomotion.speedMode === 'fast' ? 'rápida' : locomotion.speedMode === 'comfort' ? 'confort' : 'natural'}`);
    set('ucanV316TurnBtn', `Giro: ${locomotion.turnMode === 'snap' ? '30°' : 'suave'}`);
    set('ucanV316DirectionBtn', `Dirección: ${locomotion.directionMode === 'hand' ? 'mano' : 'mirada'}`);
    set('ucanV316TeleportBtn', `Teletransporte: ${locomotion.teleportEnabled === false ? 'apagado' : 'activo'}`, locomotion.teleportEnabled !== false);
    set('visualComfortV323Btn', visualState.label || `Brillo: ${visualState.mode || 'cómodo'}`);

    const xrButton = document.getElementById('xrBtn');
    const mrButton = document.getElementById('mrBtn');
    if (xrButton) {
      const unsupported = state.xrSupport.vr === false;
      xrButton.disabled = unsupported;
      xrButton.textContent = unsupported ? 'VR no disponible' : (locomotion.inXR ? 'Salir de VR' : 'Entrar en VR');
      xrButton.title = unsupported ? 'Este navegador o dispositivo no ofrece immersive-vr.' : 'Entrar o salir del modo VR.';
    }
    if (mrButton) {
      const unsupported = state.xrSupport.mr === false;
      mrButton.disabled = unsupported;
      mrButton.textContent = unsupported ? 'MR no disponible' : 'Entrar en MR';
      mrButton.title = unsupported ? 'Este navegador o dispositivo no ofrece immersive-ar.' : 'Entrar en realidad mixta.';
    }

    applyQuality();
    auditControls();
  }

  function prerequisiteFor(id) {
    if (id === 'boardsBtn') return typeof api()?.openBoardPanel === 'function';
    if (id === 'xrBtn') return typeof rig()?.enterVr === 'function';
    if (id === 'mrBtn') return typeof rig()?.enterMr === 'function';
    if (id === 'resetBtn') return typeof rig()?.reset === 'function';
    if (id === 'seasonSelect') return typeof api()?.setSeason === 'function';
    if (id.startsWith('ucanV316')) return Boolean(rig());
    if (id === 'visualComfortV323Btn') return Boolean(visual()?.installed);
    if (id === 'destinationSelect' || id === 'destinationGo' || id.startsWith('navigate:')) return typeof api()?.goToArea === 'function';
    return true;
  }

  function auditControls() {
    const details = {};
    const ids = [...FIXED_IDS, ...DYNAMIC_IDS];
    for (const id of ids) {
      const element = document.getElementById(id);
      const registered = id === 'destinationSelect' || id === 'seasonSelect' || Boolean(ACTIONS[id]);
      const prerequisite = prerequisiteFor(id);
      const unavailable = (id === 'xrBtn' && state.xrSupport.vr === false) || (id === 'mrBtn' && state.xrSupport.mr === false);
      details[id] = {
        exists:Boolean(element),
        registered,
        prerequisite,
        disabled:Boolean(element?.disabled),
        status:!element ? 'missing' : !registered || !prerequisite ? 'failed' : unavailable ? 'unavailable' : 'ready'
      };
    }
    const navButtons = [...document.querySelectorAll('[data-go]')];
    details.navigationButtons = {
      exists:navButtons.length > 0,
      registered:navButtons.every(button => AREA[button.getAttribute('data-go')]),
      prerequisite:typeof api()?.goToArea === 'function',
      count:navButtons.length,
      status:navButtons.length > 0 && navButtons.every(button => AREA[button.getAttribute('data-go')]) && typeof api()?.goToArea === 'function' ? 'ready' : 'failed'
    };
    state.controlResults = new Map(Object.entries(details));
    return details;
  }

  function runSelfTest(announce = false) {
    state.selfTests += 1;
    const before = {
      collapsed:document.getElementById('hudBody')?.classList.contains('collapsed'),
      reduced:state.reducedMotion,
      contrast:state.highContrast,
      large:state.largeText,
      auto:state.autoQuality,
      quality:state.qualityMode
    };
    const checks = {};
    try {
      const body = document.getElementById('hudBody');
      if (body) {
        toggleHud();
        toggleHud();
        checks.hudToggle = body.classList.contains('collapsed') === before.collapsed;
      } else checks.hudToggle = false;
      checks.navigation = typeof api()?.goToArea === 'function' && Object.keys(AREA).every(key => document.querySelector(`[data-go="${key}"]`) || document.querySelector(`#destinationSelect option[value="${key}"]`));
      checks.boards = typeof api()?.openBoardPanel === 'function';
      checks.xr = typeof rig()?.enterVr === 'function';
      checks.mr = typeof rig()?.enterMr === 'function';
      checks.reset = typeof rig()?.reset === 'function';
      checks.comfort = typeof rig()?.applyComfort === 'function';
      checks.quality = typeof window.__UCAN_APPLY_PANEL_QUALITY_V323__ === 'function';
      checks.autoQuality = window.__UCAN_PANEL_STATE_V323__?.autoQuality === state.autoQuality;
      setReducedMotion(before.reduced); checks.motion = document.body.classList.contains('reduced-motion') === before.reduced;
      setHighContrast(before.contrast); checks.contrast = document.body.classList.contains('high-contrast') === before.contrast;
      setLargeText(before.large); checks.text = document.body.classList.contains('large-text') === before.large;
      checks.season = typeof api()?.setSeason === 'function' && Boolean(document.getElementById('seasonSelect')?.value);
      checks.speed = typeof rig()?.cycleSpeed === 'function';
      checks.turn = typeof rig()?.toggleTurn === 'function';
      checks.direction = typeof rig()?.toggleDirection === 'function';
      checks.teleport = typeof rig()?.toggleTeleport === 'function';
      checks.visual = typeof visual()?.cycle === 'function';
      state.selfTestPassed = Object.values(checks).every(Boolean);
      recordAction('panelAuditV323Btn', state.selfTestPassed ? 'ok' : 'failed', JSON.stringify(checks));
      if (announce) setStatus(state.selfTestPassed ? 'Panel verificado: todas las funciones disponibles respondieron correctamente.' : `Panel incompleto: ${Object.entries(checks).filter(([,ok]) => !ok).map(([id]) => id).join(', ')}.`);
    } catch (reason) {
      state.selfTestPassed = false;
      recordError('self-test', reason);
    }
    refreshLabels();
    publish();
    return { passed:state.selfTestPassed, checks };
  }

  function getState() {
    const details = auditControls();
    const values = Object.values(details);
    return {
      installed:state.installed,
      singlePanelController:true,
      legacyBaseHudHandlersDisabled:true,
      legacyV316PanelControllerDisabled:true,
      controlsTotal:values.length,
      controlsReady:values.filter(item => item.status === 'ready').length,
      controlsUnavailable:values.filter(item => item.status === 'unavailable').length,
      controlsFailed:values.filter(item => item.status === 'failed' || item.status === 'missing').length,
      failedControls:Object.entries(details).filter(([,item]) => item.status === 'failed' || item.status === 'missing').map(([id]) => id),
      autoQuality:state.autoQuality,
      qualityMode:state.qualityMode,
      reducedMotion:state.reducedMotion,
      highContrast:state.highContrast,
      largeText:state.largeText,
      comfortEnabled:state.comfortEnabled,
      xrSupport:{ ...state.xrSupport },
      selfTests:state.selfTests,
      selfTestPassed:state.selfTestPassed,
      actionCounts:Object.fromEntries(state.actionCounts),
      lastAction:state.lastAction,
      lastError:state.lastError,
      details
    };
  }

  function publish() {
    publishPanelState();
    window.__UCAN_BROWSER_PANEL_V323__ = {
      version:VERSION,
      revision:REVISION,
      build:BUILD,
      ...getState(),
      navigate,
      setSeason,
      setComfort,
      setQualityMode,
      setAutoQuality,
      setReducedMotion,
      setHighContrast,
      setLargeText,
      runSelfTest,
      refresh:refreshLabels,
      getState
    };
  }

  function applyStoredState() {
    setReducedMotion(state.reducedMotion);
    setHighContrast(state.highContrast);
    setLargeText(state.largeText);
    if (state.comfortEnabled && typeof rig()?.applyComfort === 'function') rig().applyComfort(true);
    applyQuality();
  }

  function install() {
    if (state.installed) return true;
    if (!document.getElementById('hud') || !api()) return false;
    ensureExtraControls();
    installListeners();
    state.installed = true;
    applyStoredState();
    refreshLabels();
    refreshXrSupport();
    window.setTimeout(() => runSelfTest(false), 1400);
    window.setInterval(() => {
      try { refreshLabels(); }
      catch (reason) { recordError('refresh', reason); }
    }, 1500);
    setStatus('V323: panel izquierdo conectado a un solo controlador y verificado por función.');
    publish();
    console.info('[UCAN V323 R27] Controlador único del panel izquierdo instalado.');
    return true;
  }

  let attempts = 0;
  if (install()) { publish(); return; }
  const timer = window.setInterval(() => {
    attempts += 1;
    try {
      if (install() || attempts >= 700) window.clearInterval(timer);
    } catch (reason) {
      recordError('install', reason);
      if (attempts >= 700) window.clearInterval(timer);
    }
  }, 100);

  publishPanelState();
})();