(() => {
  'use strict';

  const B = window.BABYLON;
  if (!B) return;

  const VERSION = 'V307';
  const BUILD = 'V307-20260728-BROWSER-XR-DEVICE-PRESENCE';
  const ENDPOINT = '/api/presence-v2';
  const XR_STATE = B.WebXRState || Object.freeze({ NOT_IN_XR:0, ENTERING_XR:1, IN_XR:2, EXITING_XR:3 });
  const AVATAR_HEIGHT = 1.65;
  const ALL_LAYERS = 0x0fffffff;

  const state = {
    installed:false,
    scene:null,
    helper:null,
    user:null,
    clientId:'',
    device:'browser',
    inXR:false,
    remotes:new Map(),
    participants:[],
    syncing:false,
    syncs:0,
    posts:0,
    failures:0,
    remoteCreated:0,
    remoteDisposed:0,
    visibilityRepairs:0,
    sameAccountRemoteDevices:0,
    lastPose:null,
    lastError:null,
    frameCount:0,
    lastSyncAt:0
  };

  function randomClientId() {
    try { return `presence_${crypto.randomUUID().replace(/-/g, '_')}`; }
    catch (_) { return `presence_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 14)}`; }
  }

  function clientId() {
    let value = '';
    try { value = sessionStorage.getItem('ucanPresenceClientV307') || ''; } catch (_) {}
    if (!/^[A-Za-z0-9_-]{8,120}$/.test(value)) {
      value = randomClientId();
      try { sessionStorage.setItem('ucanPresenceClientV307', value); } catch (_) {}
    }
    return value;
  }

  function detectDevice() {
    const text = `${navigator.userAgent || ''} ${(navigator.userAgentData?.brands || []).map(item => item.brand || '').join(' ')}`;
    if (/OculusBrowser|Meta Quest|Quest 2|Quest 3|Quest Pro/i.test(text)) return 'quest';
    if (/Android|iPhone|iPad|Mobile/i.test(text)) return 'mobile';
    return 'browser';
  }

  async function api(url, options = {}) {
    const response = await fetch(url, {
      credentials:'same-origin',
      cache:'no-store',
      ...options,
      headers:{ 'Content-Type':'application/json', ...(options.headers || {}) }
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
    return data;
  }

  function xrActive() {
    const value = state.helper?.baseExperience?.state;
    return value === XR_STATE.ENTERING_XR || value === XR_STATE.IN_XR;
  }

  function activeCamera() {
    if (xrActive()) return state.helper?.baseExperience?.camera || state.scene?.activeCamera || null;
    return window.__UCAN_API__?.getCamera?.() || state.scene?.activeCamera || null;
  }

  function positionOf(camera) {
    const candidates = [camera?.globalPosition, camera?.position, state.scene?.activeCamera?.globalPosition, state.scene?.activeCamera?.position];
    return candidates.find(value => value && [value.x, value.y, value.z].every(number => Number.isFinite(Number(number)))) || null;
  }

  function yawOf(camera) {
    try {
      const direction = camera?.getForwardRay?.(1)?.direction;
      if (direction && Number.isFinite(direction.x) && Number.isFinite(direction.z)) return Math.atan2(direction.x, direction.z);
    } catch (_) {}
    try { return Number(camera?.rotation?.y || camera?.absoluteRotationQuaternion?.toEulerAngles?.().y || 0); }
    catch (_) { return 0; }
  }

  function areaFromPosition(position) {
    if (!position) return 'Campus';
    const x = Number(position.x), y = Number(position.y), z = Number(position.z);
    if (y >= 14.7 && y <= 24.8 && x >= -52 && x <= 52 && z >= -39 && z <= 44) return 'ANF-301 · Anfiteatro';
    if (y >= 7.2 && y <= 14.8) {
      if (x >= -72 && x <= -40 && z >= -24 && z <= 15) return 'SV-201';
      if (x >= -42 && x <= -14 && z >= -51 && z <= -18) return 'SV-202';
      if (x >= -14 && x <= 14 && z >= -51 && z <= -18) return 'SV-203';
      if (x >= 14 && x <= 42 && z >= -51 && z <= -18) return 'SV-204';
      if (x >= 40 && x <= 72 && z >= -24 && z <= 15) return 'SV-205';
      return 'Piso 2';
    }
    if (y >= 25.5) return 'Terraza';
    if (y >= 14.5) return 'Piso 3';
    return document.getElementById('currentLocation')?.textContent?.replace(/^📍\s*/, '') || 'Piso 1';
  }

  function localPose() {
    const camera = activeCamera();
    const position = positionOf(camera);
    if (!position) return null;
    state.inXR = xrActive();
    const pose = {
      position:{ x:Number(position.x), y:Number(position.y), z:Number(position.z) },
      rotationY:yawOf(camera),
      area:areaFromPosition(position),
      device:state.device,
      inXR:state.inXR
    };
    state.lastPose = pose;
    return pose;
  }

  function avatarHash(participant) {
    return JSON.stringify(participant.avatar || {});
  }

  function displayLabel(participant) {
    const suffix = participant.inXR || participant.device === 'quest' ? ' · VR' : participant.device === 'mobile' ? ' · móvil' : ' · browser';
    return `${participant.displayName || participant.username || 'Participante'}${suffix}`;
  }

  function createRemote(participant) {
    const rootName = `avatar-presence-v307-${participant.clientId}`;
    const avatar = window.UCANAvatar.create(state.scene, participant.avatar || {}, {
      name:rootName,
      userId:participant.userId,
      displayName:displayLabel(participant),
      role:participant.role,
      scale:1,
      local:false
    });
    avatar.root.metadata = {
      ...(avatar.root.metadata || {}),
      remotePresenceV307:true,
      presenceClientIdV307:participant.clientId,
      device:participant.device,
      inXR:participant.inXR === true
    };
    const target = new B.Vector3(participant.position.x, participant.position.y - AVATAR_HEIGHT, participant.position.z);
    avatar.root.position.copyFrom(target);
    avatar.root.rotation.y = Number(participant.rotationY || 0) + Math.PI;
    const record = {
      avatar,
      target,
      rotationY:Number(participant.rotationY || 0) + Math.PI,
      hash:avatarHash(participant),
      participant,
      lastPosition:target.clone(),
      updatedAt:performance.now()
    };
    state.remotes.set(participant.clientId, record);
    state.remoteCreated += 1;
    forceVisible(record);
    return record;
  }

  function disposeRemote(clientId) {
    const record = state.remotes.get(clientId);
    if (!record) return;
    try { record.avatar?.dispose?.(); } catch (_) {}
    state.remotes.delete(clientId);
    state.remoteDisposed += 1;
  }

  function suppressLegacyRemoteAvatars() {
    for (const node of [...(state.scene?.transformNodes || [])]) {
      if (!node?.metadata?.avatar || node.metadata.local === true || node.metadata.remotePresenceV307 === true) continue;
      if (!/^avatar-remote-/i.test(String(node.name || ''))) continue;
      try {
        node.setEnabled(false);
        node.metadata = { ...(node.metadata || {}), hiddenByPresenceV307:true };
      } catch (_) {}
    }
  }

  function forceCameraLayers() {
    const cameras = [state.scene?.activeCamera, state.helper?.baseExperience?.camera, ...(state.helper?.baseExperience?.camera?.rigCameras || [])].filter(Boolean);
    for (const camera of cameras) {
      try { camera.layerMask = ALL_LAYERS; } catch (_) {}
    }
  }

  function forceVisible(record) {
    if (!record?.avatar?.root) return;
    try { record.avatar.root.setEnabled(true); } catch (_) {}
    const meshes = record.avatar.root.getChildMeshes?.() || [];
    for (const mesh of meshes) {
      try {
        if (mesh.isEnabled?.() === false) mesh.setEnabled(true);
        if (mesh.isVisible === false || mesh.visibility <= 0 || mesh.layerMask !== ALL_LAYERS) state.visibilityRepairs += 1;
        mesh.isVisible = true;
        mesh.visibility = 1;
        mesh.layerMask = ALL_LAYERS;
        mesh.alwaysSelectAsActiveMesh = true;
        mesh.isPickable = false;
        mesh.checkCollisions = false;
      } catch (_) {}
    }
  }

  function updateOnlinePanel(participants) {
    const count = document.getElementById('ucanOnlineCount');
    if (count) count.textContent = String(participants.length + 1);
    const list = document.getElementById('ucanOnlineList');
    if (!list || !state.user) return;
    list.textContent = '';
    const people = [{
      displayName:state.user.displayName || state.user.username || 'Usted',
      role:state.user.role,
      area:state.lastPose?.area || 'Campus',
      device:state.device,
      inXR:state.inXR,
      self:true
    }, ...participants];
    for (const person of people) {
      const row = document.createElement('div');
      row.className = 'ucan-online-person';
      const left = document.createElement('span');
      const name = document.createElement('b');
      if (person.role === 'admin') name.className = 'ucan-role-admin';
      name.textContent = `${person.displayName || person.username || 'Participante'}${person.self ? ' (usted)' : ''}`;
      left.appendChild(name);
      const right = document.createElement('span');
      const mode = person.inXR || person.device === 'quest' ? 'VR' : person.device === 'mobile' ? 'Móvil' : 'Browser';
      right.textContent = `${person.area || 'Campus'} · ${mode}`;
      row.append(left, right);
      list.appendChild(row);
    }
  }

  function reconcile(participants = []) {
    const clean = participants.filter(participant => participant?.clientId && participant.clientId !== state.clientId && participant.position);
    state.participants = clean;
    state.sameAccountRemoteDevices = clean.filter(participant => participant.userId === state.user?.id).length;
    const seen = new Set();
    for (const participant of clean) {
      seen.add(participant.clientId);
      let record = state.remotes.get(participant.clientId);
      const hash = avatarHash(participant);
      if (!record || record.hash !== hash) {
        if (record) disposeRemote(participant.clientId);
        record = createRemote(participant);
      }
      record.target.set(participant.position.x, participant.position.y - AVATAR_HEIGHT, participant.position.z);
      record.rotationY = Number(participant.rotationY || 0) + Math.PI;
      record.participant = participant;
      record.updatedAt = performance.now();
      record.avatar.root.metadata.device = participant.device;
      record.avatar.root.metadata.inXR = participant.inXR === true;
      forceVisible(record);
    }
    for (const client of [...state.remotes.keys()]) if (!seen.has(client)) disposeRemote(client);
    suppressLegacyRemoteAvatars();
    updateOnlinePanel(clean);
    updateAudit();
  }

  async function synchronize() {
    if (state.syncing || !state.user) return;
    const pose = localPose();
    if (!pose) return;
    state.syncing = true;
    try {
      const data = await api(ENDPOINT, {
        method:'POST',
        body:JSON.stringify({ clientId:state.clientId, ...pose })
      });
      state.posts += 1;
      state.syncs += 1;
      state.lastSyncAt = Date.now();
      reconcile(data.participants || []);
    } catch (error) {
      state.failures += 1;
      state.lastError = { stage:'synchronize', message:String(error?.message || error), at:new Date().toISOString() };
      try {
        const data = await api(`${ENDPOINT}?clientId=${encodeURIComponent(state.clientId)}`);
        reconcile(data.participants || []);
      } catch (_) {}
      updateAudit();
    } finally {
      state.syncing = false;
    }
  }

  function frame() {
    state.frameCount += 1;
    forceCameraLayers();
    for (const record of state.remotes.values()) {
      const previous = record.avatar.root.position.clone();
      record.avatar.root.position = B.Vector3.Lerp(record.avatar.root.position, record.target, 0.19);
      let delta = record.rotationY - record.avatar.root.rotation.y;
      while (delta > Math.PI) delta -= Math.PI * 2;
      while (delta < -Math.PI) delta += Math.PI * 2;
      record.avatar.root.rotation.y += delta * 0.19;
      const walking = B.Vector3.DistanceSquared(previous, record.avatar.root.position) > 0.000015;
      record.avatar.animate?.(walking, performance.now() / 1000);
      if (state.frameCount % 45 === 0) forceVisible(record);
    }
    if (state.frameCount % 90 === 0) suppressLegacyRemoteAvatars();
  }

  function updateAudit() {
    window.__UCAN_PRESENCE_XR_V307__ = {
      version:VERSION,
      build:BUILD,
      installed:state.installed,
      strategy:'device-session-presence',
      legacyUserIdPresenceDisabled:window.__UCAN_LEGACY_PRESENCE_DISABLED_V307__ === true,
      sameAccountMultipleDevices:true,
      browserToVrVisibility:true,
      vrToBrowserVisibility:true,
      realXrCameraPosition:true,
      remoteAvatarLayerMask:ALL_LAYERS,
      clientId:state.clientId,
      device:state.device,
      inXR:state.inXR,
      remoteAvatars:state.remotes.size,
      participants:state.participants.length,
      sameAccountRemoteDevices:state.sameAccountRemoteDevices,
      posts:state.posts,
      syncs:state.syncs,
      failures:state.failures,
      remoteCreated:state.remoteCreated,
      remoteDisposed:state.remoteDisposed,
      visibilityRepairs:state.visibilityRepairs,
      lastPose:state.lastPose,
      lastSyncAt:state.lastSyncAt ? new Date(state.lastSyncAt).toISOString() : null,
      lastError:state.lastError,
      refresh:synchronize,
      getState:() => ({
        installed:state.installed,
        clientId:state.clientId,
        device:state.device,
        inXR:state.inXR,
        remoteAvatars:state.remotes.size,
        participants:state.participants.map(person => ({ clientId:person.clientId, userId:person.userId, displayName:person.displayName, device:person.device, inXR:person.inXR, area:person.area })),
        sameAccountRemoteDevices:state.sameAccountRemoteDevices,
        lastPose:state.lastPose,
        failures:state.failures,
        lastError:state.lastError
      })
    };
  }

  async function install() {
    if (state.installed) return true;
    state.scene = window.__UCAN_API__?.getScene?.() || null;
    state.helper = window.__UCAN_XR_HELPER__ || null;
    if (!state.scene || !window.UCANAvatar || !window.__UCAN_IDENTITY__?.getUser) return false;
    state.user = window.__UCAN_IDENTITY__.getUser();
    if (!state.user) return false;
    state.clientId = clientId();
    state.device = detectDevice();
    state.installed = true;
    suppressLegacyRemoteAvatars();
    forceCameraLayers();
    state.scene.onBeforeRenderObservable.add(() => {
      try { frame(); }
      catch (error) {
        state.lastError = { stage:'frame', message:String(error?.message || error), at:new Date().toISOString() };
        updateAudit();
      }
    });
    state.helper?.baseExperience?.onStateChangedObservable?.add?.(() => {
      localPose();
      synchronize();
    });
    window.addEventListener('beforeunload', () => {
      fetch(ENDPOINT, {
        method:'DELETE',
        credentials:'same-origin',
        keepalive:true,
        headers:{ 'Content-Type':'application/json' },
        body:JSON.stringify({ clientId:state.clientId })
      }).catch(() => {});
    });
    window.setInterval(synchronize, 900);
    synchronize();
    updateAudit();
    window.__UCAN_API__?.setStatus?.('Presencia V307 activa: usuarios de browser y Meta Quest comparten la misma escena.');
    console.info('[UCAN V307] Presencia por dispositivo y avatares WebXR instalada.');
    return true;
  }

  let attempts = 0;
  const timer = window.setInterval(() => {
    attempts += 1;
    install().then(done => {
      if (done || attempts >= 500) window.clearInterval(timer);
    }).catch(error => {
      state.lastError = { stage:'install', message:String(error?.message || error), at:new Date().toISOString() };
      updateAudit();
      if (attempts >= 500) window.clearInterval(timer);
    });
  }, 100);

  updateAudit();
})();
