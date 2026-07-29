(() => {
  'use strict';

  const B = window.BABYLON;
  if (!B) return;

  const VERSION = 'V311';
  const REVISION = 'R15';
  const BUILD = 'V311-20260729-ONE-SCENE-ONE-WORLD-R15';
  const API = '/api/unified-world-v311/sync';
  const XR_STATE = B.WebXRState || Object.freeze({ NOT_IN_XR:0, ENTERING_XR:1, IN_XR:2, EXITING_XR:3 });
  const ALL_LAYERS = 0x0fffffff;
  const AVATAR_HEIGHT = 1.65;

  const state = {
    scene:null,
    helper:null,
    user:null,
    installed:false,
    clientId:'',
    device:'browser',
    inXR:false,
    room:'CAMPUS',
    latestSequence:0,
    remotes:new Map(),
    participants:[],
    actionQueue:[],
    gestureStates:new Map(),
    transientNodes:new Set(),
    syncing:false,
    syncs:0,
    failures:0,
    eventsSent:0,
    eventsReceived:0,
    remoteCreated:0,
    remoteDisposed:0,
    lastPose:null,
    lastError:null,
    panel:null,
    feed:null,
    controllerBindings:0
  };

  function randomClientId() {
    try { return `world_${crypto.randomUUID().replace(/-/g, '_')}`; }
    catch (_) { return `world_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 14)}`; }
  }

  function getClientId() {
    let value = '';
    try { value = sessionStorage.getItem('ucanUnifiedWorldClientV311') || ''; } catch (_) {}
    if (!/^[A-Za-z0-9_-]{8,120}$/.test(value)) {
      value = randomClientId();
      try { sessionStorage.setItem('ucanUnifiedWorldClientV311', value); } catch (_) {}
    }
    return value;
  }

  function detectDevice() {
    const text = `${navigator.userAgent || ''} ${(navigator.userAgentData?.brands || []).map(item => item.brand || '').join(' ')}`;
    if (/OculusBrowser|Meta Quest|Quest 2|Quest 3|Quest Pro/i.test(text)) return 'quest';
    if (/Android|iPhone|iPad|Mobile/i.test(text)) return 'mobile';
    return 'browser';
  }

  function xrActive() {
    const value = state.helper?.baseExperience?.state;
    return value === XR_STATE.ENTERING_XR || value === XR_STATE.IN_XR;
  }

  function activeCamera() {
    return xrActive()
      ? state.helper?.baseExperience?.camera || state.scene?.activeCamera
      : window.__UCAN_API__?.getCamera?.() || state.scene?.activeCamera;
  }

  function positionOf(camera) {
    return [camera?.globalPosition, camera?.position, state.scene?.activeCamera?.globalPosition, state.scene?.activeCamera?.position]
      .find(value => value && [value.x,value.y,value.z].every(number => Number.isFinite(Number(number)))) || null;
  }

  function yawOf(camera) {
    try {
      const direction = camera?.getForwardRay?.(1)?.direction;
      if (direction) return Math.atan2(Number(direction.x || 0), Number(direction.z || 1));
    } catch (_) {}
    try { return Number(camera?.absoluteRotationQuaternion?.toEulerAngles?.().y ?? camera?.rotation?.y ?? 0); }
    catch (_) { return 0; }
  }

  function normalizeRoom(value) {
    const text = String(value || 'Campus').trim().toUpperCase();
    const match = text.match(/^(SV-20[1-5]|ANF-301|CAFETER[IÍ]A|BIBLIOTECA|TERRAZA|PISO [123]|PATIO)/);
    return match ? match[1].replace('CAFETERIA','CAFETERÍA') : 'CAMPUS';
  }

  function areaFromPosition(position) {
    if (!position) return 'Campus';
    const x = Number(position.x), y = Number(position.y), z = Number(position.z);
    if (y >= 25.5) return 'TERRAZA';
    if (y >= 14.7 && y <= 24.8 && x >= -52 && x <= 52 && z >= -39 && z <= 44) return 'ANF-301';
    if (y >= 14.5) return 'PISO 3';
    if (y >= 7.2 && y <= 14.8) {
      if (x >= -72 && x <= -40 && z >= -24 && z <= 15) return 'SV-201';
      if (x >= -42 && x <= -14 && z >= -51 && z <= -18) return 'SV-202';
      if (x >= -14 && x <= 14 && z >= -51 && z <= -18) return 'SV-203';
      if (x >= 14 && x <= 42 && z >= -51 && z <= -18) return 'SV-204';
      if (x >= 40 && x <= 72 && z >= -24 && z <= 15) return 'SV-205';
      return 'PISO 2';
    }
    if (Math.abs(x) > 78 || Math.abs(z) > 63) return 'PATIO';
    const label = document.getElementById('currentLocation')?.textContent || 'PISO 1';
    if (/cafeter/i.test(label)) return 'CAFETERÍA';
    if (/biblioteca/i.test(label)) return 'BIBLIOTECA';
    return 'PISO 1';
  }

  function localPose() {
    const camera = activeCamera();
    const position = positionOf(camera);
    if (!position) return null;
    state.inXR = xrActive();
    const area = areaFromPosition(position);
    state.room = normalizeRoom(area);
    state.lastPose = {
      position:{ x:Number(position.x), y:Number(position.y), z:Number(position.z) },
      rotationY:yawOf(camera),
      area,
      room:state.room,
      device:state.device,
      inXR:state.inXR
    };
    return state.lastPose;
  }

  async function request(options = {}) {
    const response = await fetch(API, {
      credentials:'same-origin',
      cache:'no-store',
      ...options,
      headers:{ 'Content-Type':'application/json', ...(options.headers || {}) }
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
    return data;
  }

  function avatarHash(participant) {
    return JSON.stringify(participant.avatar || {});
  }

  function displayLabel(participant) {
    const suffix = participant.inXR || participant.device === 'quest' ? ' · VR' : participant.device === 'mobile' ? ' · móvil' : ' · browser';
    return `${participant.displayName || participant.username || 'Participante'}${suffix}`;
  }

  function forceVisible(record) {
    if (!record?.avatar?.root) return;
    record.avatar.root.setEnabled?.(true);
    record.avatar.root.metadata = { ...(record.avatar.root.metadata || {}), remoteAvatarV311:true, unifiedWorldV311:true };
    for (const mesh of record.avatar.root.getChildMeshes?.() || []) {
      mesh.setEnabled?.(true);
      mesh.isVisible = true;
      mesh.visibility = 1;
      mesh.layerMask = ALL_LAYERS;
      mesh.alwaysSelectAsActiveMesh = true;
      mesh.isPickable = false;
      mesh.checkCollisions = false;
      mesh.metadata = { ...(mesh.metadata || {}), remoteAvatarV311:true, unifiedWorldV311:true };
    }
  }

  function createRemote(participant) {
    const avatar = window.UCANAvatar.create(state.scene, participant.avatar || {}, {
      name:`avatar-unificado-v311-${participant.clientId}`,
      userId:participant.userId,
      displayName:displayLabel(participant),
      role:participant.role,
      scale:1,
      local:false
    });
    avatar.root.metadata = {
      ...(avatar.root.metadata || {}),
      remoteAvatarV311:true,
      unifiedWorldV311:true,
      unifiedClientIdV311:participant.clientId,
      userId:participant.userId,
      device:participant.device,
      inXR:participant.inXR === true
    };
    const target = new B.Vector3(participant.position.x, participant.position.y - AVATAR_HEIGHT, participant.position.z);
    avatar.root.position.copyFrom(target);
    avatar.root.rotation.y = Number(participant.rotationY || 0) + Math.PI;
    const record = {
      avatar,
      participant,
      target,
      rotationY:Number(participant.rotationY || 0) + Math.PI,
      hash:avatarHash(participant)
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

  function suppressLegacyRemotes() {
    for (const node of state.scene?.transformNodes || []) {
      if (!node?.metadata?.avatar || node.metadata.local === true || node.metadata.remoteAvatarV311 === true) continue;
      if (!/avatar-remote-|avatar-presence-v307-/i.test(String(node.name || ''))) continue;
      try { node.setEnabled(false); } catch (_) {}
    }
  }

  function reconcile(participants) {
    const clean = (participants || []).filter(person => person?.clientId && person.clientId !== state.clientId && person.position);
    state.participants = clean;
    const seen = new Set();
    for (const participant of clean) {
      seen.add(participant.clientId);
      let record = state.remotes.get(participant.clientId);
      const hash = avatarHash(participant);
      if (!record || record.hash !== hash) {
        if (record) disposeRemote(participant.clientId);
        record = createRemote(participant);
      }
      record.participant = participant;
      record.target.set(participant.position.x, participant.position.y - AVATAR_HEIGHT, participant.position.z);
      record.rotationY = Number(participant.rotationY || 0) + Math.PI;
      record.avatar.root.metadata.device = participant.device;
      record.avatar.root.metadata.inXR = participant.inXR === true;
      forceVisible(record);
    }
    for (const clientId of [...state.remotes.keys()]) if (!seen.has(clientId)) disposeRemote(clientId);
    suppressLegacyRemotes();
    updateOnlinePanel();
  }

  function rootForClient(clientId) {
    return state.remotes.get(clientId)?.avatar?.root || null;
  }

  function makeBubble(root, text, emoji = false) {
    if (!root || !text) return;
    const bubbleRoot = new B.TransformNode(`burbuja unificada V311 ${Date.now()}`, state.scene);
    bubbleRoot.parent = root;
    bubbleRoot.position.set(0, 3.75, 0);
    const texture = new B.DynamicTexture(`texto unificado V311 ${Date.now()}`, { width:1024, height:320 }, state.scene, false);
    const ctx = texture.getContext();
    ctx.fillStyle = 'rgba(4,34,31,.94)'; ctx.fillRect(20,20,984,280);
    ctx.strokeStyle = '#fed141'; ctx.lineWidth = 10; ctx.strokeRect(25,25,974,270);
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = emoji ? 'bold 150px Segoe UI Emoji, Arial' : 'bold 48px Segoe UI, Arial';
    const value = String(text).slice(0, emoji ? 4 : 130);
    const lines = emoji ? [value] : [value.slice(0,64), value.slice(64,128)].filter(Boolean);
    lines.forEach((line,index) => ctx.fillText(line,512,160 + (index - (lines.length - 1) / 2) * 66));
    texture.update(false);
    const material = new B.StandardMaterial(`material burbuja V311 ${Date.now()}`, state.scene);
    material.diffuseTexture = texture; material.emissiveTexture = texture; material.disableLighting = true; material.backFaceCulling = true; material.useAlphaFromDiffuseTexture = true;
    const plane = B.MeshBuilder.CreatePlane(`plano burbuja V311 ${Date.now()}`, { width:3.4, height:1.06, sideOrientation:B.Mesh.FRONTSIDE }, state.scene);
    plane.parent = bubbleRoot; plane.billboardMode = B.Mesh.BILLBOARDMODE_ALL; plane.material = material; plane.isPickable = false; plane.layerMask = ALL_LAYERS; plane.renderingGroupId = 9;
    state.transientNodes.add(bubbleRoot);
    window.setTimeout(() => {
      state.transientNodes.delete(bubbleRoot);
      try { plane.dispose(); material.dispose(); texture.dispose(); bubbleRoot.dispose(); } catch (_) {}
    }, emoji ? 3500 : 8000);
  }

  function childByName(root, pattern) {
    return (root?.getChildMeshes?.() || []).find(mesh => pattern.test(String(mesh.name || ''))) || null;
  }

  function startGesture(clientId, gesture) {
    const root = rootForClient(clientId);
    if (!root) return;
    const left = childByName(root, /avatar-brazo-i/i);
    const right = childByName(root, /avatar-brazo-d/i);
    if (!left && !right) return;
    state.gestureStates.set(clientId, {
      left,right,gesture,started:performance.now(),duration:gesture === 'clap' ? 2400 : 3200,
      leftBase:left?.rotation?.clone?.() || null,
      rightBase:right?.rotation?.clone?.() || null
    });
  }

  function updateGestures() {
    const time = performance.now();
    for (const [clientId,item] of state.gestureStates) {
      const elapsed = time - item.started;
      const pulse = Math.sin(elapsed / 120);
      if (item.gesture === 'wave' && item.right) { item.right.rotation.x = item.rightBase.x + pulse * .34; item.right.rotation.z = item.rightBase.z - 1.55; }
      else if (item.gesture === 'raise-hand' && item.right) { item.right.rotation.z = item.rightBase.z - 2.45; }
      else if (item.gesture === 'clap' && item.left && item.right) {
        const amount = .75 + Math.abs(pulse) * .5;
        item.left.rotation.z = item.leftBase.z - amount; item.right.rotation.z = item.rightBase.z + amount;
        item.left.rotation.x = item.leftBase.x - .8; item.right.rotation.x = item.rightBase.x - .8;
      } else if (item.gesture === 'point' && item.right) { item.right.rotation.x = item.rightBase.x - 1.45; item.right.rotation.z = item.rightBase.z - .25; }
      if (elapsed >= item.duration) {
        if (item.left && item.leftBase) item.left.rotation.copyFrom(item.leftBase);
        if (item.right && item.rightBase) item.right.rotation.copyFrom(item.rightBase);
        state.gestureStates.delete(clientId);
      }
    }
  }

  function appendFeed(text) {
    if (!state.feed) return;
    const row = document.createElement('div');
    row.textContent = text;
    state.feed.prepend(row);
    while (state.feed.children.length > 20) state.feed.lastElementChild?.remove();
  }

  function processEvent(event) {
    if (!event || event.clientId === state.clientId) return;
    const root = rootForClient(event.clientId);
    if (event.type === 'chat') {
      const text = `${event.displayName}: ${event.payload?.text || ''}`;
      if (root) makeBubble(root, text);
      appendFeed(text);
    } else if (event.type === 'gesture') {
      startGesture(event.clientId, event.payload?.gesture || 'wave');
      if (root) makeBubble(root, ({ wave:'👋 Saludo','raise-hand':'✋ Mano levantada',clap:'👏 Aplauso',point:'👉 Señalando' })[event.payload?.gesture] || '👋 Saludo');
    } else if (event.type === 'reaction') {
      if (root) makeBubble(root, event.payload?.reaction || '👍', true);
    } else if (event.type === 'focus') {
      const position = event.payload?.position;
      if (position) {
        const marker = B.MeshBuilder.CreateTorus(`foco unificado V311 ${event.id}`, { diameter:1.25, thickness:.09, tessellation:32 }, state.scene);
        marker.position.set(position.x, position.y, position.z); marker.rotation.x = Math.PI / 2; marker.isPickable = false; marker.layerMask = ALL_LAYERS;
        const material = new B.StandardMaterial(`material foco V311 ${event.id}`, state.scene);
        material.diffuseColor = B.Color3.FromHexString('#fed141'); material.emissiveColor = material.diffuseColor; material.disableLighting = true; marker.material = material;
        window.setTimeout(() => { try { marker.dispose(); material.dispose(); } catch (_) {} }, 5500);
      }
    } else if (event.type === 'object-state') {
      window.dispatchEvent(new CustomEvent('ucan:shared-object-state', { detail:event }));
    }
    state.eventsReceived += 1;
  }

  function queueAction(type, payload = {}) {
    state.actionQueue.push({ type, payload });
    if (state.actionQueue.length > 24) state.actionQueue.splice(0, state.actionQueue.length - 24);
    synchronize();
  }

  async function synchronize() {
    if (state.syncing || !state.user) return;
    const pose = localPose();
    if (!pose) return;
    state.syncing = true;
    const actions = state.actionQueue.splice(0, 12);
    try {
      const data = await request({
        method:'POST',
        body:JSON.stringify({ clientId:state.clientId, ...pose, since:state.latestSequence, actions })
      });
      state.syncs += 1;
      state.eventsSent += actions.length;
      reconcile(data.participants || []);
      for (const event of data.events || []) processEvent(event);
      state.latestSequence = Math.max(state.latestSequence, Number(data.latestSequence || 0));
      state.lastError = null;
    } catch (error) {
      state.failures += 1;
      state.actionQueue.unshift(...actions);
      state.lastError = { stage:'sync', message:String(error?.message || error), at:new Date().toISOString() };
    } finally {
      state.syncing = false;
      updateAudit();
    }
  }

  function updateOnlinePanel() {
    const count = document.getElementById('ucanOnlineCount');
    if (count) count.textContent = String(state.participants.length + 1);
    const list = document.getElementById('ucanOnlineList');
    if (!list) return;
    list.textContent = '';
    const people = [{ ...state.user, area:state.lastPose?.area || 'Campus', device:state.device, inXR:state.inXR, self:true }, ...state.participants];
    for (const person of people) {
      const row = document.createElement('div');
      row.className = 'ucan-online-person';
      const mode = person.inXR || person.device === 'quest' ? 'VR' : person.device === 'mobile' ? 'Móvil' : 'Browser';
      row.textContent = `${person.displayName || person.username || 'Participante'}${person.self ? ' (usted)' : ''} · ${person.area || 'Campus'} · ${mode}`;
      list.appendChild(row);
    }
  }

  function ensurePanel() {
    if (state.panel) return;
    const style = document.createElement('style');
    style.textContent = `#ucanUnifiedWorldV311{position:fixed;right:16px;bottom:16px;z-index:75;width:min(390px,calc(100vw - 32px));display:none;background:rgba(5,30,27,.96);border:2px solid #fed141;border-radius:16px;padding:12px;color:#fff;box-shadow:0 20px 70px rgba(0,0,0,.45)}#ucanUnifiedWorldV311.open{display:block}#ucanUnifiedWorldV311 textarea{width:100%;min-height:66px;margin:8px 0;background:#fff;color:#10251f}#ucanUnifiedWorldV311 .actions{display:flex;flex-wrap:wrap;gap:6px}#ucanUnifiedWorldV311 .feed{max-height:130px;overflow:auto;margin-top:8px;padding:7px;background:rgba(255,255,255,.08);font-size:12px}#ucanUnifiedWorldV311 .head{display:flex;justify-content:space-between;align-items:center}`;
    document.head.appendChild(style);
    const panel = document.createElement('section');
    panel.id = 'ucanUnifiedWorldV311';
    panel.innerHTML = `<div class="head"><strong>Mundo compartido</strong><button data-close aria-label="Cerrar">×</button></div><textarea aria-label="Mensaje para participantes" placeholder="Escriba un mensaje para esta área"></textarea><div class="actions"><button data-send>Enviar</button><button data-action="wave">👋 Saludar</button><button data-action="raise-hand">✋ Mano</button><button data-action="clap">👏 Aplaudir</button><button data-reaction="👍">👍</button><button data-reaction="❤️">❤️</button></div><div class="feed" aria-live="polite"></div>`;
    document.body.appendChild(panel);
    state.panel = panel;
    state.feed = panel.querySelector('.feed');
    const textarea = panel.querySelector('textarea');
    panel.querySelector('[data-close]').addEventListener('click', () => panel.classList.remove('open'));
    panel.querySelector('[data-send]').addEventListener('click', () => {
      const text = textarea.value.trim();
      if (!text) return;
      queueAction('chat', { text });
      appendFeed(`Usted: ${text}`);
      textarea.value = '';
    });
    textarea.addEventListener('keydown', event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); panel.querySelector('[data-send]').click(); } });
    for (const button of panel.querySelectorAll('[data-action]')) button.addEventListener('click', () => queueAction('gesture', { gesture:button.dataset.action }));
    for (const button of panel.querySelectorAll('[data-reaction]')) button.addEventListener('click', () => queueAction('reaction', { reaction:button.dataset.reaction }));
    const utility = document.getElementById('utilityActions') || document.querySelector('.control-grid');
    if (utility && !document.getElementById('unifiedWorldBtnV311')) {
      const button = document.createElement('button');
      button.id = 'unifiedWorldBtnV311';
      button.className = 'secondary';
      button.textContent = 'Mundo compartido';
      button.addEventListener('click', () => panel.classList.toggle('open'));
      utility.appendChild(button);
    }
  }

  function bindControllers() {
    const input = state.helper?.input;
    if (!input || input.__ucanUnifiedV311Bound) return;
    input.__ucanUnifiedV311Bound = true;
    const bind = controller => controller.onMotionControllerInitObservable?.add?.(motion => {
      const grip = motion.getComponent?.('xr-standard-squeeze');
      if (!grip || grip.__ucanUnifiedV311Bound) return;
      grip.__ucanUnifiedV311Bound = true;
      state.controllerBindings += 1;
      grip.onButtonStateChangedObservable?.add?.(() => {
        if (!grip.changes?.pressed || !grip.pressed) return;
        const handedness = controller.inputSource?.handedness || motion.handedness;
        queueAction('gesture', { gesture:handedness === 'left' ? 'wave' : 'raise-hand' });
      });
    });
    for (const controller of input.controllers || []) bind(controller);
    input.onControllerAddedObservable?.add?.(bind);
  }

  function installFocusSharing() {
    state.scene.onPointerObservable?.add?.(info => {
      if (info.type !== B.PointerEventTypes.POINTERPICK) return;
      const mesh = info.pickInfo?.pickedMesh;
      if (!mesh || !mesh.isPickable) return;
      const metadata = mesh.metadata || {};
      if (!(metadata.livePanel || metadata.livePanelKey || metadata.readableSign || metadata.celestialObject || metadata.celestialId)) return;
      const position = info.pickInfo?.pickedPoint || mesh.getAbsolutePosition?.() || mesh.position;
      queueAction('focus', {
        objectId:String(metadata.livePanelKey || metadata.celestialId || mesh.uniqueId),
        title:String(metadata.title || metadata.livePanelKey || mesh.name || 'Objeto'),
        category:metadata.celestialObject ? 'astronomía' : 'información',
        position:{ x:position.x, y:position.y, z:position.z }
      });
    });
  }

  function frame() {
    for (const record of state.remotes.values()) {
      const previous = record.avatar.root.position.clone();
      record.avatar.root.position = B.Vector3.Lerp(record.avatar.root.position, record.target, .2);
      let delta = record.rotationY - record.avatar.root.rotation.y;
      while (delta > Math.PI) delta -= Math.PI * 2;
      while (delta < -Math.PI) delta += Math.PI * 2;
      record.avatar.root.rotation.y += delta * .2;
      record.avatar.animate?.(B.Vector3.DistanceSquared(previous, record.avatar.root.position) > .000015, performance.now() / 1000);
      forceVisible(record);
    }
    updateGestures();
    for (const camera of [state.scene?.activeCamera,state.helper?.baseExperience?.camera,...(state.helper?.baseExperience?.camera?.rigCameras || [])].filter(Boolean)) camera.layerMask = ALL_LAYERS;
  }

  function updateAudit() {
    window.__UCAN_UNIFIED_WORLD_V311__ = {
      version:VERSION,
      revision:REVISION,
      build:BUILD,
      installed:state.installed,
      oneScene:true,
      sceneIdentity:state.scene?.uid || state.scene?.uniqueId || null,
      sameSceneBrowserVr:true,
      browserToVr:true,
      vrToBrowser:true,
      persistentAccounts:true,
      persistentAvatars:true,
      clientId:state.clientId,
      device:state.device,
      inXR:state.inXR,
      room:state.room,
      participants:state.participants.length,
      remoteAvatars:state.remotes.size,
      syncs:state.syncs,
      failures:state.failures,
      eventsSent:state.eventsSent,
      eventsReceived:state.eventsReceived,
      controllerBindings:state.controllerBindings,
      lastPose:state.lastPose,
      lastError:state.lastError,
      sendChat:text => queueAction('chat', { text }),
      gesture:gesture => queueAction('gesture', { gesture }),
      reaction:reaction => queueAction('reaction', { reaction }),
      refresh:synchronize,
      getState:() => ({ installed:state.installed, oneScene:true, device:state.device, inXR:state.inXR, room:state.room, participants:state.participants.length, remoteAvatars:state.remotes.size, syncs:state.syncs, failures:state.failures, eventsSent:state.eventsSent, eventsReceived:state.eventsReceived, lastError:state.lastError })
    };
  }

  async function install() {
    if (state.installed) return true;
    state.scene = window.__UCAN_API__?.getScene?.() || null;
    state.helper = window.__UCAN_XR_HELPER__ || null;
    state.user = window.__UCAN_IDENTITY__?.getUser?.() || null;
    if (!state.scene || !state.user || !window.UCANAvatar) return false;
    state.clientId = getClientId();
    state.device = detectDevice();
    state.installed = true;
    window.__UCAN_LEGACY_PRESENCE_DISABLED_V307__ = true;
    ensurePanel();
    suppressLegacyRemotes();
    bindControllers();
    installFocusSharing();
    state.scene.onBeforeRenderObservable.add(() => {
      try { frame(); } catch (error) { state.lastError = { stage:'frame', message:String(error?.message || error), at:new Date().toISOString() }; }
    });
    state.helper?.baseExperience?.onStateChangedObservable?.add?.(() => {
      state.inXR = xrActive();
      bindControllers();
      synchronize();
      updateAudit();
    });
    window.addEventListener('beforeunload', () => fetch(API, { method:'DELETE', credentials:'same-origin', keepalive:true, headers:{ 'Content-Type':'application/json' }, body:JSON.stringify({ clientId:state.clientId }) }).catch(() => {}));
    window.setInterval(synchronize, 650);
    synchronize();
    updateAudit();
    window.__UCAN_API__?.setStatus?.('V311 activo: browser y VR comparten una sola escena, usuarios e interacción.');
    console.info('[UCAN V311 R15] Mundo unificado instalado.');
    return true;
  }

  let attempts = 0;
  const timer = window.setInterval(() => {
    attempts += 1;
    install().then(done => { if (done || attempts >= 600) window.clearInterval(timer); }).catch(error => {
      state.lastError = { stage:'install', message:String(error?.message || error), at:new Date().toISOString() };
      updateAudit();
      if (attempts >= 600) window.clearInterval(timer);
    });
  }, 100);

  updateAudit();
})();
