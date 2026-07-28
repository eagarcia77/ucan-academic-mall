(() => {
  'use strict';

  const B = window.BABYLON;
  if (!B) return;

  const VERSION = 'V308';
  const BUILD = 'V308-20260728-SINGLE-SCENE-CROSS-ENV-INTERACTION';
  const API_BASE = '/api/world-v308';
  const XR_STATE = B.WebXRState || Object.freeze({ NOT_IN_XR:0, ENTERING_XR:1, IN_XR:2, EXITING_XR:3 });
  const state = {
    installed:false,
    scene:null,
    helper:null,
    user:null,
    clientId:'',
    device:'browser',
    latestSequence:0,
    room:'CAMPUS',
    polling:false,
    pollCount:0,
    eventsReceived:0,
    eventsSent:0,
    chatReceived:0,
    gesturesReceived:0,
    reactionsReceived:0,
    focusReceived:0,
    controllerBindings:0,
    sharedScene:false,
    gestureStates:new Map(),
    transientNodes:new Set(),
    lastFocusSentAt:0,
    lastError:null
  };

  function apiClientId() {
    return window.__UCAN_PRESENCE_XR_V307__?.getState?.().clientId || '';
  }

  function detectDevice() {
    const presence = window.__UCAN_PRESENCE_XR_V307__?.getState?.();
    if (presence?.device) return presence.device;
    const text = navigator.userAgent || '';
    if (/OculusBrowser|Meta Quest|Quest/i.test(text)) return 'quest';
    if (/Android|iPhone|iPad|Mobile/i.test(text)) return 'mobile';
    return 'browser';
  }

  function inXR() {
    const value = state.helper?.baseExperience?.state;
    return value === XR_STATE.ENTERING_XR || value === XR_STATE.IN_XR;
  }

  function normalizeRoom(value) {
    const text = String(value || 'Campus').trim().toUpperCase();
    const match = text.match(/^(SV-20[1-5]|ANF-301|CAFETER[IÍ]A|BIBLIOTECA|TERRAZA|PISO [123]|PATIO)/);
    if (!match) return 'CAMPUS';
    return match[1].replace('CAFETERIA', 'CAFETERÍA');
  }

  function currentRoom() {
    const presence = window.__UCAN_PRESENCE_XR_V307__?.getState?.();
    return normalizeRoom(presence?.lastPose?.area || document.getElementById('currentLocation')?.textContent || 'Campus');
  }

  async function request(url, options = {}) {
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

  function rootForClient(clientId) {
    return (state.scene?.transformNodes || []).find(node => node?.metadata?.presenceClientIdV307 === clientId && node.isEnabled?.() !== false) || null;
  }

  function childByName(root, pattern) {
    return (root?.getChildMeshes?.() || []).find(mesh => pattern.test(String(mesh.name || ''))) || null;
  }

  function makeBubble(root, text, options = {}) {
    if (!root || !text) return null;
    const bubbleRoot = new B.TransformNode(`interacción V308 ${Date.now()}`, state.scene);
    bubbleRoot.parent = root;
    bubbleRoot.position.set(0, Number(options.height || 3.85), 0);
    const texture = new B.DynamicTexture(`texto interacción V308 ${Date.now()}`, { width:1024, height:320 }, state.scene, false);
    const ctx = texture.getContext();
    ctx.clearRect(0, 0, 1024, 320);
    ctx.fillStyle = options.background || 'rgba(4,34,31,.94)';
    ctx.fillRect(20, 20, 984, 280);
    ctx.strokeStyle = options.border || '#fed141';
    ctx.lineWidth = 10;
    ctx.strokeRect(25, 25, 974, 270);
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = options.emoji ? 'bold 150px Segoe UI Emoji, Arial' : 'bold 54px Segoe UI, Arial';
    const value = String(text).slice(0, options.emoji ? 4 : 120);
    if (options.emoji) ctx.fillText(value, 512, 160);
    else {
      const words = value.split(/\s+/);
      const lines = [];
      let line = '';
      for (const word of words) {
        const next = line ? `${line} ${word}` : word;
        if (ctx.measureText(next).width > 900 && line) { lines.push(line); line = word; }
        else line = next;
      }
      if (line) lines.push(line);
      const visible = lines.slice(0, 3);
      const start = 160 - ((visible.length - 1) * 34);
      visible.forEach((item, index) => ctx.fillText(item, 512, start + index * 68));
    }
    texture.update(false);
    const material = new B.StandardMaterial(`material interacción V308 ${Date.now()}`, state.scene);
    material.diffuseTexture = texture;
    material.emissiveTexture = texture;
    material.disableLighting = true;
    material.backFaceCulling = true;
    material.useAlphaFromDiffuseTexture = true;
    const plane = B.MeshBuilder.CreatePlane(`burbuja interacción V308 ${Date.now()}`, {
      width:Number(options.width || 3.3),
      height:Number(options.heightMesh || 1.05),
      sideOrientation:B.Mesh.FRONTSIDE
    }, state.scene);
    plane.parent = bubbleRoot;
    plane.billboardMode = B.Mesh.BILLBOARDMODE_ALL;
    plane.material = material;
    plane.isPickable = false;
    plane.checkCollisions = false;
    plane.renderingGroupId = 9;
    plane.layerMask = 0x0fffffff;
    state.transientNodes.add(bubbleRoot);
    window.setTimeout(() => {
      state.transientNodes.delete(bubbleRoot);
      try { texture.dispose(); material.dispose(); plane.dispose(); bubbleRoot.dispose(); } catch (_) {}
    }, Number(options.duration || 6500));
    return bubbleRoot;
  }

  function startGesture(clientId, gesture) {
    const root = rootForClient(clientId);
    if (!root) return false;
    const left = childByName(root, /avatar-brazo-i/i);
    const right = childByName(root, /avatar-brazo-d/i);
    if (!left && !right) return false;
    state.gestureStates.set(clientId, {
      root,
      left,
      right,
      gesture,
      started:performance.now(),
      duration:gesture === 'clap' ? 2400 : 3200,
      leftBase:left ? left.rotation.clone() : null,
      rightBase:right ? right.rotation.clone() : null
    });
    return true;
  }

  function updateGestures() {
    const time = performance.now();
    for (const [clientId, item] of state.gestureStates) {
      const elapsed = time - item.started;
      const t = Math.min(1, elapsed / item.duration);
      const pulse = Math.sin(elapsed / 120);
      if (item.gesture === 'wave' && item.right) {
        item.right.rotation.x = item.rightBase.x + pulse * 0.34;
        item.right.rotation.z = item.rightBase.z - 1.55;
      } else if (item.gesture === 'raise-hand' && item.right) {
        item.right.rotation.x = item.rightBase.x;
        item.right.rotation.z = item.rightBase.z - 2.45;
      } else if (item.gesture === 'clap' && item.left && item.right) {
        const amount = 0.75 + Math.abs(pulse) * 0.5;
        item.left.rotation.z = item.leftBase.z - amount;
        item.right.rotation.z = item.rightBase.z + amount;
        item.left.rotation.x = item.leftBase.x - 0.8;
        item.right.rotation.x = item.rightBase.x - 0.8;
      } else if (item.gesture === 'point' && item.right) {
        item.right.rotation.x = item.rightBase.x - 1.45;
        item.right.rotation.z = item.rightBase.z - 0.25;
      }
      if (t >= 1) {
        if (item.left && item.leftBase) item.left.rotation.copyFrom(item.leftBase);
        if (item.right && item.rightBase) item.right.rotation.copyFrom(item.rightBase);
        state.gestureStates.delete(clientId);
      }
    }
  }

  function focusMarker(event) {
    const position = event.payload?.position;
    if (!position) return;
    const root = new B.TransformNode(`foco compartido V308 ${event.id}`, state.scene);
    root.position.set(position.x, position.y, position.z);
    const material = new B.StandardMaterial(`material foco V308 ${event.id}`, state.scene);
    material.diffuseColor = B.Color3.FromHexString('#fed141');
    material.emissiveColor = B.Color3.FromHexString('#fed141');
    material.disableLighting = true;
    const ring = B.MeshBuilder.CreateTorus(`anillo foco V308 ${event.id}`, { diameter:1.25, thickness:0.085, tessellation:36 }, state.scene);
    ring.parent = root;
    ring.rotation.x = Math.PI / 2;
    ring.material = material;
    ring.isPickable = false;
    ring.layerMask = 0x0fffffff;
    const labelTexture = new B.DynamicTexture(`etiqueta foco V308 ${event.id}`, { width:900, height:180 }, state.scene, false);
    const ctx = labelTexture.getContext();
    ctx.fillStyle = 'rgba(4,34,31,.94)'; ctx.fillRect(0, 0, 900, 180);
    ctx.fillStyle = '#ffffff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = 'bold 42px Segoe UI, Arial';
    ctx.fillText(`${event.displayName}: ${event.payload.title || 'Mire aquí'}`.slice(0, 70), 450, 90);
    labelTexture.update(false);
    const labelMaterial = new B.StandardMaterial(`material etiqueta foco V308 ${event.id}`, state.scene);
    labelMaterial.diffuseTexture = labelTexture; labelMaterial.emissiveTexture = labelTexture; labelMaterial.disableLighting = true; labelMaterial.backFaceCulling = true;
    const label = B.MeshBuilder.CreatePlane(`etiqueta foco V308 ${event.id}`, { width:3.7, height:0.74, sideOrientation:B.Mesh.FRONTSIDE }, state.scene);
    label.parent = root; label.position.y = 1.25; label.billboardMode = B.Mesh.BILLBOARDMODE_ALL; label.material = labelMaterial; label.isPickable = false; label.layerMask = 0x0fffffff;
    const started = performance.now();
    const observer = state.scene.onBeforeRenderObservable.add(() => {
      const phase = (performance.now() - started) / 420;
      root.scaling.setAll(1 + Math.sin(phase) * 0.12);
      root.rotation.y += 0.018;
    });
    state.transientNodes.add(root);
    window.setTimeout(() => {
      state.scene.onBeforeRenderObservable.remove(observer);
      state.transientNodes.delete(root);
      try { ring.dispose(); label.dispose(); material.dispose(); labelTexture.dispose(); labelMaterial.dispose(); root.dispose(); } catch (_) {}
    }, 6500);
  }

  function processEvent(event) {
    if (!event || event.clientId === state.clientId) return;
    const root = rootForClient(event.clientId);
    if (event.type === 'chat') {
      state.chatReceived += 1;
      if (root) makeBubble(root, `${event.displayName}: ${event.payload?.text || ''}`, { duration:8000 });
      appendFeed(`${event.displayName}: ${event.payload?.text || ''}`);
    } else if (event.type === 'gesture') {
      state.gesturesReceived += 1;
      startGesture(event.clientId, event.payload?.gesture || 'wave');
      if (root) makeBubble(root, gestureLabel(event.payload?.gesture), { width:2.25, heightMesh:0.72, duration:3000 });
    } else if (event.type === 'reaction') {
      state.reactionsReceived += 1;
      if (root) makeBubble(root, event.payload?.reaction || '👍', { emoji:true, width:1.5, heightMesh:1.0, duration:3500, background:'rgba(4,34,31,.72)' });
    } else if (event.type === 'focus') {
      state.focusReceived += 1;
      focusMarker(event);
    } else if (event.type === 'object-state') {
      window.dispatchEvent(new CustomEvent('ucan:shared-object-state', { detail:event }));
    }
    state.eventsReceived += 1;
  }

  function gestureLabel(gesture) {
    return ({ wave:'👋 Saludo', 'raise-hand':'✋ Mano levantada', clap:'👏 Aplauso', point:'👉 Señalando' })[gesture] || '👋 Saludo';
  }

  async function poll() {
    if (state.polling || !state.installed) return;
    state.polling = true;
    try {
      state.room = currentRoom();
      const data = await request(`${API_BASE}/events?since=${state.latestSequence}&room=${encodeURIComponent(state.room)}`);
      for (const event of data.events || []) {
        state.latestSequence = Math.max(state.latestSequence, Number(event.sequence || 0));
        processEvent(event);
      }
      state.latestSequence = Math.max(state.latestSequence, Number(data.latestSequence || 0));
      state.pollCount += 1;
      updateAudit();
    } catch (error) {
      state.lastError = { stage:'poll', message:String(error?.message || error), at:new Date().toISOString() };
      updateAudit();
    } finally {
      state.polling = false;
    }
  }

  async function sendEvent(type, payload = {}) {
    state.room = currentRoom();
    try {
      const result = await request(`${API_BASE}/event`, {
        method:'POST',
        body:JSON.stringify({
          clientId:state.clientId,
          type,
          room:state.room,
          device:state.device,
          inXR:inXR(),
          payload
        })
      });
      state.latestSequence = Math.max(state.latestSequence, Number(result.latestSequence || 0));
      state.eventsSent += 1;
      updateAudit();
      return result;
    } catch (error) {
      state.lastError = { stage:'send', message:String(error?.message || error), at:new Date().toISOString() };
      updateAudit();
      throw error;
    }
  }

  function injectInterface() {
    if (document.getElementById('ucanInteractionV308Panel')) return;
    const style = document.createElement('style');
    style.textContent = `
      #ucanInteractionV308Button{background:#fed141;color:#17342e;font-weight:900}
      #ucanInteractionV308Panel{position:fixed;right:18px;bottom:18px;z-index:58;width:min(360px,calc(100vw - 36px));display:none;background:rgba(5,22,24,.96);color:#fff;border:2px solid #007b5f;border-radius:16px;padding:12px;box-shadow:0 18px 60px #0009}
      #ucanInteractionV308Panel.open{display:block}.v308-head{display:flex;align-items:center;justify-content:space-between;gap:8px}.v308-head h3{margin:0;font-size:15px}.v308-actions{display:flex;flex-wrap:wrap;gap:6px;margin:10px 0}.v308-actions button{font-size:12px;padding:7px 9px}.v308-chat{display:grid;grid-template-columns:1fr auto;gap:6px}.v308-chat input{min-width:0;background:#fff;color:#152d30}.v308-feed{margin-top:8px;max-height:120px;overflow:auto;font-size:12px;color:#d8f3eb}.v308-feed div{padding:4px 0;border-bottom:1px solid #ffffff18}.v308-room{font-size:11px;color:#aee8d7;margin-top:6px}
    `;
    document.head.appendChild(style);
    const button = document.createElement('button');
    button.id = 'ucanInteractionV308Button';
    button.textContent = 'Interacción';
    const target = document.querySelector('#hud .grid') || document.getElementById('utilityActions') || document.body;
    target.appendChild(button);
    const panel = document.createElement('section');
    panel.id = 'ucanInteractionV308Panel';
    panel.innerHTML = `<div class="v308-head"><h3>Interacción compartida V308</h3><button id="ucanInteractionV308Close" aria-label="Cerrar">×</button></div><div class="v308-room" id="ucanInteractionV308Room">Campus</div><div class="v308-actions"><button data-gesture="wave">👋 Saludar</button><button data-gesture="raise-hand">✋ Levantar mano</button><button data-gesture="clap">👏 Aplaudir</button><button data-reaction="👍">👍</button><button data-reaction="❤️">❤️</button><button id="ucanInteractionV308Voice">🎙 Audio de sala</button></div><div class="v308-chat"><input id="ucanInteractionV308Input" maxlength="240" placeholder="Mensaje para participantes en esta área"><button id="ucanInteractionV308Send">Enviar</button></div><div class="v308-feed" id="ucanInteractionV308Feed" aria-live="polite"></div>`;
    document.body.appendChild(panel);
    button.addEventListener('click', () => panel.classList.toggle('open'));
    document.getElementById('ucanInteractionV308Close').addEventListener('click', () => panel.classList.remove('open'));
    panel.querySelectorAll('[data-gesture]').forEach(item => item.addEventListener('click', () => sendEvent('gesture', { gesture:item.dataset.gesture }).catch(showError)));
    panel.querySelectorAll('[data-reaction]').forEach(item => item.addEventListener('click', () => sendEvent('reaction', { reaction:item.dataset.reaction }).catch(showError)));
    const sendChat = () => {
      const input = document.getElementById('ucanInteractionV308Input');
      const text = input.value.trim();
      if (!text) return;
      sendEvent('chat', { text }).then(() => { appendFeed(`Usted: ${text}`); input.value = ''; }).catch(showError);
    };
    document.getElementById('ucanInteractionV308Send').addEventListener('click', sendChat);
    document.getElementById('ucanInteractionV308Input').addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); sendChat(); } });
    document.getElementById('ucanInteractionV308Voice').addEventListener('click', () => {
      const room = currentRoom();
      window.__UCAN_VOICE__?.joinRoom?.(room);
      window.__UCAN_VOICE__?.openPanel?.();
    });
  }

  function appendFeed(text) {
    const feed = document.getElementById('ucanInteractionV308Feed');
    if (!feed) return;
    const row = document.createElement('div');
    row.textContent = String(text || '').slice(0, 280);
    feed.prepend(row);
    while (feed.childElementCount > 12) feed.lastElementChild.remove();
  }

  function showError(error) {
    appendFeed(`Error: ${error?.message || error}`);
  }

  function updateRoomLabel() {
    const label = document.getElementById('ucanInteractionV308Room');
    if (label) label.textContent = `Área compartida: ${currentRoom()} · ${inXR() ? 'VR' : 'Browser'}`;
  }

  function interactiveMetadata(mesh) {
    let current = mesh;
    const metadata = {};
    for (let depth = 0; current && depth < 8; depth += 1, current = current.parent) Object.assign(metadata, current.metadata || {});
    return metadata;
  }

  function installSharedFocus() {
    state.scene.onPointerObservable.add(pointerInfo => {
      if (pointerInfo.type !== B.PointerEventTypes.POINTERPICK) return;
      const mesh = pointerInfo.pickInfo?.pickedMesh;
      if (!mesh) return;
      const metadata = interactiveMetadata(mesh);
      const qualifies = metadata.livePanel || metadata.readableSign || metadata.celestialObject || metadata.celestialId || metadata.terraceInteractiveV305R9 || metadata.tropicalInteractive;
      if (!qualifies) return;
      const now = performance.now();
      if (now - state.lastFocusSentAt < 1200) return;
      state.lastFocusSentAt = now;
      let position = null;
      try { position = mesh.getBoundingInfo().boundingSphere.centerWorld; } catch (_) { position = mesh.getAbsolutePosition?.() || mesh.position; }
      if (!position) return;
      sendEvent('focus', {
        objectId:String(metadata.livePanelKey || metadata.celestialId || metadata.tropicalId || mesh.name || mesh.uniqueId),
        title:String(metadata.title || metadata.livePanelKey || metadata.celestialData?.name || mesh.name || 'Objeto compartido'),
        category:String(metadata.category || metadata.tropicalType || 'Contenido'),
        position:{ x:position.x, y:position.y, z:position.z }
      }).catch(() => {});
    });
  }

  function bindController(controller) {
    const handedness = controller?.inputSource?.handedness || 'none';
    const bind = motion => {
      let ids = [];
      try { ids = motion.getComponentIds?.() || Object.keys(motion.components || {}); } catch (_) { ids = Object.keys(motion.components || {}); }
      for (const id of ids) {
        if (!/squeeze|grip/i.test(String(id))) continue;
        const component = motion.getComponent?.(id) || motion.components?.[id];
        if (!component || component.__ucanV308Bound) continue;
        component.__ucanV308Bound = true;
        state.controllerBindings += 1;
        component.onButtonStateChangedObservable?.add?.(() => {
          if (!component.changes?.pressed || !component.pressed) return;
          const gesture = handedness === 'left' ? 'wave' : 'raise-hand';
          sendEvent('gesture', { gesture }).catch(() => {});
        });
      }
    };
    if (controller.motionController) bind(controller.motionController);
    controller.onMotionControllerInitObservable?.add?.(bind);
  }

  function showXrHint() {
    const camera = state.helper?.baseExperience?.camera || state.scene?.activeCamera;
    if (!camera) return;
    let origin = camera.globalPosition?.clone?.() || camera.position?.clone?.();
    let direction = camera.getForwardRay?.(1)?.direction?.clone?.() || new B.Vector3(0, 0, 1);
    direction.normalize();
    const root = new B.TransformNode(`ayuda interacción XR V308 ${Date.now()}`, state.scene);
    root.position.copyFrom(origin.add(direction.scale(2.4)));
    const texture = new B.DynamicTexture(`texto ayuda XR V308 ${Date.now()}`, { width:1200, height:400 }, state.scene, false);
    const ctx = texture.getContext();
    ctx.fillStyle = 'rgba(4,34,31,.95)'; ctx.fillRect(0, 0, 1200, 400);
    ctx.strokeStyle = '#fed141'; ctx.lineWidth = 12; ctx.strokeRect(8, 8, 1184, 384);
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = 'bold 54px Segoe UI, Arial';
    ctx.fillText('Interacción entre Browser y VR', 600, 100);
    ctx.font = '38px Segoe UI, Arial';
    ctx.fillText('Agarre izquierdo: saludar', 600, 205);
    ctx.fillText('Agarre derecho: levantar la mano', 600, 275);
    texture.update(false);
    const material = new B.StandardMaterial(`material ayuda XR V308 ${Date.now()}`, state.scene);
    material.diffuseTexture = texture; material.emissiveTexture = texture; material.disableLighting = true; material.backFaceCulling = true;
    const plane = B.MeshBuilder.CreatePlane(`ayuda XR V308 ${Date.now()}`, { width:4.5, height:1.5, sideOrientation:B.Mesh.FRONTSIDE }, state.scene);
    plane.parent = root; plane.billboardMode = B.Mesh.BILLBOARDMODE_ALL; plane.material = material; plane.isPickable = false; plane.layerMask = 0x0fffffff;
    window.setTimeout(() => { try { plane.dispose(); material.dispose(); texture.dispose(); root.dispose(); } catch (_) {} }, 7500);
  }

  function installControllers() {
    const input = state.helper?.input;
    if (!input) return;
    for (const controller of input.controllers || []) bindController(controller);
    input.onControllerAddedObservable?.add?.(bindController);
  }

  function updateAudit() {
    state.sharedScene = state.scene === window.__UCAN_API__?.getScene?.();
    window.__UCAN_CROSS_ENV_V308__ = {
      version:VERSION,
      build:BUILD,
      installed:state.installed,
      oneBabylonScene:true,
      sharedSceneInstance:state.sharedScene,
      sameGeometryBrowserVr:true,
      sameUsersBrowserVr:true,
      browserToVrInteraction:true,
      vrToBrowserInteraction:true,
      voiceAcrossEnvironments:Boolean(window.__UCAN_VOICE__ || window.__UCAN_VOICE_XR_V306__),
      chatAcrossEnvironments:true,
      gestureAcrossEnvironments:true,
      reactionAcrossEnvironments:true,
      sharedObjectFocus:true,
      presenceVersion:window.__UCAN_PRESENCE_XR_V307__?.version || 'V307',
      room:state.room,
      clientId:state.clientId,
      device:state.device,
      inXR:inXR(),
      latestSequence:state.latestSequence,
      eventsSent:state.eventsSent,
      eventsReceived:state.eventsReceived,
      controllerBindings:state.controllerBindings,
      lastError:state.lastError,
      sendChat:text => sendEvent('chat', { text }),
      sendGesture:gesture => sendEvent('gesture', { gesture }),
      sendReaction:reaction => sendEvent('reaction', { reaction }),
      shareFocus:(objectId, title, position, category='Contenido') => sendEvent('focus', { objectId, title, position, category }),
      shareObjectState:(objectId, title, sharedState) => sendEvent('object-state', { objectId, title, state:sharedState }),
      refresh:poll,
      getState:() => ({
        installed:state.installed,
        sharedSceneInstance:state.sharedScene,
        room:state.room,
        clientId:state.clientId,
        device:state.device,
        inXR:inXR(),
        eventsSent:state.eventsSent,
        eventsReceived:state.eventsReceived,
        controllerBindings:state.controllerBindings,
        remoteAvatars:window.__UCAN_PRESENCE_XR_V307__?.getState?.().remoteAvatars || 0,
        lastError:state.lastError
      })
    };
  }

  async function install() {
    if (state.installed) return true;
    state.scene = window.__UCAN_API__?.getScene?.() || null;
    state.helper = window.__UCAN_XR_HELPER__ || null;
    state.user = window.__UCAN_IDENTITY__?.getUser?.() || null;
    state.clientId = apiClientId();
    if (!state.scene || !state.helper || !state.user || !state.clientId) return false;
    state.device = detectDevice();
    state.room = currentRoom();
    try {
      const config = await request(`${API_BASE}/config`);
      state.latestSequence = Number(config.latestSequence || 0);
    } catch (error) {
      state.lastError = { stage:'config', message:String(error?.message || error), at:new Date().toISOString() };
      return false;
    }
    state.installed = true;
    injectInterface();
    installSharedFocus();
    installControllers();
    state.scene.onBeforeRenderObservable.add(() => {
      updateGestures();
      if (state.scene.getFrameId() % 90 === 0) updateRoomLabel();
    });
    state.helper.baseExperience?.onStateChangedObservable?.add?.(current => {
      state.room = currentRoom();
      if (current === XR_STATE.IN_XR) {
        installControllers();
        window.setTimeout(showXrHint, 800);
      }
      poll();
    });
    window.setInterval(poll, 700);
    poll();
    updateRoomLabel();
    updateAudit();
    window.__UCAN_API__?.setStatus?.('V308 activo: browser y Meta Quest comparten usuarios, voz, chat, gestos y objetos señalados.');
    console.info('[UCAN V308] Interacción cruzada browser/WebXR instalada.');
    return true;
  }

  let attempts = 0;
  const timer = window.setInterval(() => {
    attempts += 1;
    install().then(done => {
      if (done || attempts >= 600) window.clearInterval(timer);
    }).catch(error => {
      state.lastError = { stage:'install', message:String(error?.message || error), at:new Date().toISOString() };
      updateAudit();
      if (attempts >= 600) window.clearInterval(timer);
    });
  }, 100);

  updateAudit();
})();
