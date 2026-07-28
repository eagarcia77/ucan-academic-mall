(() => {
  'use strict';

  const VERSION = 'V306';
  const BUILD = 'V306-20260728-VOICE-XR-ROOM-BRIDGE';
  const ROOMS = Object.freeze({
    'SV-201': { minX:-72, maxX:-40, minY:7.2, maxY:14.8, minZ:-24, maxZ:15 },
    'SV-202': { minX:-42, maxX:-14, minY:7.2, maxY:14.8, minZ:-51, maxZ:-18 },
    'SV-203': { minX:-14, maxX:14, minY:7.2, maxY:14.8, minZ:-51, maxZ:-18 },
    'SV-204': { minX:14, maxX:42, minY:7.2, maxY:14.8, minZ:-51, maxZ:-18 },
    'SV-205': { minX:40, maxX:72, minY:7.2, maxY:14.8, minZ:-24, maxZ:15 },
    'ANF-301': { minX:-52, maxX:52, minY:14.7, maxY:24.8, minZ:-39, maxZ:44 }
  });

  const state = {
    installed:false,
    scene:null,
    helper:null,
    currentRoom:'',
    previousRoom:'',
    inXR:false,
    source:'none',
    position:null,
    microphonePermission:'unknown',
    configReachable:false,
    backendVersion:null,
    turnConfigured:false,
    lastError:null,
    checks:0,
    roomChanges:0
  };

  function finiteVector(value) {
    return value && [value.x, value.y, value.z].every(number => Number.isFinite(Number(number)));
  }

  function copyPosition(value) {
    return finiteVector(value) ? { x:Number(value.x), y:Number(value.y), z:Number(value.z) } : null;
  }

  function xrCamera() {
    return state.helper?.baseExperience?.camera || null;
  }

  function bestPosition() {
    const xr = xrCamera();
    const xrState = state.helper?.baseExperience?.state;
    const inXR = xrState === (window.BABYLON?.WebXRState?.IN_XR ?? 2);
    state.inXR = inXR;

    const candidates = inXR ? [
      ['xr-global', xr?.globalPosition],
      ['xr-position', xr?.position],
      ['scene-active-global', state.scene?.activeCamera?.globalPosition],
      ['scene-active-position', state.scene?.activeCamera?.position]
    ] : [
      ['scene-active-global', state.scene?.activeCamera?.globalPosition],
      ['scene-active-position', state.scene?.activeCamera?.position],
      ['api-camera-global', window.__UCAN_API__?.getCamera?.()?.globalPosition],
      ['api-camera-position', window.__UCAN_API__?.getCamera?.()?.position]
    ];

    for (const [source, value] of candidates) {
      if (!finiteVector(value)) continue;
      state.source = source;
      state.position = copyPosition(value);
      return value;
    }
    state.source = 'none';
    state.position = null;
    return null;
  }

  function roomFromPosition(position) {
    if (!position) return '';
    for (const [room, bounds] of Object.entries(ROOMS)) {
      if (
        position.x >= bounds.minX && position.x <= bounds.maxX &&
        position.y >= bounds.minY && position.y <= bounds.maxY &&
        position.z >= bounds.minZ && position.z <= bounds.maxZ
      ) return room;
    }
    return '';
  }

  function updateRoom() {
    state.checks += 1;
    const room = roomFromPosition(bestPosition());
    if (room === state.currentRoom) return;
    state.previousRoom = state.currentRoom;
    state.currentRoom = room;
    state.roomChanges += 1;

    if (room) {
      try { window.__UCAN_VOICE__?.selectRoom?.(room, false); } catch (_) {}
      const voice = window.__UCAN_VOICE__?.getState?.();
      if (voice?.joined && voice.currentRoom !== room) {
        try { window.__UCAN_VOICE__?.joinRoom?.(room); } catch (error) {
          state.lastError = { stage:'switch-room', message:String(error?.message || error), at:new Date().toISOString() };
        }
      }
      window.dispatchEvent(new CustomEvent('ucan:voice-xr-room', { detail:{ room, position:state.position, source:state.source, inXR:state.inXR } }));
    }
    updateAudit();
  }

  async function checkMicrophonePermission() {
    try {
      if (!navigator.permissions?.query) return;
      const result = await navigator.permissions.query({ name:'microphone' });
      state.microphonePermission = result.state;
      result.addEventListener?.('change', () => {
        state.microphonePermission = result.state;
        updateAudit();
      });
    } catch (_) {
      state.microphonePermission = 'browser-managed';
    }
  }

  async function checkBackend() {
    try {
      const response = await fetch('/api/voice/config', { cache:'no-store', credentials:'same-origin' });
      const data = await response.json().catch(() => ({}));
      state.configReachable = response.ok;
      state.backendVersion = data.version || null;
      state.turnConfigured = data.turnConfigured === true;
      if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
    } catch (error) {
      state.configReachable = false;
      state.lastError = { stage:'voice-config', message:String(error?.message || error), at:new Date().toISOString() };
    }
    updateAudit();
  }

  async function testMicrophone() {
    if (!window.isSecureContext) return { ok:false, error:'Se requiere HTTPS.' };
    if (!navigator.mediaDevices?.getUserMedia) return { ok:false, error:'getUserMedia no está disponible.' };
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio:{ echoCancellation:true, noiseSuppression:true, autoGainControl:true, channelCount:1 },
        video:false
      });
      const tracks = stream.getAudioTracks();
      const result = {
        ok:tracks.length > 0,
        tracks:tracks.length,
        label:tracks[0]?.label || 'Micrófono autorizado',
        enabled:tracks[0]?.enabled === true,
        muted:tracks[0]?.muted === true,
        readyState:tracks[0]?.readyState || null
      };
      tracks.forEach(track => track.stop());
      state.microphonePermission = result.ok ? 'granted' : state.microphonePermission;
      updateAudit();
      return result;
    } catch (error) {
      state.microphonePermission = error?.name === 'NotAllowedError' ? 'denied' : state.microphonePermission;
      state.lastError = { stage:'microphone-test', name:error?.name || 'Error', message:String(error?.message || error), at:new Date().toISOString() };
      updateAudit();
      return { ok:false, name:error?.name || 'Error', error:String(error?.message || error) };
    }
  }

  function voiceState() {
    try { return window.__UCAN_VOICE__?.getState?.() || null; }
    catch (_) { return null; }
  }

  function updateAudit() {
    const voice = voiceState();
    window.__UCAN_VOICE_XR_V306__ = {
      version:VERSION,
      build:BUILD,
      installed:state.installed,
      secureContext:window.isSecureContext,
      getUserMediaAvailable:Boolean(navigator.mediaDevices?.getUserMedia),
      webRtcAvailable:Boolean(window.RTCPeerConnection),
      eventSourceAvailable:Boolean(window.EventSource),
      backendReachable:state.configReachable,
      backendVersion:state.backendVersion,
      turnConfigured:state.turnConfigured,
      microphonePermission:state.microphonePermission,
      inXR:state.inXR,
      positionSource:state.source,
      position:state.position,
      detectedRoom:state.currentRoom,
      previousRoom:state.previousRoom,
      roomChanges:state.roomChanges,
      checks:state.checks,
      joined:Boolean(voice?.joined),
      connectedRoom:voice?.currentRoom || '',
      microphoneMuted:Boolean(voice?.microphoneMuted),
      listeningMuted:Boolean(voice?.listeningMuted),
      participants:Array.isArray(voice?.participants) ? voice.participants.length : 0,
      lastError:state.lastError,
      refresh:() => { updateRoom(); return checkBackend(); },
      testMicrophone,
      joinDetectedRoom:() => state.currentRoom ? window.__UCAN_VOICE__?.joinRoom?.(state.currentRoom) : false,
      leave:() => window.__UCAN_VOICE__?.leave?.(),
      toggleMicrophone:() => window.__UCAN_VOICE__?.toggleMicrophone?.(),
      toggleListening:() => window.__UCAN_VOICE__?.toggleListening?.(),
      getState:() => ({
        installed:state.installed,
        backendReachable:state.configReachable,
        backendVersion:state.backendVersion,
        turnConfigured:state.turnConfigured,
        microphonePermission:state.microphonePermission,
        inXR:state.inXR,
        positionSource:state.source,
        position:state.position,
        detectedRoom:state.currentRoom,
        voice:voiceState(),
        lastError:state.lastError
      })
    };
  }

  function install() {
    if (state.installed) return true;
    state.scene = window.__UCAN_API__?.getScene?.() || null;
    state.helper = window.__UCAN_XR_HELPER__ || null;
    if (!state.scene || !window.__UCAN_VOICE__) return false;
    state.installed = true;
    checkMicrophonePermission();
    checkBackend();
    window.setInterval(updateRoom, 300);
    window.setInterval(updateAudit, 1000);
    updateRoom();
    updateAudit();
    console.info('[UCAN Voice V306] Puente de posición XR y diagnóstico instalado.');
    return true;
  }

  let attempts = 0;
  const timer = window.setInterval(() => {
    attempts += 1;
    if (install() || attempts >= 400) window.clearInterval(timer);
  }, 100);

  updateAudit();
})();
