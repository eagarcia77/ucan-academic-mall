(() => {
  'use strict';

  const VERSION = 'V292';
  const BUILD = 'V292-20260721-UNIVERSAL-SIGN-WINDOW-CLOCK';
  const B = window.BABYLON;
  if (!B) return;

  const XR_STATE = B.WebXRState || Object.freeze({ NOT_IN_XR:0, ENTERING_XR:1, IN_XR:2, EXITING_XR:3 });
  const LEVEL_ROOFTOP = 27.2;
  const RAY_LENGTH = 265;
  const CELESTIAL_ANGLE_LIMIT = 7.5 * Math.PI / 180;

  const state = {
    scene:null,
    helper:null,
    installed:false,
    controllers:new Map(),
    root:null,
    texture:null,
    html:null,
    htmlTitle:null,
    htmlImage:null,
    htmlBody:null,
    current:null,
    visible:false,
    lastFrame:0,
    lastScan:0,
    opened:0,
    closed:0,
    controllerOpens:0,
    pointerOpens:0,
    joystickOpens:0,
    celestialOpens:0,
    panelOpens:0,
    clockMoved:false,
    clockPosition:null,
    legacyWindowsSuppressed:0,
    lastError:null
  };

  const finite = value => Number.isFinite(Number(value));
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  function xrActive() {
    try {
      if (window.__UCAN_UNIFIED_XR_AUDIT__?.getState?.()?.inXR === true) return true;
    } catch (_) {}
    const current = state.helper?.baseExperience?.state;
    return current === XR_STATE.ENTERING_XR || current === XR_STATE.IN_XR;
  }

  function activeCamera() {
    return state.scene?.activeCamera || window.__UCAN_API__?.getCamera?.() || null;
  }

  function metadataChain(mesh) {
    const merged = {};
    let current = mesh;
    for (let depth = 0; current && depth < 6; depth += 1, current = current.parent) Object.assign(merged, current.metadata || {});
    return merged;
  }

  function isEnabled(mesh) {
    if (!mesh) return false;
    if (typeof mesh.isEnabled === 'function' && !mesh.isEnabled()) return false;
    if (mesh.isVisible === false || Number(mesh.visibility ?? 1) <= 0) return false;
    return true;
  }

  function isUniversalClose(mesh) {
    return Boolean(metadataChain(mesh).ucanUniversalCloseV292);
  }

  function isLivePanel(mesh) {
    if (!isEnabled(mesh)) return false;
    const metadata = metadataChain(mesh);
    return Boolean(metadata.livePanel || metadata.livePanelKey) || /panel clima|agenda astronómica|fase lunar|mapa celeste|calendario astronómico|reloj san germán/i.test(String(mesh.name || ''));
  }

  function isCelestial(mesh) {
    if (!isEnabled(mesh)) return false;
    const metadata = metadataChain(mesh);
    return Boolean(metadata.celestialId || metadata.celestialData || metadata.celestialObject) || /objeto cielo|etiqueta cielo|planeta|estrella|luna|saturno|júpiter|jupiter|marte|venus|mercurio|urano|neptuno/i.test(String(mesh.name || ''));
  }

  function isInteractive(mesh) {
    return isUniversalClose(mesh) || isLivePanel(mesh) || isCelestial(mesh);
  }

  function controllerRay(controller, length = RAY_LENGTH) {
    const ray = new B.Ray(new B.Vector3(0, 0, 0), new B.Vector3(0, 0, 1), length);
    try {
      if (controller?.getWorldPointerRayToRef) {
        controller.getWorldPointerRayToRef(ray);
        ray.length = length;
        ray.direction.normalize();
        return ray;
      }
    } catch (_) {}
    const pointer = controller?.pointer || controller?.grip;
    try {
      ray.origin.copyFrom(pointer.getAbsolutePosition());
      B.Vector3.TransformNormalToRef(new B.Vector3(0, 0, 1), pointer.getWorldMatrix(), ray.direction);
      ray.direction.normalize();
    } catch (_) {}
    return ray;
  }

  function gamepad(controller) {
    return controller?.inputSource?.gamepad || controller?.motionController?.gamepadObject || controller?.motionController?.gamepad || null;
  }

  function pressedButton(button) {
    return Boolean(button?.pressed || Number(button?.value || 0) > 0.58);
  }

  function activationState(controller) {
    const motion = controller?.motionController;
    let trigger = null;
    let thumbstick = null;
    try {
      trigger = motion?.getComponentOfType?.('trigger') || motion?.getComponent?.('xr-standard-trigger') || motion?.getComponent?.('trigger');
      thumbstick = motion?.getComponentOfType?.('thumbstick') || motion?.getComponent?.('xr-standard-thumbstick') || motion?.getComponent?.('thumbstick');
    } catch (_) {}
    const pad = gamepad(controller);
    const triggerPressed = Boolean(trigger?.pressed || Number(trigger?.value || 0) > 0.58 || pressedButton(pad?.buttons?.[0]));
    const joystickPressed = Boolean(thumbstick?.pressed || pressedButton(pad?.buttons?.[3]));
    const primaryPressed = Boolean(pressedButton(pad?.buttons?.[4]) || pressedButton(pad?.buttons?.[5]));
    return { pressed:triggerPressed || joystickPressed || primaryPressed, joystickPressed, triggerPressed, primaryPressed };
  }

  function celestialCenter(mesh) {
    try {
      const center = mesh.getBoundingInfo?.().boundingSphere?.centerWorld;
      if (center) return center.clone();
    } catch (_) {}
    try { return mesh.getAbsolutePosition?.().clone?.() || mesh.absolutePosition?.clone?.(); } catch (_) {}
    return null;
  }

  function angularCelestialPick(ray) {
    let best = null;
    const seen = new Set();
    for (const mesh of state.scene?.meshes || []) {
      if (!isCelestial(mesh)) continue;
      const metadata = metadataChain(mesh);
      const id = metadata.celestialId || metadata.celestialData?.id || mesh.uniqueId;
      if (seen.has(id)) continue;
      seen.add(id);
      const center = celestialCenter(mesh);
      if (!center) continue;
      const vector = center.subtract(ray.origin);
      const distance = vector.length();
      if (!finite(distance) || distance < 1 || distance > RAY_LENGTH) continue;
      vector.scaleInPlace(1 / distance);
      const angle = Math.acos(clamp(B.Vector3.Dot(ray.direction, vector), -1, 1));
      if (angle > CELESTIAL_ANGLE_LIMIT) continue;
      const score = angle + distance * 0.000004;
      if (!best || score < best.score) best = { mesh, score, angle, distance };
    }
    return best;
  }

  function allCelestialEntries() {
    try { return window.__UCAN_INTERACTIVE_SKY__?.getObjects?.() || []; } catch (_) { return []; }
  }

  function celestialEntry(mesh) {
    const metadata = metadataChain(mesh);
    const id = metadata.celestialId || metadata.celestialData?.id;
    return metadata.celestialData || allCelestialEntries().find(entry => entry.id === id) || null;
  }

  function livePanelInfo(mesh) {
    const metadata = metadataChain(mesh);
    const name = metadata.livePanelKey || metadata.title || String(mesh.name || 'Panel informativo').replace(/\s+(?:frente|reverso)$/i, '');
    let texture = mesh.material?.diffuseTexture || mesh.material?.emissiveTexture || null;
    if (!texture) {
      const displays = state.scene?.metadata?.astronomyDisplays || {};
      const record = Object.values(displays).find(value => value?.name === name);
      texture = record?.texture || null;
    }
    let canvas = null;
    try { canvas = texture?.getContext?.()?.canvas || null; } catch (_) {}
    return { type:'panel', title:name, canvas, sourceMesh:mesh };
  }

  function celestialInfo(mesh) {
    const entry = celestialEntry(mesh);
    if (!entry) return null;
    const facts = [];
    if (entry.constellation) facts.push(`Constelación: ${entry.constellation}`);
    if (finite(entry.actualAltitude ?? entry.altitude)) facts.push(`Altitud: ${Number(entry.actualAltitude ?? entry.altitude).toFixed(1)}°`);
    if (finite(entry.azimuth)) facts.push(`Azimut: ${Number(entry.azimuth).toFixed(1)}°`);
    if (entry.phase) facts.push(String(entry.phase));
    if (entry.belowHorizon) facts.push('Actualmente está bajo el horizonte.');
    return {
      type:'celestial',
      title:entry.name || 'Objeto celeste',
      category:entry.category || entry.kind || 'Astronomía',
      summary:entry.summary || 'Información astronómica disponible.',
      facts,
      color:entry.color || '#fed141',
      id:entry.id
    };
  }

  function createMaterial(name, texture) {
    const material = new B.StandardMaterial(name, state.scene);
    material.diffuseTexture = texture;
    material.emissiveTexture = texture;
    material.disableLighting = true;
    material.backFaceCulling = true;
    material.disableDepthWrite = true;
    return material;
  }

  function createWindow3D() {
    const root = new B.TransformNode('Ventana universal V292', state.scene);
    const texture = new B.DynamicTexture('contenido ventana universal V292', { width:1024, height:640 }, state.scene, false);
    texture.updateSamplingMode?.(B.Texture.BILINEAR_SAMPLINGMODE);
    const panelMaterial = createMaterial('material ventana universal V292', texture);

    const front = B.MeshBuilder.CreatePlane('ventana universal frente V292', { width:3.05, height:1.92, sideOrientation:B.Mesh.FRONTSIDE }, state.scene);
    front.parent = root;
    front.position.z = -0.012;
    front.material = panelMaterial;
    front.isPickable = false;
    front.renderingGroupId = 5;

    const back = B.MeshBuilder.CreatePlane('ventana universal reverso V292', { width:3.05, height:1.92, sideOrientation:B.Mesh.FRONTSIDE }, state.scene);
    back.parent = root;
    back.position.z = 0.012;
    back.rotation.y = Math.PI;
    back.material = panelMaterial;
    back.isPickable = false;
    back.renderingGroupId = 5;

    const closeTexture = new B.DynamicTexture('cerrar ventana universal V292', { width:192, height:192 }, state.scene, false);
    closeTexture.hasAlpha = true;
    const closeCtx = closeTexture.getContext();
    closeCtx.clearRect(0, 0, 192, 192);
    closeCtx.fillStyle = '#b42318';
    closeCtx.beginPath(); closeCtx.arc(96, 96, 82, 0, Math.PI * 2); closeCtx.fill();
    closeCtx.strokeStyle = '#ffffff'; closeCtx.lineWidth = 10; closeCtx.stroke();
    closeCtx.fillStyle = '#ffffff'; closeCtx.font = 'bold 112px Segoe UI, Arial'; closeCtx.textAlign = 'center'; closeCtx.textBaseline = 'middle'; closeCtx.fillText('×', 96, 86);
    closeTexture.update(false);
    const closeMaterial = createMaterial('material cerrar universal V292', closeTexture);

    for (const [name, z, rotation] of [['frente', -0.04, 0], ['reverso', 0.04, Math.PI]]) {
      const close = B.MeshBuilder.CreatePlane(`botón cerrar universal ${name} V292`, { width:0.42, height:0.42, sideOrientation:B.Mesh.FRONTSIDE }, state.scene);
      close.parent = root;
      close.position.set(1.28, 0.72, z);
      close.rotation.y = rotation;
      close.material = closeMaterial;
      close.isPickable = true;
      close.checkCollisions = false;
      close.renderingGroupId = 6;
      close.metadata = { ucanUniversalCloseV292:true, readableSign:true };
    }

    root.setEnabled(false);
    state.root = root;
    state.texture = texture;
  }

  function installHtmlWindow() {
    if (document.getElementById('ucanUniversalInfoV292')) return;
    const style = document.createElement('style');
    style.textContent = `#ucanUniversalInfoV292{position:fixed;right:14px;bottom:14px;z-index:90;width:min(440px,calc(100vw - 28px));max-height:min(620px,78vh);overflow:auto;background:#071426;color:#fff;border:1px solid rgba(158,219,230,.65);border-radius:16px;box-shadow:0 22px 70px rgba(0,0,0,.58);display:none}#ucanUniversalInfoV292.open{display:block}#ucanUniversalInfoV292 header{position:sticky;top:0;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:11px 13px;background:#071426;border-bottom:1px solid rgba(255,255,255,.17);z-index:2}#ucanUniversalInfoV292 h2{font-size:18px;line-height:1.25;margin:0}#ucanUniversalCloseV292{min-width:40px;width:40px;height:38px;padding:0;border:0;border-radius:11px;background:#b42318;color:#fff;font-size:27px;font-weight:900;cursor:pointer}#ucanUniversalBodyV292{padding:12px 14px 16px;line-height:1.45;color:#e5fbff}#ucanUniversalImageV292{display:none;width:100%;height:auto;background:#f7f5ec;border-radius:9px}#ucanUniversalBodyV292 p{margin:8px 0}body.ucan-v292-xr #ucanUniversalInfoV292{display:none!important}`;
    document.head.appendChild(style);
    const panel = document.createElement('aside');
    panel.id = 'ucanUniversalInfoV292';
    panel.setAttribute('aria-hidden', 'true');
    panel.innerHTML = `<header><h2 id="ucanUniversalTitleV292">Información</h2><button id="ucanUniversalCloseV292" type="button" aria-label="Cerrar ventana">×</button></header><div id="ucanUniversalBodyV292"><img id="ucanUniversalImageV292" alt=""><div id="ucanUniversalTextV292"></div></div>`;
    document.body.appendChild(panel);
    state.html = panel;
    state.htmlTitle = panel.querySelector('#ucanUniversalTitleV292');
    state.htmlImage = panel.querySelector('#ucanUniversalImageV292');
    state.htmlBody = panel.querySelector('#ucanUniversalTextV292');
    panel.querySelector('#ucanUniversalCloseV292').addEventListener('click', closeUniversal);
    panel.addEventListener('click', event => { if (event.target === panel) closeUniversal(); });
    window.addEventListener('keydown', event => { if (event.key === 'Escape') closeUniversal(); });
  }

  function wrapText(ctx, text, x, y, maxWidth, lineHeight, maxLines) {
    const words = String(text || '').split(/\s+/).filter(Boolean);
    let line = '';
    let row = 0;
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxWidth && line) {
        ctx.fillText(line, x, y + row * lineHeight);
        row += 1;
        line = word;
        if (row >= maxLines) break;
      } else line = test;
    }
    if (line && row < maxLines) ctx.fillText(line, x, y + row * lineHeight);
  }

  function drawUniversal(info) {
    const ctx = state.texture.getContext();
    ctx.clearRect(0, 0, 1024, 640);
    ctx.fillStyle = '#071426'; ctx.fillRect(0, 0, 1024, 640);
    ctx.fillStyle = info.color || '#fed141'; ctx.fillRect(0, 0, 1024, 18);
    ctx.fillStyle = '#ffffff'; ctx.font = 'bold 48px Segoe UI, Arial'; ctx.textBaseline = 'top'; ctx.fillText(String(info.title || 'Información').slice(0, 38), 40, 34);

    if (info.type === 'panel' && info.canvas) {
      const availableX = 44, availableY = 105, availableW = 936, availableH = 485;
      const ratio = Math.min(availableW / info.canvas.width, availableH / info.canvas.height);
      const width = info.canvas.width * ratio, height = info.canvas.height * ratio;
      ctx.fillStyle = '#f7f5ec'; ctx.fillRect(availableX, availableY, availableW, availableH);
      ctx.drawImage(info.canvas, availableX + (availableW - width) / 2, availableY + (availableH - height) / 2, width, height);
    } else {
      ctx.fillStyle = '#9edbe6'; ctx.font = 'bold 27px Segoe UI, Arial'; ctx.fillText(String(info.category || 'Información del entorno'), 42, 108);
      ctx.fillStyle = '#ffffff'; ctx.font = '27px Segoe UI, Arial';
      let y = 160;
      for (const fact of (info.facts || []).slice(0, 5)) { ctx.fillText(`• ${fact}`, 48, y); y += 42; }
      ctx.fillStyle = '#e5fbff'; ctx.font = '26px Segoe UI, Arial'; wrapText(ctx, info.summary || 'Información disponible.', 48, Math.max(y + 16, 370), 920, 38, 5);
    }
    ctx.fillStyle = 'rgba(255,255,255,.76)'; ctx.font = '22px Segoe UI, Arial'; ctx.fillText('Apunte al botón × y active el gatillo o presione el joystick para cerrar.', 42, 603);
    state.texture.update(false);
  }

  function renderHtml(info) {
    state.htmlTitle.textContent = info.title || 'Información';
    if (info.type === 'panel' && info.canvas) {
      try {
        state.htmlImage.src = info.canvas.toDataURL('image/png');
        state.htmlImage.alt = `Vista ampliada de ${info.title}`;
        state.htmlImage.style.display = 'block';
      } catch (_) { state.htmlImage.style.display = 'none'; }
      state.htmlBody.innerHTML = '<p>Use el botón × para cerrar esta ventana.</p>';
    } else {
      state.htmlImage.style.display = 'none';
      const facts = (info.facts || []).map(value => `<li>${String(value).replace(/[&<>]/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[char]))}</li>`).join('');
      state.htmlBody.innerHTML = `<p><strong>${info.category || 'Información'}</strong></p>${facts ? `<ul>${facts}</ul>` : ''}<p>${String(info.summary || '')}</p>`;
    }
    state.html.classList.add('open');
    state.html.setAttribute('aria-hidden', 'false');
  }

  function placeWindow3D() {
    if (!state.visible || !state.root) return;
    const camera = activeCamera();
    if (!camera) return;
    const origin = camera.globalPosition?.clone?.() || camera.position?.clone?.();
    if (!origin) return;
    let forward;
    try { forward = camera.getForwardRay?.(1)?.direction?.clone?.(); } catch (_) {}
    if (!forward || forward.lengthSquared() < 0.001) forward = new B.Vector3(0, 0, 1);
    forward.normalize();
    const target = origin.add(forward.scale(2.75));
    target.y = origin.y - 0.10;
    state.root.position.copyFrom(target);
    const toCamera = origin.subtract(target);
    state.root.rotationQuaternion = null;
    state.root.rotation.set(0, Math.atan2(toCamera.x, toCamera.z), 0);
  }

  function suppressLegacyWindows() {
    let changed = 0;
    for (const name of ['Ventana información XR V290', 'Ventana celeste compacta V288']) {
      const node = state.scene?.getTransformNodeByName?.(name);
      if (node?.isEnabled?.()) { node.setEnabled(false); changed += 1; }
    }
    const legacyPlane = state.scene?.getMeshByName?.('panel flotante cielo optimizado V287');
    if (legacyPlane?.isEnabled?.()) { legacyPlane.setEnabled(false); changed += 1; }
    const legacyViewer = document.getElementById('livePanelViewer');
    if (legacyViewer?.classList.contains('open')) { legacyViewer.classList.remove('open'); legacyViewer.setAttribute('aria-hidden', 'true'); changed += 1; }
    const skyPanel = document.getElementById('ucanSkyExplorerV287');
    if (xrActive() && skyPanel?.classList.contains('open')) { skyPanel.classList.remove('open'); skyPanel.setAttribute('aria-hidden', 'true'); changed += 1; }
    state.legacyWindowsSuppressed += changed;
  }

  function openUniversal(info, source = 'pointer', activation = {}) {
    if (!info) return false;
    suppressLegacyWindows();
    state.current = info;
    state.visible = true;
    state.opened += 1;
    if (source === 'controller') state.controllerOpens += 1;
    else state.pointerOpens += 1;
    if (activation.joystickPressed) state.joystickOpens += 1;
    if (info.type === 'celestial') state.celestialOpens += 1;
    else state.panelOpens += 1;
    drawUniversal(info);
    if (xrActive()) {
      document.body.classList.add('ucan-v292-xr');
      state.html?.classList.remove('open');
      state.html?.setAttribute('aria-hidden', 'true');
      state.root.setEnabled(true);
      placeWindow3D();
    } else {
      document.body.classList.remove('ucan-v292-xr');
      state.root.setEnabled(false);
      renderHtml(info);
    }
    window.setTimeout(suppressLegacyWindows, 0);
    updateAudit();
    return true;
  }

  function closeUniversal() {
    if (!state.visible && !state.html?.classList.contains('open')) return;
    state.visible = false;
    state.current = null;
    state.root?.setEnabled(false);
    state.html?.classList.remove('open');
    state.html?.setAttribute('aria-hidden', 'true');
    state.closed += 1;
    updateAudit();
  }

  function handleMesh(mesh, source, activation = {}) {
    if (!mesh) return false;
    if (isUniversalClose(mesh)) { closeUniversal(); return true; }
    if (isLivePanel(mesh)) return openUniversal(livePanelInfo(mesh), source, activation);
    if (isCelestial(mesh)) return openUniversal(celestialInfo(mesh), source, activation);
    return false;
  }

  function selectFromController(controller, activation) {
    const ray = controllerRay(controller, RAY_LENGTH);
    let pick = null;
    try { pick = state.scene.pickWithRay(ray, mesh => isInteractive(mesh), false); } catch (error) { state.lastError = String(error?.message || error); }
    if (pick?.hit && pick.pickedMesh && handleMesh(pick.pickedMesh, 'controller', activation)) return true;
    const angular = angularCelestialPick(ray);
    if (angular?.mesh) return handleMesh(angular.mesh, 'controller', activation);
    return false;
  }

  function registerController(controller) {
    if (!controller) return;
    const key = controller.uniqueId || controller;
    if (state.controllers.has(key)) return;
    state.controllers.set(key, { controller, down:false });
  }

  function installControllers() {
    const input = state.helper?.input;
    if (!input) return;
    for (const controller of input.controllers || []) registerController(controller);
    input.onControllerAddedObservable?.add?.(registerController);
    input.onControllerRemovedObservable?.add?.(controller => state.controllers.delete(controller.uniqueId || controller));
  }

  function pollControllers() {
    if (!xrActive()) return;
    for (const record of state.controllers.values()) {
      const activation = activationState(record.controller);
      if (activation.pressed && !record.down) selectFromController(record.controller, activation);
      record.down = activation.pressed;
    }
  }

  function moveClockToRooftop() {
    const displays = state.scene?.metadata?.astronomyDisplays;
    const clock = displays?.clockPanel;
    if (!clock?.meshes?.front || !clock?.meshes?.back) return false;
    const center = new B.Vector3(-17, LEVEL_ROOFTOP + 4.55, 49.0);
    const rotationY = Math.PI;
    const forward = new B.Vector3(Math.sin(rotationY), 0, Math.cos(rotationY));
    clock.meshes.front.position.copyFrom(center.add(forward.scale(0.07)));
    clock.meshes.front.rotation.y = rotationY;
    clock.meshes.back.position.copyFrom(center.subtract(forward.scale(0.07)));
    clock.meshes.back.rotation.y = rotationY + Math.PI;
    for (const mesh of [clock.meshes.front, clock.meshes.back]) {
      mesh.isPickable = true;
      mesh.renderingGroupId = 3;
      mesh.metadata = { ...(mesh.metadata || {}), livePanel:true, livePanelKey:clock.name, readableSign:true, rooftop:true, clockRelocatedV292:true };
    }
    clock.position = center.clone();
    clock.rotationY = rotationY;
    state.clockMoved = true;
    state.clockPosition = { x:center.x, y:center.y, z:center.z };
    return true;
  }

  function enhancePanels() {
    for (const mesh of state.scene?.meshes || []) {
      if (!isLivePanel(mesh)) continue;
      mesh.isPickable = true;
      mesh.renderingGroupId = Math.max(3, Number(mesh.renderingGroupId || 0));
      mesh.metadata = { ...(mesh.metadata || {}), ucanUniversalPanelV292:true, readableSign:true };
      if (mesh.material) {
        mesh.material.backFaceCulling = true;
        mesh.material.disableDepthWrite = true;
      }
    }
  }

  function frame() {
    const now = performance.now();
    if (now - state.lastFrame < 80) return;
    state.lastFrame = now;
    pollControllers();
    if (state.visible) {
      suppressLegacyWindows();
      if (xrActive()) {
        document.body.classList.add('ucan-v292-xr');
        state.root?.setEnabled(true);
        placeWindow3D();
      } else {
        document.body.classList.remove('ucan-v292-xr');
        state.root?.setEnabled(false);
        if (!state.html?.classList.contains('open')) renderHtml(state.current);
      }
    }
    if (now - state.lastScan > 1800) {
      state.lastScan = now;
      enhancePanels();
      if (!state.clockMoved) moveClockToRooftop();
    }
    updateAudit();
  }

  function install(scene, helper) {
    if (state.installed) return;
    state.installed = true;
    state.scene = scene;
    state.helper = helper;
    installHtmlWindow();
    createWindow3D();
    installControllers();
    enhancePanels();
    moveClockToRooftop();
    scene.onPointerObservable.add(pointerInfo => {
      const mesh = pointerInfo?.pickInfo?.pickedMesh;
      if (!pointerInfo?.pickInfo?.hit || !mesh) return;
      handleMesh(mesh, 'pointer');
    }, B.PointerEventTypes.POINTERPICK);
    scene.onBeforeRenderObservable.add(frame);
    updateAudit();
    console.info('[UCAN V292] Ventana universal, orientación correcta, paneles XR y reloj despejado instalados.');
  }

  function updateAudit() {
    window.__UCAN_UNIVERSAL_SIGN_AUDIT__ = {
      version:VERSION,
      build:BUILD,
      installed:state.installed,
      universalWindow:true,
      separateFrontBackSurfaces:true,
      mirroredTextFixed:true,
      closableDesktop:true,
      closableXR:true,
      triggerActivation:true,
      joystickClickActivation:true,
      primaryButtonActivation:true,
      livePanelsOpenActualContent:true,
      celestialInformationSupported:true,
      legacyWindowsSuppressed:true,
      clockRelocatedToRooftop:state.clockMoved,
      clockPosition:state.clockPosition,
      opened:state.opened,
      closed:state.closed,
      controllerOpens:state.controllerOpens,
      pointerOpens:state.pointerOpens,
      joystickOpens:state.joystickOpens,
      celestialOpens:state.celestialOpens,
      panelOpens:state.panelOpens,
      visible:state.visible,
      current:state.current?.title || null,
      controllers:state.controllers.size,
      legacyWindowsSuppressedCount:state.legacyWindowsSuppressed,
      lastError:state.lastError,
      close:closeUniversal,
      getState:() => ({ visible:state.visible, current:state.current?.title || null, opened:state.opened, closed:state.closed, clockMoved:state.clockMoved, controllers:state.controllers.size })
    };
    window.__UCAN_UNIVERSAL_SIGN_WINDOW__ = {
      version:VERSION,
      close:closeUniversal,
      openPanelByMesh:mesh => handleMesh(mesh, 'api'),
      getState:() => window.__UCAN_UNIVERSAL_SIGN_AUDIT__?.getState?.()
    };
  }

  function boot(attempt = 0) {
    const scene = window.__UCAN_API__?.getScene?.();
    const helper = window.__UCAN_XR_HELPER__;
    if (scene && helper?.baseExperience) return install(scene, helper);
    if (attempt < 260) window.setTimeout(() => boot(attempt + 1), 100);
    else {
      state.lastError = 'No se encontró la escena o el ayudante XR.';
      updateAudit();
    }
  }

  updateAudit();
  boot();
})();
