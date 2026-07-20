(() => {
  'use strict';

  const VERSION = 'V290';
  const BUILD = 'V290-20260720-QUEST-CONTROLS-STAIRS-INFO';
  const B = window.BABYLON;
  if (!B?.Scene?.prototype?.createDefaultXRExperienceAsync) return;

  const LEVEL = Object.freeze({ one:0, two:8.2, three:16.4, roof:27.2 });
  const FLOORS = Object.freeze([LEVEL.one, LEVEL.two, LEVEL.three, LEVEL.roof]);
  const PLAYER_HEIGHT = 1.72;
  const WORLD = Object.freeze({ minX:-73, maxX:73, minZ:-59, maxZ:59 });
  const DEAD_ZONE = 0.16;
  const MOVE_SPEED = Object.freeze({ comfort:2.8, natural:4.3 });
  const SNAP_ANGLE = Math.PI / 6;
  const XR_STATE = B.WebXRState || Object.freeze({ NOT_IN_XR:0, ENTERING_XR:1, IN_XR:2, EXITING_XR:3 });

  const ROUTES = Object.freeze([
    { id:'up12', kind:'escalator', direction:'up', fromFloor:LEVEL.one, toFloor:LEVEL.two, x:-20, fromZ:32, toZ:10, radiusX:5.8, radiusZ:6.2, duration:3600, message:'Subiendo al Piso 2' },
    { id:'down21', kind:'escalator', direction:'down', fromFloor:LEVEL.two, toFloor:LEVEL.one, x:-8, fromZ:10, toZ:32, radiusX:5.8, radiusZ:6.2, duration:3600, message:'Bajando al Piso 1' },
    { id:'up23', kind:'escalator', direction:'up', fromFloor:LEVEL.two, toFloor:LEVEL.three, x:-34, fromZ:32, toZ:10, radiusX:5.8, radiusZ:6.2, duration:3600, message:'Subiendo al Piso 3' },
    { id:'down32', kind:'escalator', direction:'down', fromFloor:LEVEL.three, toFloor:LEVEL.two, x:-26, fromZ:10, toZ:32, radiusX:5.8, radiusZ:6.2, duration:3600, message:'Bajando al Piso 2' },
    { id:'up34', kind:'stairs', direction:'up', fromFloor:LEVEL.three, toFloor:LEVEL.roof, x:44, fromZ:39, toZ:10.5, radiusX:7.2, radiusZ:8.0, duration:4700, message:'Subiendo a la terraza' },
    { id:'down43', kind:'stairs', direction:'down', fromFloor:LEVEL.roof, toFloor:LEVEL.three, x:44, fromZ:10.5, toZ:39, radiusX:7.2, radiusZ:8.0, duration:4700, message:'Bajando al Piso 3' }
  ]);

  const states = new WeakMap();
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const finite = value => Number.isFinite(Number(value));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smoothStep = t => t * t * (3 - 2 * t);
  const normalizeAxis = raw => {
    const value = finite(raw) ? Number(raw) : 0;
    const magnitude = Math.abs(value);
    if (magnitude <= DEAD_ZONE) return 0;
    return Math.sign(value) * clamp((magnitude - DEAD_ZONE) / (1 - DEAD_ZONE), 0, 1);
  };

  function status(message) {
    window.__UCAN_API__?.setStatus?.(message);
    const element = document.getElementById('status');
    if (element && !window.__UCAN_API__?.setStatus) element.textContent = message;
  }

  function nearestFloor(value) {
    return FLOORS.reduce((best, floor) => Math.abs(Number(value) - floor) < Math.abs(Number(value) - best) ? floor : best, FLOORS[0]);
  }

  function stableFloor() {
    try {
      const floor = window.__UCAN_FLOOR_STATE_V287__?.getState?.()?.floorBase;
      if (finite(floor)) return nearestFloor(floor);
    } catch (_) {}
    return null;
  }

  function setStableFloor(base, reason) {
    try { window.__UCAN_FLOOR_STATE_V287__?.setFloorBase?.(base, reason); } catch (_) {}
  }

  function eyeHeight(camera, fallback = PLAYER_HEIGHT) {
    const values = [camera?.realWorldHeight, camera?._realWorldHeight, fallback, PLAYER_HEIGHT];
    return values.map(Number).find(value => finite(value) && value >= 0.8 && value <= 2.4) || PLAYER_HEIGHT;
  }

  function comfortEnabled() {
    return document.getElementById('comfortBtn')?.getAttribute('aria-pressed') === 'true';
  }

  function recordError(state, stage, error) {
    const detail = {
      stage,
      name:String(error?.name || 'Error'),
      message:String(error?.message || error || 'Error XR desconocido'),
      at:new Date().toISOString()
    };
    state.errors.push(detail);
    if (state.errors.length > 16) state.errors.shift();
    state.lastError = detail;
    updateAudit(state);
    console.error(`[UCAN ${VERSION}] ${stage}:`, error);
  }

  function controllerHand(controller) {
    return String(controller?.inputSource?.handedness || controller?.motionController?.handedness || 'none');
  }

  function findComponent(motionController, type, ids = []) {
    try {
      const direct = motionController?.getComponentOfType?.(type);
      if (direct) return direct;
    } catch (_) {}
    for (const id of ids) {
      try {
        const component = motionController?.getComponent?.(id);
        if (component) return component;
      } catch (_) {}
    }
    try {
      const componentIds = motionController?.getComponentIds?.() || [];
      for (const id of componentIds) {
        const component = motionController.getComponent(id);
        if (!component) continue;
        if (type === 'thumbstick' && (component.type === 'thumbstick' || component.axes)) return component;
        if (type === 'trigger' && (component.type === 'trigger' || /trigger/i.test(String(id)))) return component;
      }
    } catch (_) {}
    return null;
  }

  function readComponentAxes(component) {
    const axes = component?.axes || component?.value?.axes || null;
    if (axes && finite(axes.x) && finite(axes.y)) return { x:normalizeAxis(axes.x), y:normalizeAxis(axes.y), source:'motion-component' };
    return null;
  }

  function readGamepadAxes(record) {
    const gamepad = record?.controller?.inputSource?.gamepad || record?.motionController?.gamepadObject || record?.motionController?.gamepad;
    const values = Array.from(gamepad?.axes || []);
    if (values.length < 2) return { x:0, y:0, source:'none' };
    const offset = values.length >= 4 ? 2 : 0;
    return { x:normalizeAxis(values[offset]), y:normalizeAxis(values[offset + 1]), source:`gamepad-${offset}-${offset + 1}` };
  }

  function readAxes(record) {
    return readComponentAxes(record?.thumbstick) || readGamepadAxes(record);
  }

  function triggerPressed(record) {
    const component = record?.trigger;
    if (component) {
      if (typeof component.pressed === 'boolean') return component.pressed;
      if (finite(component.value)) return Number(component.value) > 0.62;
    }
    const gamepad = record?.controller?.inputSource?.gamepad || record?.motionController?.gamepadObject || record?.motionController?.gamepad;
    return Boolean(gamepad?.buttons?.[0]?.pressed || Number(gamepad?.buttons?.[0]?.value || 0) > 0.62);
  }

  function controllerRay(record, length = 32) {
    const ray = new B.Ray(new B.Vector3(0, 0, 0), new B.Vector3(0, 0, 1), length);
    try {
      if (record?.controller?.getWorldPointerRayToRef) {
        record.controller.getWorldPointerRayToRef(ray);
        ray.length = length;
        return ray;
      }
    } catch (_) {}
    const pointer = record?.controller?.pointer || record?.controller?.grip;
    try {
      ray.origin.copyFrom(pointer.getAbsolutePosition());
      const matrix = pointer.getWorldMatrix();
      B.Vector3.TransformNormalToRef(new B.Vector3(0, 0, 1), matrix, ray.direction);
      ray.direction.normalize();
    } catch (_) {}
    return ray;
  }

  function updateControllerRay(state, record) {
    if (!record || !state.inXR) {
      record?.laser?.setEnabled(false);
      return;
    }
    const ray = controllerRay(record, 18);
    const points = [ray.origin, ray.origin.add(ray.direction.scale(18))];
    if (!record.laser) {
      record.laser = B.MeshBuilder.CreateLines(`rayo control ${record.hand} V290`, { points, updatable:true }, state.scene);
      record.laser.color = new B.Color3(1, 0.82, 0.18);
      record.laser.isPickable = false;
      record.laser.renderingGroupId = 4;
    } else {
      B.MeshBuilder.CreateLines(record.laser.name, { points, instance:record.laser });
      record.laser.setEnabled(true);
    }
  }

  function registerMotionController(state, record, motionController) {
    record.motionController = motionController;
    record.profile = String(motionController?.profileId || motionController?.id || record.controller?.inputSource?.profiles?.[0] || 'unknown');
    record.thumbstick = findComponent(motionController, 'thumbstick', ['xr-standard-thumbstick', 'thumbstick']);
    record.trigger = findComponent(motionController, 'trigger', ['xr-standard-trigger', 'trigger']);

    if (record.thumbstick?.onAxisValueChangedObservable?.add) {
      record.thumbstick.onAxisValueChangedObservable.add(value => {
        record.axes = { x:normalizeAxis(value?.x ?? record.thumbstick?.axes?.x), y:normalizeAxis(value?.y ?? record.thumbstick?.axes?.y), source:'motion-observable' };
      });
    }
    if (record.trigger?.onButtonStateChangedObservable?.add) {
      record.trigger.onButtonStateChangedObservable.add(component => {
        const pressed = Boolean(component?.pressed || component?.changes?.pressed?.current || Number(component?.value || 0) > 0.62);
        if (pressed && !record.triggerDown) selectFromController(state, record);
        record.triggerDown = pressed;
      });
    }
    updateAudit(state);
  }

  function registerController(state, controller) {
    if (!controller || state.controllers.has(controller.uniqueId || controller)) return;
    const key = controller.uniqueId || controller;
    const record = {
      controller,
      hand:controllerHand(controller),
      profile:String(controller?.inputSource?.profiles?.[0] || 'pending'),
      motionController:null,
      thumbstick:null,
      trigger:null,
      axes:{ x:0, y:0, source:'pending' },
      triggerDown:false,
      laser:null,
      selections:0
    };
    state.controllers.set(key, record);
    if (controller.motionController) registerMotionController(state, record, controller.motionController);
    controller.onMotionControllerInitObservable?.add?.(motion => registerMotionController(state, record, motion));
    updateAudit(state);
  }

  function setupControllers(state) {
    for (const controller of state.helper?.input?.controllers || []) registerController(state, controller);
    state.helper?.input?.onControllerAddedObservable?.add?.(controller => registerController(state, controller));
    state.helper?.input?.onControllerRemovedObservable?.add?.(controller => {
      const key = controller.uniqueId || controller;
      const record = state.controllers.get(key);
      record?.laser?.dispose?.();
      state.controllers.delete(key);
      updateAudit(state);
    });
  }

  function handRecord(state, hand) {
    return [...state.controllers.values()].find(record => record.hand === hand) || null;
  }

  function horizontalBasis(camera) {
    let forward;
    try { forward = camera.getForwardRay?.(1)?.direction?.clone?.(); } catch (_) {}
    if (!forward) forward = new B.Vector3(0, 0, 1);
    forward.y = 0;
    if (forward.lengthSquared() < 0.0001) forward.set(0, 0, 1);
    forward.normalize();
    return { forward, right:new B.Vector3(forward.z, 0, -forward.x).normalize() };
  }

  function collisionCandidate(mesh) {
    if (!mesh || mesh.isVisible === false || !mesh.checkCollisions) return false;
    if (typeof mesh.isEnabled === 'function' && !mesh.isEnabled()) return false;
    if (mesh.metadata?.walkable || mesh.metadata?.teleportable || mesh.metadata?.xrStairSurface) return false;
    return !/gran losa|ruta avatar|zona segura VR|rooftop deck|rampa invisible|plataforma (?:inicio|fin)|peldaño|banda escalera|escalon central/i.test(String(mesh.name || ''));
  }

  function rayBlocked(state, step, ground) {
    if (!B.Ray || !state.scene?.pickWithRay || step.lengthSquared() < 1e-8) return false;
    const direction = step.clone().normalize();
    const length = step.length() + 0.46;
    for (const height of [0.35, 1.02, 1.62]) {
      const origin = new B.Vector3(state.xr.position.x, ground + height, state.xr.position.z);
      const hit = state.scene.pickWithRay(new B.Ray(origin, direction, length), collisionCandidate, false);
      if (hit?.hit && hit.distance <= length) return true;
    }
    return false;
  }

  function moveWithSlide(state, step, ground) {
    if (step.lengthSquared() < 1e-8) return;
    if (!rayBlocked(state, step, ground)) {
      state.xr.position.addInPlace(step);
    } else {
      const xStep = new B.Vector3(step.x, 0, 0);
      const zStep = new B.Vector3(0, 0, step.z);
      if (Math.abs(xStep.x) > 1e-5 && !rayBlocked(state, xStep, ground)) state.xr.position.addInPlace(xStep);
      if (Math.abs(zStep.z) > 1e-5 && !rayBlocked(state, zStep, ground)) state.xr.position.addInPlace(zStep);
      state.blockedFrames += 1;
    }
    state.xr.position.x = clamp(state.xr.position.x, WORLD.minX, WORLD.maxX);
    state.xr.position.z = clamp(state.xr.position.z, WORLD.minZ, WORLD.maxZ);
  }

  function floorGround(state) {
    const p = state.xr?.position;
    if (!p) return state.floor;
    if (Math.abs(state.floor - LEVEL.three) <= 0.35) {
      const center = p.x > -4.8 && p.x < 1.2 && p.z > -14 && p.z < 18.8;
      const side = p.x > 18.2 && p.x < 22.8 && p.z > -8 && p.z < 18.8;
      if (center || side) {
        const z0 = center ? -12 : -7;
        const z1 = 17.4;
        const rise = center ? 2.38 : 2.04;
        return LEVEL.three + rise * clamp((p.z - z0) / (z1 - z0), 0, 1);
      }
    }
    return state.floor;
  }

  function applySnapTurn(state, axes) {
    const direction = Math.abs(axes.x) >= 0.72 ? Math.sign(axes.x) : 0;
    if (!direction) {
      state.turnLatch = false;
      return;
    }
    if (state.turnLatch) return;
    state.turnLatch = true;
    try {
      const current = state.xr.rotationQuaternion?.toEulerAngles?.().y || state.xr.rotation?.y || 0;
      const next = current + direction * SNAP_ANGLE;
      if (state.xr.rotationQuaternion && B.Quaternion?.FromEulerAngles) state.xr.rotationQuaternion.copyFrom(B.Quaternion.FromEulerAngles(0, next, 0));
      else if (state.xr.rotation) state.xr.rotation.y = next;
      state.snapTurns += 1;
    } catch (error) {
      recordError(state, 'snap-turn', error);
    }
  }

  function applyMovement(state, dt) {
    const left = handRecord(state, 'left');
    const right = handRecord(state, 'right');
    const moveAxes = left ? (left.axes?.source === 'motion-observable' ? left.axes : readAxes(left)) : (right ? readAxes(right) : { x:0, y:0, source:'none' });
    const turnAxes = right ? (right.axes?.source === 'motion-observable' ? right.axes : readAxes(right)) : { x:0, y:0, source:'none' };
    state.lastMoveAxes = moveAxes;
    state.lastTurnAxes = turnAxes;
    applySnapTurn(state, turnAxes);

    const magnitude = Math.min(1, Math.hypot(moveAxes.x, moveAxes.y));
    if (magnitude < 0.01) return;
    const basis = horizontalBasis(state.xr);
    const direction = basis.right.scale(moveAxes.x).add(basis.forward.scale(-moveAxes.y));
    if (direction.lengthSquared() > 1) direction.normalize();
    direction.scaleInPlace((comfortEnabled() ? MOVE_SPEED.comfort : MOVE_SPEED.natural) * dt);
    moveWithSlide(state, direction, floorGround(state));
    state.movingFrames += 1;
  }

  function routeById(id) {
    return ROUTES.find(route => route.id === id) || null;
  }

  function nearRouteEntry(state, route) {
    if (!state.xr?.position || state.transition || performance.now() < state.routeCooldownUntil) return false;
    if (Math.abs(state.floor - route.fromFloor) > 0.4) return false;
    const p = state.xr.position;
    return Math.abs(p.x - route.x) <= route.radiusX && Math.abs(p.z - route.fromZ) <= route.radiusZ;
  }

  function routeEntry(state) {
    return ROUTES.find(route => nearRouteEntry(state, route)) || null;
  }

  function beginRoute(state, route, source = 'zona') {
    if (!route || state.transition) return false;
    state.transition = {
      route,
      source,
      startedAt:performance.now(),
      start:state.xr.position.clone(),
      eyeHeight:state.eyeHeight
    };
    state.lastSafe.copyFrom(state.xr.position);
    state.routeStarts += 1;
    status(`${route.message}. Mantenga la vista al frente; el recorrido será automático.`);
    return true;
  }

  function updateRoute(state) {
    const transition = state.transition;
    if (!transition) return false;
    const route = transition.route;
    const raw = clamp((performance.now() - transition.startedAt) / route.duration, 0, 1);
    const t = smoothStep(raw);
    const ground = lerp(route.fromFloor, route.toFloor, t);
    state.xr.position.x = lerp(transition.start.x, route.x, t);
    state.xr.position.z = lerp(transition.start.z, route.toZ, t);
    state.xr.position.y = ground + transition.eyeHeight;
    if (raw >= 1) {
      state.floor = route.toFloor;
      const exitOffset = route.direction === 'up' ? -1.7 : 1.7;
      state.xr.position.set(route.x, route.toFloor + transition.eyeHeight, route.toZ + exitOffset);
      state.desktop?.position?.set?.(route.x, route.toFloor + PLAYER_HEIGHT, route.toZ + exitOffset);
      setStableFloor(route.toFloor, `xr-route:${route.id}`);
      state.transition = null;
      state.routeCooldownUntil = performance.now() + 2300;
      state.lastSafe.copyFrom(state.xr.position);
      state.completedRoutes += 1;
      status(`${route.message} completado.`);
    }
    return true;
  }

  function createTextMaterial(scene, name, lines, color = '#0b3d38') {
    const texture = new B.DynamicTexture(`textura ${name}`, { width:768, height:384 }, scene, false);
    texture.hasAlpha = true;
    texture.updateSamplingMode?.(B.Texture.BILINEAR_SAMPLINGMODE);
    const ctx = texture.getContext();
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, 768, 384);
    ctx.fillStyle = '#fed141';
    ctx.fillRect(0, 0, 768, 16);
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 54px Segoe UI, Arial';
    ctx.fillText(lines[0] || '', 384, 125);
    ctx.font = 'bold 34px Segoe UI, Arial';
    ctx.fillText(lines[1] || '', 384, 215);
    ctx.font = '26px Segoe UI, Arial';
    ctx.fillText(lines[2] || 'Apunte y presione el gatillo', 384, 300);
    texture.update(false);
    const material = new B.StandardMaterial(`material ${name}`, scene);
    material.diffuseTexture = texture;
    material.emissiveTexture = texture;
    material.disableLighting = true;
    material.backFaceCulling = false;
    material.disableDepthWrite = true;
    return material;
  }

  function createRouteMarker(state, route) {
    if (!['up34', 'down43'].includes(route.id)) return;
    const y = route.fromFloor + 2.15;
    const z = route.id === 'up34' ? 42.2 : 6.4;
    const label = route.id === 'up34' ? ['TERRAZA', 'SUBIR', 'Gatillo para activar'] : ['PISO 3', 'BAJAR', 'Gatillo para activar'];
    const marker = B.MeshBuilder.CreatePlane(`marcador XR ${route.id} V290`, { width:4.2, height:2.1, sideOrientation:B.Mesh.DOUBLESIDE }, state.scene);
    marker.position.set(route.x, y, z);
    marker.billboardMode = B.Mesh.BILLBOARDMODE_ALL;
    marker.material = createTextMaterial(state.scene, `marcador ${route.id} V290`, label, route.direction === 'up' ? '#0b4f46' : '#5a3b17');
    marker.isPickable = true;
    marker.checkCollisions = false;
    marker.renderingGroupId = 3;
    marker.metadata = { ...(marker.metadata || {}), ucanXrRouteV290:route.id, readableSign:true };
    state.routeMarkers.push(marker);
  }

  function setupRouteMarkers(state) {
    for (const route of ROUTES) createRouteMarker(state, route);
  }

  function wrapText(ctx, text, x, y, maxWidth, lineHeight, maxLines) {
    const words = String(text || '').split(/\s+/).filter(Boolean);
    const lines = [];
    let line = '';
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (ctx.measureText(candidate).width > maxWidth && line) {
        lines.push(line);
        line = word;
        if (lines.length >= maxLines) break;
      } else line = candidate;
    }
    if (line && lines.length < maxLines) lines.push(line);
    lines.forEach((value, index) => ctx.fillText(value, x, y + index * lineHeight));
  }

  function createInfoPanel(state) {
    const root = new B.TransformNode('Ventana información XR V290', state.scene);
    const texture = new B.DynamicTexture('contenido información XR V290', { width:1024, height:620 }, state.scene, false);
    texture.updateSamplingMode?.(B.Texture.BILINEAR_SAMPLINGMODE);
    const material = new B.StandardMaterial('material información XR V290', state.scene);
    material.diffuseTexture = texture;
    material.emissiveTexture = texture;
    material.disableLighting = true;
    material.backFaceCulling = false;
    material.disableDepthWrite = true;

    const panel = B.MeshBuilder.CreatePlane('panel información XR V290', { width:2.65, height:1.62, sideOrientation:B.Mesh.DOUBLESIDE }, state.scene);
    panel.parent = root;
    panel.material = material;
    panel.billboardMode = B.Mesh.BILLBOARDMODE_ALL;
    panel.isPickable = false;
    panel.checkCollisions = false;
    panel.renderingGroupId = 4;

    const closeMaterial = createTextMaterial(state.scene, 'cerrar información XR V290', ['×', 'CERRAR', 'Gatillo'], '#8e1f18');
    const close = B.MeshBuilder.CreatePlane('cerrar información XR V290', { width:0.42, height:0.42, sideOrientation:B.Mesh.DOUBLESIDE }, state.scene);
    close.parent = root;
    close.position.set(1.15, 0.62, -0.035);
    close.billboardMode = B.Mesh.BILLBOARDMODE_ALL;
    close.material = closeMaterial;
    close.isPickable = true;
    close.checkCollisions = false;
    close.renderingGroupId = 5;
    close.metadata = { ucanInfoCloseV290:true };

    root.setEnabled(false);
    state.infoRoot = root;
    state.infoTexture = texture;
    state.infoVisible = false;
  }

  function drawInfo(state, info) {
    const ctx = state.infoTexture.getContext();
    ctx.clearRect(0, 0, 1024, 620);
    const gradient = ctx.createLinearGradient(0, 0, 1024, 620);
    gradient.addColorStop(0, '#061426');
    gradient.addColorStop(1, '#135466');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 1024, 620);
    ctx.fillStyle = info.color || '#fed141';
    ctx.fillRect(0, 0, 1024, 18);
    ctx.fillStyle = '#ffffff';
    ctx.textBaseline = 'top';
    ctx.font = 'bold 54px Segoe UI, Arial';
    ctx.fillText(String(info.title || 'Información').slice(0, 34), 42, 36);
    ctx.fillStyle = '#a5e4ee';
    ctx.font = 'bold 29px Segoe UI, Arial';
    ctx.fillText(String(info.category || 'Elemento del entorno').slice(0, 52), 44, 108);
    ctx.fillStyle = '#ffffff';
    ctx.font = '27px Segoe UI, Arial';
    let y = 168;
    for (const detail of (info.details || []).slice(0, 4)) {
      ctx.fillText(`• ${detail}`, 48, y);
      y += 40;
    }
    ctx.fillStyle = '#e5fbff';
    ctx.font = '26px Segoe UI, Arial';
    wrapText(ctx, info.summary || 'Información disponible.', 48, Math.max(y + 12, 350), 910, 36, 5);
    ctx.fillStyle = 'rgba(255,255,255,.72)';
    ctx.font = '22px Segoe UI, Arial';
    ctx.fillText('Apunte al botón × y presione el gatillo para cerrar.', 48, 568);
    state.infoTexture.update(false);
  }

  function positionInfoPanel(state) {
    if (!state.infoVisible || !state.xr || !state.infoRoot) return;
    const origin = state.xr.globalPosition?.clone?.() || state.xr.position?.clone?.();
    if (!origin) return;
    let forward;
    try { forward = state.xr.getForwardRay?.(1)?.direction?.clone?.(); } catch (_) {}
    if (!forward || forward.lengthSquared() < 0.001) forward = new B.Vector3(0, 0, 1);
    forward.normalize();
    const target = origin.add(forward.scale(2.25));
    target.y = origin.y - 0.12;
    state.infoRoot.position.copyFrom(target);
  }

  function showInfo(state, info) {
    try { window.__UCAN_CELESTIAL_WINDOW__?.close?.(); } catch (_) {}
    drawInfo(state, info);
    state.infoVisible = true;
    state.infoRoot.setEnabled(true);
    positionInfoPanel(state);
    state.infoSelections += 1;
    updateAudit(state);
  }

  function closeInfo(state) {
    state.infoVisible = false;
    state.infoRoot?.setEnabled(false);
    try { window.__UCAN_CELESTIAL_WINDOW__?.close?.(); } catch (_) {}
    updateAudit(state);
  }

  function celestialInfo(mesh) {
    const data = mesh?.metadata?.celestialData;
    const id = mesh?.metadata?.celestialId;
    let entry = data || null;
    if (!entry && id) {
      try { entry = window.__UCAN_INTERACTIVE_SKY__?.getObjects?.().find(item => item.id === id) || null; } catch (_) {}
    }
    if (!entry) return null;
    const details = [];
    if (entry.constellation) details.push(`Constelación: ${entry.constellation}`);
    if (finite(entry.actualAltitude ?? entry.altitude)) details.push(`Altitud: ${Number(entry.actualAltitude ?? entry.altitude).toFixed(1)}°`);
    if (finite(entry.azimuth)) details.push(`Azimut: ${Number(entry.azimuth).toFixed(1)}°`);
    if (entry.phase) details.push(String(entry.phase));
    if (entry.belowHorizon) details.push('Actualmente está bajo el horizonte.');
    return {
      title:entry.name || 'Objeto celeste',
      category:entry.category || entry.kind || 'Astronomía',
      summary:entry.summary || 'Información astronómica disponible.',
      details,
      color:entry.color || '#fed141'
    };
  }

  function readableSignInfo(mesh) {
    const metadata = mesh?.metadata || {};
    const route = metadata.ucanXrRouteV290 ? routeById(metadata.ucanXrRouteV290) : null;
    if (route) {
      return {
        title:route.direction === 'up' ? 'Escaleras a la terraza' : 'Escaleras al Piso 3',
        category:'Ruta accesible en Meta Quest',
        summary:'Presione el gatillo sobre este marcador para iniciar el recorrido automático y seguro.',
        details:[route.message, `Destino: ${route.toFloor === LEVEL.roof ? 'Terraza' : `Piso ${route.toFloor === LEVEL.three ? 3 : route.toFloor === LEVEL.two ? 2 : 1}`}`],
        color:'#fed141'
      };
    }
    const name = String(mesh?.name || 'Cartel del entorno');
    const routeId = String(metadata.escalator || '').trim();
    const routeFromMetadata = routeId ? routeById(routeId) : null;
    if (routeFromMetadata) {
      return {
        title:routeFromMetadata.message,
        category:routeFromMetadata.kind === 'stairs' ? 'Escalera' : 'Escalera eléctrica',
        summary:routeFromMetadata.direction === 'up' ? 'Ruta designada para subir.' : 'Ruta designada para bajar.',
        details:[`Código: ${routeFromMetadata.id}`, `Piso de destino: ${routeFromMetadata.toFloor}`],
        color:'#fed141'
      };
    }
    const cleaned = name
      .replace(/^(?:rótulo|rotulo|señal|senal|cartel|etiqueta|frente|contenido)\s*/i, '')
      .replace(/\s+V\d+$/i, '')
      .replace(/[_-]+/g, ' ')
      .trim();
    return {
      title:cleaned || 'Cartel del entorno',
      category:'Información del campus virtual',
      summary:'Este cartel identifica una zona, servicio, salón o dirección dentro del UCAN Academic Mall.',
      details:[name],
      color:'#fed141'
    };
  }

  function isReadable(mesh) {
    if (!mesh || typeof mesh.isEnabled === 'function' && !mesh.isEnabled()) return false;
    const metadata = mesh.metadata || {};
    if (metadata.celestialId || metadata.celestialData || metadata.celestialObject || metadata.readableSign || metadata.ucanXrRouteV290 || metadata.ucanInfoCloseV290 || metadata.celestialWindowCloseV288) return true;
    return /rótulo|rotulo|señal|senal|cartel|etiqueta cielo|planeta|luna|estrella|constelación|constelacion|información|informacion/i.test(String(mesh.name || ''));
  }

  function enhanceReadableMeshes(state) {
    let count = 0;
    for (const mesh of state.scene.meshes || []) {
      if (!isReadable(mesh)) continue;
      mesh.isPickable = true;
      mesh.renderingGroupId = Math.max(Number(mesh.renderingGroupId || 0), 3);
      mesh.alwaysSelectAsActiveMesh = state.inXR;
      mesh.metadata = { ...(mesh.metadata || {}), ucanReadableV290:true };
      if (mesh.material) {
        mesh.material.backFaceCulling = false;
        mesh.material.disableDepthWrite = true;
      }
      count += 1;
    }
    state.readableMeshes = count;
  }

  function selectFromController(state, record) {
    if (!state.inXR || !record) return false;
    try {
      const ray = controllerRay(record, 36);
      const pick = state.scene.pickWithRay(ray, mesh => isReadable(mesh), false);
      if (!pick?.hit || !pick.pickedMesh) {
        status('No se detectó un objeto informativo. Apunte el rayo directamente al planeta o cartel.');
        return false;
      }
      const mesh = pick.pickedMesh;
      if (mesh.metadata?.ucanInfoCloseV290 || mesh.metadata?.celestialWindowCloseV288) {
        closeInfo(state);
        return true;
      }
      const routeId = mesh.metadata?.ucanXrRouteV290;
      if (routeId) {
        const route = routeById(routeId);
        if (route) {
          beginRoute(state, route, 'gatillo');
          closeInfo(state);
          return true;
        }
      }
      const celestial = celestialInfo(mesh);
      showInfo(state, celestial || readableSignInfo(mesh));
      record.selections += 1;
      return true;
    } catch (error) {
      recordError(state, 'controller-selection', error);
      return false;
    }
  }

  function pollControllerButtons(state) {
    for (const record of state.controllers.values()) {
      const pressed = triggerPressed(record);
      if (pressed && !record.triggerDown) selectFromController(state, record);
      record.triggerDown = pressed;
      updateControllerRay(state, record);
    }
  }

  function syncHeightAndDesktop(state) {
    state.eyeHeight = eyeHeight(state.xr, state.eyeHeight);
    const explicit = stableFloor();
    if (explicit != null && !state.transition) state.floor = explicit;
    const ground = floorGround(state);
    state.xr.position.y = ground + state.eyeHeight;
    if (state.desktop?.position) {
      state.desktop.position.x = state.xr.position.x;
      state.desktop.position.z = state.xr.position.z;
      state.desktop.position.y = ground + PLAYER_HEIGHT;
    }
  }

  function recoverIfInvalid(state) {
    const p = state.xr?.position;
    const valid = p && finite(p.x) && finite(p.y) && finite(p.z) && p.x >= WORLD.minX - 5 && p.x <= WORLD.maxX + 5 && p.z >= WORLD.minZ - 5 && p.z <= WORLD.maxZ + 5 && p.y >= -1 && p.y <= LEVEL.roof + 7;
    if (valid) {
      if (!state.transition) state.lastSafe.copyFrom(p);
      return;
    }
    p?.copyFrom?.(state.lastSafe || new B.Vector3(0, state.floor + state.eyeHeight, 42));
    state.transition = null;
    state.recoveries += 1;
    status('La posición Meta Quest fue recuperada automáticamente.');
  }

  function initialPose(state) {
    state.eyeHeight = eyeHeight(state.xr, PLAYER_HEIGHT);
    const explicit = stableFloor();
    const desktopY = Number(state.desktop?.position?.y || PLAYER_HEIGHT);
    state.floor = explicit != null ? explicit : nearestFloor(desktopY - PLAYER_HEIGHT);
    state.xr.position.set(Number(state.desktop?.position?.x || 0), state.floor + state.eyeHeight, Number(state.desktop?.position?.z || 42));
    state.lastSafe.copyFrom(state.xr.position);
    state.poseReady = true;
    setStableFloor(state.floor, 'xr-initial-pose');
  }

  function frame(state) {
    if (!state.inXR || !state.poseReady || !state.xr?.position) return;
    try {
      const dt = clamp((state.scene.getEngine().getDeltaTime() || 16) / 1000, 0.001, 0.05);
      pollControllerButtons(state);
      if (!state.transition) {
        const route = routeEntry(state);
        if (route) beginRoute(state, route, 'zona-ampliada');
      }
      if (!updateRoute(state)) {
        applyMovement(state, dt);
        syncHeightAndDesktop(state);
      }
      positionInfoPanel(state);
      recoverIfInvalid(state);
      if (performance.now() - state.lastReadableScan > 1800) {
        state.lastReadableScan = performance.now();
        enhanceReadableMeshes(state);
      }
      if (++state.auditFrame % 30 === 0) updateAudit(state);
    } catch (error) {
      recordError(state, 'frame', error);
      recoverIfInvalid(state);
    }
  }

  function disableConflictingFeatures(helper) {
    const manager = helper?.baseExperience?.featuresManager;
    if (!manager) return;
    for (const feature of [B.WebXRFeatureName?.MOVEMENT, B.WebXRFeatureName?.TELEPORTATION].filter(Boolean)) {
      try { manager.disableFeature(feature); } catch (_) {}
    }
  }

  function updateAudit(state) {
    const controllers = [...state.controllers.values()].map(record => ({
      hand:record.hand,
      profile:record.profile,
      thumbstick:Boolean(record.thumbstick),
      trigger:Boolean(record.trigger),
      axes:readAxes(record),
      selections:record.selections
    }));
    window.__UCAN_UNIFIED_XR_AUDIT__ = {
      version:VERSION,
      build:BUILD,
      installed:true,
      inXR:state.inXR,
      poseReady:state.poseReady,
      singleController:true,
      deprecatedXrLayersLoaded:false,
      sameScene:true,
      sameLighting:true,
      noQuestSpecificExposure:true,
      questThumbstickComponents:true,
      leftStickMovement:true,
      rightStickSnapTurn:true,
      snapTurnDegrees:30,
      triggerRaySelection:true,
      visibleControllerRays:true,
      xrReadableSigns:true,
      xrCelestialInformation:true,
      compactInfoWindow:true,
      rooftopStairsExpandedTriggers:true,
      rooftopStairsTriggerMarkers:true,
      rooftopStairsBidirectional:true,
      automaticEscalators:true,
      oneWayElectricEscalators:true,
      completedRoutes:state.completedRoutes,
      routeStarts:state.routeStarts,
      movingFrames:state.movingFrames,
      blockedFrames:state.blockedFrames,
      snapTurns:state.snapTurns,
      readableMeshes:state.readableMeshes,
      infoVisible:state.infoVisible,
      infoSelections:state.infoSelections,
      controllers,
      floor:state.floor,
      transition:state.transition ? state.transition.route.id : null,
      recoveries:state.recoveries,
      lastError:state.lastError,
      errors:[...state.errors],
      getState:() => ({
        inXR:state.inXR,
        floor:state.floor,
        eyeHeight:state.eyeHeight,
        position:state.xr?.position ? { x:state.xr.position.x, y:state.xr.position.y, z:state.xr.position.z } : null,
        transition:state.transition?.route?.id || null,
        controllers,
        lastMoveAxes:state.lastMoveAxes,
        lastTurnAxes:state.lastTurnAxes,
        infoVisible:state.infoVisible,
        lastError:state.lastError
      }),
      startRoute:id => beginRoute(state, routeById(id), 'auditoría'),
      showInfo:info => showInfo(state, info),
      closeInfo:() => closeInfo(state)
    };
    window.__UCAN_QUEST_CONTROLS_V290__ = window.__UCAN_UNIFIED_XR_AUDIT__;
  }

  function install(scene, helper) {
    if (!helper || helper.__ucanV290ControlsInstalled) return helper;
    helper.__ucanV290ControlsInstalled = true;
    const xr = helper.baseExperience?.camera;
    if (!xr) throw new Error('WebXR no devolvió una cámara válida para Meta Quest.');
    const desktop = scene.activeCamera;
    const state = {
      scene,
      helper,
      xr,
      desktop,
      controllers:new Map(),
      inXR:false,
      poseReady:false,
      floor:nearestFloor(Number(desktop?.position?.y || PLAYER_HEIGHT) - PLAYER_HEIGHT),
      eyeHeight:PLAYER_HEIGHT,
      transition:null,
      routeCooldownUntil:0,
      routeMarkers:[],
      lastSafe:new B.Vector3(0, PLAYER_HEIGHT, 42),
      turnLatch:false,
      lastMoveAxes:{ x:0, y:0, source:'none' },
      lastTurnAxes:{ x:0, y:0, source:'none' },
      completedRoutes:0,
      routeStarts:0,
      movingFrames:0,
      blockedFrames:0,
      snapTurns:0,
      recoveries:0,
      readableMeshes:0,
      lastReadableScan:0,
      infoRoot:null,
      infoTexture:null,
      infoVisible:false,
      infoSelections:0,
      errors:[],
      lastError:null,
      auditFrame:0
    };
    states.set(scene, state);
    disableConflictingFeatures(helper);
    xr.applyGravity = false;
    xr.checkCollisions = false;
    if (xr.cameraDirection?.set) xr.cameraDirection.set(0, 0, 0);
    setupControllers(state);
    setupRouteMarkers(state);
    createInfoPanel(state);
    enhanceReadableMeshes(state);

    helper.baseExperience.onInitialXRPoseSetObservable?.add?.(() => initialPose(state));
    helper.baseExperience.onStateChangedObservable?.add?.(xrState => {
      try {
        if (xrState === XR_STATE.ENTERING_XR) state.inXR = true;
        if (xrState === XR_STATE.IN_XR) {
          state.inXR = true;
          disableConflictingFeatures(helper);
          if (!state.poseReady) initialPose(state);
          for (const marker of state.routeMarkers) marker.setEnabled(true);
          enhanceReadableMeshes(state);
          status('Meta Quest V290: joystick izquierdo para caminar, derecho para girar y gatillo para información.');
        }
        if (xrState === XR_STATE.NOT_IN_XR) {
          state.inXR = false;
          state.poseReady = false;
          state.transition = null;
          closeInfo(state);
          for (const marker of state.routeMarkers) marker.setEnabled(false);
          for (const record of state.controllers.values()) record.laser?.setEnabled(false);
          if (state.desktop?.position && state.lastSafe) {
            state.desktop.position.x = state.lastSafe.x;
            state.desktop.position.z = state.lastSafe.z;
            state.desktop.position.y = state.floor + PLAYER_HEIGHT;
          }
        }
        updateAudit(state);
      } catch (error) {
        recordError(state, 'xr-state-change', error);
      }
    });

    for (const marker of state.routeMarkers) marker.setEnabled(false);
    scene.onBeforeRenderObservable.add(() => frame(state));
    window.__UCAN_XR_HELPER__ = helper;
    updateAudit(state);
    console.info('[UCAN V290] Controles, escaleras e información XR instalados.');
    return helper;
  }

  const original = B.Scene.prototype.createDefaultXRExperienceAsync;
  if (!original.__ucanV290ControlsPatched) {
    async function patched(options = {}) {
      const safe = {
        ...options,
        disableTeleportation:true,
        optionalFeatures:Array.isArray(options.optionalFeatures) ? options.optionalFeatures : [],
        uiOptions:{
          ...(options.uiOptions || {}),
          sessionMode:'immersive-vr',
          referenceSpaceType:'local-floor',
          optionalFeatures:Array.isArray(options.uiOptions?.optionalFeatures) ? options.uiOptions.optionalFeatures : [],
          requiredFeatures:Array.isArray(options.uiOptions?.requiredFeatures) ? options.uiOptions.requiredFeatures : []
        }
      };
      delete safe.outputCanvasOptions;
      delete safe.ignoreNativeCameraTransformation;
      const helper = await original.call(this, safe);
      return install(this, helper);
    }
    patched.__ucanV290ControlsPatched = true;
    patched.__ucanOriginal = original;
    B.Scene.prototype.createDefaultXRExperienceAsync = patched;
  }

  window.__UCAN_UNIFIED_XR_BOOT__ = {
    version:VERSION,
    build:BUILD,
    patched:true,
    ready:true,
    leftStickMovement:true,
    rightStickSnapTurn:true,
    triggerRaySelection:true,
    rooftopStairsBidirectional:true,
    xrReadableSigns:true,
    xrCelestialInformation:true
  };
})();
