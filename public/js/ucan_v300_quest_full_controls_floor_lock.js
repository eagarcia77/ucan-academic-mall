(() => {
  'use strict';

  const VERSION = 'V300';
  const BUILD = 'V300-20260723-FULL-CONTROLS-FLOOR-LOCK';
  const B = window.BABYLON;
  if (!B) return;

  window.__UCAN_QUEST_V300_SUPERSEDES_V299__ = true;

  const XR_STATE = B.WebXRState || Object.freeze({ NOT_IN_XR:0, ENTERING_XR:1, IN_XR:2, EXITING_XR:3 });
  const LEVEL = Object.freeze({ one:0, two:8.2, three:16.4, roof:27.2 });
  const SPEED = Object.freeze({ comfort:3.4, normal:5.0, sprint:7.0 });
  const TURN_SPEED = Object.freeze({ comfort:1.2, normal:1.9 });
  const WORLD = Object.freeze({ minX:-73, maxX:73, minZ:-59, maxZ:59 });
  const STAIR = Object.freeze({ minX:39.4, maxX:48.6, minZ:4.5, maxZ:44.0, bottomZ:39.0, topZ:10.5 });
  const DEAD_ZONE = 0.18;
  const SPRINT_THRESHOLD = 0.82;
  const MAX_FRAME_DT = 0.12;
  const MAX_MOVE_SUBSTEP = 0.14;
  const PLAYER_HEIGHT = 1.72;
  const JUMP_DURATION_MS = 720;
  const JUMP_HEIGHT = 0.92;

  const state = {
    scene:null,
    helper:null,
    xr:null,
    desktop:null,
    installed:false,
    inXR:false,
    questDevice:false,
    controllers:new Map(),
    floor:LEVEL.one,
    rooftopCommitted:false,
    sprintHeld:false,
    jumpRequested:false,
    jumpActive:false,
    jumpStart:0,
    jumpBaseGround:0,
    stableFloorMaterial:null,
    floorMeshes:new Map(),
    terraceHidden:new Map(),
    terracePanels:[],
    glassMaterials:new Map(),
    glassMeshes:new Map(),
    collisionCache:[],
    collisionCacheAt:0,
    movementFrames:0,
    lowFpsCompensatedFrames:0,
    movementSubsteps:0,
    normalFrames:0,
    sprintFrames:0,
    comfortFrames:0,
    floorThreeMovementFrames:0,
    jumpCount:0,
    jumpFrames:0,
    turnFrames:0,
    collisionChecks:0,
    collisionBlocks:0,
    collisionSlides:0,
    stairFrames:0,
    terraceCenterRemoved:0,
    floorMeshesLocked:0,
    floorMaterialCorrections:0,
    glassMaterialsFixed:0,
    glassMeshesFixed:0,
    closeButtonUses:0,
    lastAxes:{ move:{x:0,y:0}, turn:{x:0,y:0} },
    lastAxisSource:{ move:'none', turn:'none' },
    lastSpeed:0,
    lastFrameDt:0,
    lastError:null
  };

  const finite = value => Number.isFinite(Number(value));
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  function questDetected() {
    const ua = String(navigator.userAgent || '');
    const brands = Array.isArray(navigator.userAgentData?.brands)
      ? navigator.userAgentData.brands.map(item => item?.brand || '').join(' ')
      : '';
    if (/OculusBrowser|Meta Quest|Quest 2|Quest 3|Quest Pro/i.test(`${ua} ${brands}`)) return true;
    return [...state.controllers.values()].some(record =>
      (record.controller?.inputSource?.profiles || []).some(profile => /oculus|meta|quest|touch/i.test(String(profile)))
    );
  }

  function xrActive() {
    const current = state.helper?.baseExperience?.state;
    return current === XR_STATE.ENTERING_XR || current === XR_STATE.IN_XR;
  }

  function comfortEnabled() {
    return document.getElementById('comfortBtn')?.getAttribute('aria-pressed') === 'true';
  }

  function stableFloor() {
    try {
      const floor = Number(window.__UCAN_FLOOR_STATE_V287__?.getState?.()?.floorBase);
      if (finite(floor)) return floor;
    } catch (_) {}
    return state.floor;
  }

  function setStableFloor(base, reason) {
    state.floor = Number(base);
    try { window.__UCAN_FLOOR_STATE_V287__?.setFloorBase?.(base, reason); } catch (_) {}
  }

  function eyeHeight() {
    const values = [state.xr?.realWorldHeight, state.xr?._realWorldHeight, 1.72];
    return values.map(Number).find(value => finite(value) && value >= 0.8 && value <= 2.4) || 1.72;
  }

  function browserRideActive() {
    try { return Boolean(window.__ucanV254IsRiding?.()); } catch (_) { return false; }
  }

  function insideRooftopStairs(position) {
    return Boolean(position && position.x >= STAIR.minX && position.x <= STAIR.maxX && position.z >= STAIR.minZ && position.z <= STAIR.maxZ);
  }

  function rooftopGround(position) {
    if (!insideRooftopStairs(position)) return null;
    const progress = clamp((STAIR.bottomZ - position.z) / (STAIR.bottomZ - STAIR.topZ), 0, 1);
    state.stairFrames += 1;
    if (progress >= 0.80) {
      state.rooftopCommitted = true;
      setStableFloor(LEVEL.roof, 'quest-v300:rooftop-arrival');
    } else if (progress <= 0.02 && state.rooftopCommitted) {
      state.rooftopCommitted = false;
      setStableFloor(LEVEL.three, 'quest-v300:floor-three-arrival');
    }
    return LEVEL.three + (LEVEL.roof - LEVEL.three) * progress;
  }

  function theaterGround(position, floor) {
    if (Math.abs(floor - LEVEL.three) > 0.35) return null;
    const center = position.x > -4.8 && position.x < 1.2 && position.z > -14 && position.z < 18.8;
    const side = position.x > 18.2 && position.x < 22.8 && position.z > -8 && position.z < 18.8;
    if (!center && !side) return null;
    const z0 = center ? -12 : -7;
    const z1 = 17.4;
    const rise = center ? 2.38 : 2.04;
    return LEVEL.three + rise * clamp((position.z - z0) / (z1 - z0), 0, 1);
  }

  function groundFor(position) {
    const stair = rooftopGround(position);
    if (stair != null) return stair;
    let floor = stableFloor();
    if (state.rooftopCommitted) floor = LEVEL.roof;
    const theater = theaterGround(position, floor);
    return theater == null ? floor : theater;
  }

  function motionComponent(controller, type, ids = []) {
    const motion = controller?.motionController;
    try {
      const direct = motion?.getComponentOfType?.(type);
      if (direct) return direct;
    } catch (_) {}
    for (const id of ids) {
      try {
        const component = motion?.getComponent?.(id);
        if (component) return component;
      } catch (_) {}
    }
    return null;
  }

  function normalizeAxis(value) {
    const number = finite(value) ? Number(value) : 0;
    return Math.abs(number) >= DEAD_ZONE ? clamp(number, -1, 1) : 0;
  }

  function controllerAxes(controller, purpose) {
    const candidates = [];
    const thumbstick = motionComponent(controller, 'thumbstick', ['xr-standard-thumbstick', 'thumbstick']);
    const componentAxes = thumbstick?.axes || thumbstick?.value?.axes;
    if (componentAxes) {
      if (finite(componentAxes.x) && finite(componentAxes.y)) candidates.push({ x:Number(componentAxes.x), y:Number(componentAxes.y), source:'motion-component' });
      else if (finite(componentAxes[0]) && finite(componentAxes[1])) candidates.push({ x:Number(componentAxes[0]), y:Number(componentAxes[1]), source:'motion-array' });
    }
    const pad = controller?.inputSource?.gamepad || controller?.motionController?.gamepadObject || controller?.motionController?.gamepad;
    const axes = Array.from(pad?.axes || []);
    if (axes.length >= 2) candidates.push({ x:Number(axes[0] || 0), y:Number(axes[1] || 0), source:'gamepad-0-1' });
    if (axes.length >= 4) candidates.push({ x:Number(axes[2] || 0), y:Number(axes[3] || 0), source:'gamepad-2-3' });
    const best = candidates.sort((a, b) => Math.hypot(b.x, b.y) - Math.hypot(a.x, a.y))[0] || { x:0, y:0, source:'none' };
    state.lastAxisSource[purpose] = best.source;
    return { x:normalizeAxis(best.x), y:normalizeAxis(best.y) };
  }

  function controllerForHand(hand) {
    const records = [...state.controllers.values()];
    return records.find(record => String(record.controller?.inputSource?.handedness || record.controller?.motionController?.handedness) === hand)?.controller ||
      (hand === 'left' ? records[0]?.controller : records[1]?.controller) || null;
  }

  function componentPressed(controller, type, ids, fallbackIndexes = []) {
    const component = motionComponent(controller, type, ids);
    if (component?.pressed || Number(component?.value || 0) > 0.55) return true;
    const pad = controller?.inputSource?.gamepad || controller?.motionController?.gamepadObject || controller?.motionController?.gamepad;
    return fallbackIndexes.some(index => Boolean(pad?.buttons?.[index]?.pressed || Number(pad?.buttons?.[index]?.value || 0) > 0.55));
  }

  function horizontalBasis(camera) {
    let forward = null;
    try { forward = camera?.getForwardRay?.(1)?.direction?.clone?.(); } catch (_) {}
    if (!forward) forward = new B.Vector3(0, 0, 1);
    forward.y = 0;
    if (forward.lengthSquared() < 0.0001) forward.set(0, 0, 1);
    forward.normalize();
    return { forward, right:new B.Vector3(forward.z, 0, -forward.x).normalize() };
  }

  function cameraYaw(camera) {
    try { if (camera?.rotationQuaternion?.toEulerAngles) return camera.rotationQuaternion.toEulerAngles().y; } catch (_) {}
    return Number(camera?.rotation?.y || 0);
  }

  function setCameraYaw(camera, value) {
    if (!camera) return;
    try {
      if (camera.rotationQuaternion && B.Quaternion?.FromEulerAngles) camera.rotationQuaternion.copyFrom(B.Quaternion.FromEulerAngles(0, value, 0));
      else if (camera.rotation) camera.rotation.y = value;
    } catch (_) {}
  }

  function registerController(controller) {
    if (!controller) return;
    const key = controller.uniqueId || controller;
    if (state.controllers.has(key)) return;
    state.controllers.set(key, { controller, jumpDown:false, closeDown:false });
    state.questDevice = questDetected();
  }

  function installControllers() {
    const input = state.helper?.input;
    if (!input) return;
    for (const controller of input.controllers || []) registerController(controller);
    input.onControllerAddedObservable?.add?.(registerController);
    input.onControllerRemovedObservable?.add?.(controller => state.controllers.delete(controller.uniqueId || controller));
  }

  function requestJump() {
    if (state.jumpActive || browserRideActive() || insideRooftopStairs(state.xr?.position)) return false;
    state.jumpRequested = true;
    return true;
  }

  function beginJump(ground) {
    if (!state.jumpRequested || state.jumpActive) return;
    state.jumpRequested = false;
    state.jumpActive = true;
    state.jumpStart = performance.now();
    state.jumpBaseGround = ground;
    state.jumpCount += 1;
    window.__UCAN_API__?.setStatus?.('Brinco Meta Quest activado.');
  }

  function jumpOffset(ground) {
    if (state.jumpRequested && !state.jumpActive) beginJump(ground);
    if (!state.jumpActive) return 0;
    const progress = (performance.now() - state.jumpStart) / JUMP_DURATION_MS;
    if (progress >= 1 || browserRideActive()) {
      state.jumpActive = false;
      return 0;
    }
    state.jumpFrames += 1;
    const t = clamp(progress, 0, 1);
    return 4 * JUMP_HEIGHT * t * (1 - t);
  }

  function pollControllerButtons() {
    const left = controllerForHand('left');
    const right = controllerForHand('right');
    const moveAxes = left ? controllerAxes(left, 'move') : { x:0, y:0 };
    const fullStick = Math.hypot(moveAxes.x, moveAxes.y) >= SPRINT_THRESHOLD;
    const leftStickClick = left ? componentPressed(left, 'thumbstick', ['xr-standard-thumbstick', 'thumbstick'], [3]) : false;
    const leftGrip = left ? componentPressed(left, 'squeeze', ['xr-standard-squeeze', 'squeeze'], [1]) : false;
    state.sprintHeld = fullStick || leftStickClick || leftGrip;

    for (const record of state.controllers.values()) {
      const controller = record.controller;
      const hand = String(controller?.inputSource?.handedness || controller?.motionController?.handedness || '');
      const stickClick = componentPressed(controller, 'thumbstick', ['xr-standard-thumbstick', 'thumbstick'], [3]);
      const primary = componentPressed(controller, 'button', hand === 'right' ? ['a-button'] : ['x-button'], [4]);
      const secondary = componentPressed(controller, 'button', hand === 'right' ? ['b-button'] : ['y-button'], [5]);
      const jumpDown = (hand === 'right' && stickClick) || primary;
      if (jumpDown && !record.jumpDown) requestJump();
      record.jumpDown = jumpDown;
      if (secondary && !record.closeDown) {
        try { window.__UCAN_UNIVERSAL_SIGN_WINDOW__?.close?.(); } catch (_) {}
        state.closeButtonUses += 1;
      }
      record.closeDown = secondary;
    }
    return moveAxes;
  }

  function applyTurn(dt) {
    const right = controllerForHand('right');
    const axes = right ? controllerAxes(right, 'turn') : { x:0, y:0 };
    state.lastAxes.turn = axes;
    if (Math.abs(axes.x) < 0.22 || Math.abs(axes.y) > 0.72) return;
    const speed = comfortEnabled() ? TURN_SPEED.comfort : TURN_SPEED.normal;
    setCameraYaw(state.xr, cameraYaw(state.xr) + axes.x * speed * dt);
    state.turnFrames += 1;
  }

  function isLowHorizontalSurface(mesh) {
    const metadata = mesh?.metadata || {};
    const name = String(mesh?.name || '');
    if (metadata.floorSeparator || metadata.walkable || metadata.teleportable || metadata.questSolidFloorV299 || metadata.questSolidFloorV300) return true;
    return /gran losa|junta |eje central|eje longitudinal|ruta avatar|ruta de circulación|zona segura VR|zona VR |alfombra|pasillo núcleo|pasillo lateral|deck rooftop|piso completo|descanso .*escalera|plataforma (?:inicio|fin)|peldaño|rampa invisible/i.test(name);
  }

  function isCollisionObstacle(mesh) {
    if (!mesh || mesh.checkCollisions !== true || mesh.isVisible === false || Number(mesh.visibility ?? 1) <= 0) return false;
    if (typeof mesh.isEnabled === 'function' && !mesh.isEnabled()) return false;
    if (isLowHorizontalSurface(mesh)) return false;
    return true;
  }

  function refreshCollisionCache(force = false) {
    const now = performance.now();
    if (!force && now - state.collisionCacheAt < 2500) return;
    state.collisionCacheAt = now;
    const cache = [];
    for (const mesh of state.scene?.meshes || []) {
      if (!isCollisionObstacle(mesh)) continue;
      try {
        mesh.computeWorldMatrix(true);
        const box = mesh.getBoundingInfo().boundingBox;
        const min = box.minimumWorld;
        const max = box.maximumWorld;
        cache.push({ mesh, minX:min.x, maxX:max.x, minY:min.y, maxY:max.y, minZ:min.z, maxZ:max.z });
      } catch (_) {}
    }
    state.collisionCache = cache;
  }

  function blockedAt(position, ground) {
    const radius = 0.38;
    const minY = ground + 0.10;
    const maxY = ground + 1.62;
    state.collisionChecks += 1;
    for (const item of state.collisionCache) {
      if (item.maxY < minY || item.minY > maxY) continue;
      if (position.x + radius < item.minX || position.x - radius > item.maxX) continue;
      if (position.z + radius < item.minZ || position.z - radius > item.maxZ) continue;
      return true;
    }
    return false;
  }

  function moveSingleStep(step, ground) {
    const proposed = state.xr.position.add(step);
    if (insideRooftopStairs(state.xr.position) || insideRooftopStairs(proposed)) {
      proposed.x = clamp(proposed.x, STAIR.minX + 0.55, STAIR.maxX - 0.55);
      state.xr.position.x = clamp(proposed.x, WORLD.minX, WORLD.maxX);
      state.xr.position.z = clamp(proposed.z, WORLD.minZ, WORLD.maxZ);
      return;
    }
    if (!blockedAt(proposed, ground)) {
      state.xr.position.x = proposed.x;
      state.xr.position.z = proposed.z;
    } else {
      state.collisionBlocks += 1;
      let moved = false;
      const xOnly = state.xr.position.add(new B.Vector3(step.x, 0, 0));
      if (Math.abs(step.x) > 1e-6 && !blockedAt(xOnly, ground)) {
        state.xr.position.x = xOnly.x;
        moved = true;
      }
      const zOnly = state.xr.position.add(new B.Vector3(0, 0, step.z));
      if (Math.abs(step.z) > 1e-6 && !blockedAt(zOnly, ground)) {
        state.xr.position.z = zOnly.z;
        moved = true;
      }
      if (moved) state.collisionSlides += 1;
    }
    state.xr.position.x = clamp(state.xr.position.x, WORLD.minX, WORLD.maxX);
    state.xr.position.z = clamp(state.xr.position.z, WORLD.minZ, WORLD.maxZ);
  }

  function mirrorBrowserRide() {
    if (!browserRideActive() || !state.desktop?.position || !state.xr?.position) return false;
    state.xr.position.x = state.desktop.position.x;
    state.xr.position.z = state.desktop.position.z;
    state.xr.position.y = state.desktop.position.y - PLAYER_HEIGHT + eyeHeight();
    return true;
  }

  function syncDesktop(ground) {
    if (!state.desktop?.position || !state.xr?.position) return;
    state.desktop.position.x = state.xr.position.x;
    state.desktop.position.z = state.xr.position.z;
    state.desktop.position.y = ground + PLAYER_HEIGHT;
  }

  function applyMovement(dt, moveAxes) {
    if (mirrorBrowserRide()) return;
    state.lastAxes.move = moveAxes;
    const magnitude = Math.min(1, Math.hypot(moveAxes.x, moveAxes.y));
    const groundBefore = groundFor(state.xr.position);
    if (magnitude < 0.01) {
      state.lastSpeed = 0;
      state.xr.position.y = groundBefore + eyeHeight() + jumpOffset(groundBefore);
      syncDesktop(groundBefore);
      return;
    }

    const comfort = comfortEnabled();
    const speed = comfort ? SPEED.comfort : (state.sprintHeld ? SPEED.sprint : SPEED.normal);
    state.lastSpeed = speed;
    const digitalX = Math.abs(moveAxes.x) >= DEAD_ZONE ? Math.sign(moveAxes.x) : 0;
    const digitalY = Math.abs(moveAxes.y) >= DEAD_ZONE ? Math.sign(moveAxes.y) : 0;
    const basis = horizontalBasis(state.xr);
    const direction = basis.right.scale(digitalX).add(basis.forward.scale(-digitalY));
    if (direction.lengthSquared() > 1) direction.normalize();

    const totalDistance = speed * dt;
    const substeps = Math.max(1, Math.ceil(totalDistance / MAX_MOVE_SUBSTEP));
    const step = direction.scale(totalDistance / substeps);
    for (let index = 0; index < substeps; index += 1) {
      const ground = groundFor(state.xr.position);
      moveSingleStep(step, ground);
      state.movementSubsteps += 1;
    }

    const groundAfter = groundFor(state.xr.position);
    state.xr.position.y = groundAfter + eyeHeight() + jumpOffset(groundAfter);
    syncDesktop(groundAfter);
    state.movementFrames += 1;
    if (dt > 0.052) state.lowFpsCompensatedFrames += 1;
    if (Math.abs(stableFloor() - LEVEL.three) <= 0.4 && !insideRooftopStairs(state.xr.position)) state.floorThreeMovementFrames += 1;
    if (comfort) state.comfortFrames += 1;
    else if (speed === SPEED.sprint) state.sprintFrames += 1;
    else state.normalFrames += 1;
  }

  function createStableFloorMaterial() {
    if (state.stableFloorMaterial || !state.scene) return state.stableFloorMaterial;
    const material = new B.StandardMaterial('piso estable Meta Quest V300', state.scene);
    const color = B.Color3.FromHexString('#7f898d');
    material.diffuseColor = color;
    material.emissiveColor = color;
    material.specularColor = B.Color3.Black();
    material.disableLighting = true;
    material.backFaceCulling = true;
    material.alpha = 1;
    state.stableFloorMaterial = material;
    return material;
  }

  function shouldLockFloor(mesh) {
    if (!mesh || mesh.isVisible === false || typeof mesh.getBoundingInfo !== 'function') return false;
    const name = String(mesh.name || '');
    if (/peldaño|escalera|rampa|baranda|pasamanos|pared|techo|plafón|viga|mesa|silla|sofá|sofa|planta|pantalla|cartel|rótulo|rotulo/i.test(name)) return false;
    const metadata = mesh.metadata || {};
    const nameMatch = /gran losa|ruta avatar|ruta de circulación|zona segura VR|zona VR |alfombra|pasillo núcleo|pasillo lateral|deck rooftop|piso completo|eje central|eje longitudinal|junta /i.test(name);
    if (!(metadata.floorSeparator || metadata.walkable || metadata.teleportable || metadata.questSolidFloorV299 || metadata.questSolidFloorV300 || nameMatch)) return false;
    try {
      mesh.computeWorldMatrix(true);
      const ext = mesh.getBoundingInfo().boundingBox.extendSizeWorld;
      return ext.y <= 0.55;
    } catch (_) { return false; }
  }

  function lockFloorMaterials() {
    const stable = createStableFloorMaterial();
    if (!stable) return;
    for (const mesh of state.scene?.meshes || []) {
      if (!shouldLockFloor(mesh)) continue;
      if (!state.floorMeshes.has(mesh)) state.floorMeshes.set(mesh, { material:mesh.material, receiveShadows:mesh.receiveShadows });
      if (mesh.material !== stable) {
        mesh.material = stable;
        state.floorMaterialCorrections += 1;
      }
      mesh.receiveShadows = false;
    }
    state.floorMeshesLocked = state.floorMeshes.size;
  }

  function restoreFloorMaterials() {
    for (const [mesh, original] of state.floorMeshes) {
      try { mesh.material = original.material; mesh.receiveShadows = original.receiveShadows; } catch (_) {}
    }
    state.floorMeshes.clear();
    try { state.stableFloorMaterial?.dispose?.(); } catch (_) {}
    state.stableFloorMaterial = null;
  }

  function stabilizeGlass() {
    const blend = B.Material?.MATERIAL_ALPHABLEND ?? 2;
    for (const material of state.scene?.materials || []) {
      if (!/cristal|glass|vidrio/i.test(String(material?.name || ''))) continue;
      if (!state.glassMaterials.has(material)) state.glassMaterials.set(material, {
        needDepthPrePass:material.needDepthPrePass,
        disableDepthWrite:material.disableDepthWrite,
        forceDepthWrite:material.forceDepthWrite,
        backFaceCulling:material.backFaceCulling,
        transparencyMode:material.transparencyMode
      });
      material.needDepthPrePass = false;
      material.disableDepthWrite = true;
      if ('forceDepthWrite' in material) material.forceDepthWrite = false;
      material.backFaceCulling = false;
      if ('transparencyMode' in material) material.transparencyMode = blend;
    }
    for (const mesh of state.scene?.meshes || []) {
      if (!/cristal|glass|vidrio/i.test(String(mesh?.material?.name || ''))) continue;
      if (!state.glassMeshes.has(mesh)) state.glassMeshes.set(mesh, { receiveShadows:mesh.receiveShadows, renderingGroupId:mesh.renderingGroupId, alphaIndex:mesh.alphaIndex });
      mesh.receiveShadows = false;
      mesh.renderingGroupId = Math.max(2, Number(mesh.renderingGroupId || 0));
      mesh.alphaIndex = Math.max(30, Number(mesh.alphaIndex || 0));
    }
    state.glassMaterialsFixed = state.glassMaterials.size;
    state.glassMeshesFixed = state.glassMeshes.size;
  }

  function restoreGlass() {
    for (const [material, original] of state.glassMaterials) {
      try {
        material.needDepthPrePass = original.needDepthPrePass;
        material.disableDepthWrite = original.disableDepthWrite;
        if ('forceDepthWrite' in material) material.forceDepthWrite = original.forceDepthWrite;
        material.backFaceCulling = original.backFaceCulling;
        if ('transparencyMode' in material) material.transparencyMode = original.transparencyMode;
      } catch (_) {}
    }
    for (const [mesh, original] of state.glassMeshes) {
      try { mesh.receiveShadows = original.receiveShadows; mesh.renderingGroupId = original.renderingGroupId; mesh.alphaIndex = original.alphaIndex; } catch (_) {}
    }
    state.glassMaterials.clear();
    state.glassMeshes.clear();
  }

  function createTerracePanel(name, x1, x2, z1, z2) {
    const mesh = B.MeshBuilder.CreateBox(name, { width:x2-x1, height:0.07, depth:z2-z1 }, state.scene);
    mesh.position.set((x1+x2)/2, LEVEL.roof + 0.035, (z1+z2)/2);
    mesh.material = createStableFloorMaterial();
    mesh.checkCollisions = false;
    mesh.isPickable = true;
    mesh.receiveShadows = false;
    mesh.metadata = { walkable:true, teleportable:true, rooftop:true, questSolidFloorV300:true };
    state.terracePanels.push(mesh);
  }

  function removeTerraceCenterAndCompleteFloor() {
    for (const mesh of [...(state.scene?.meshes || [])]) {
      const name = String(mesh?.name || '');
      if (/terraza piso completo Quest V299/i.test(name)) {
        try { mesh.dispose?.(); } catch (_) {}
        continue;
      }
      let pos = null;
      try { pos = mesh.getAbsolutePosition?.(); } catch (_) {}
      const nearRoof = pos && pos.y >= LEVEL.roof - 0.8 && pos.y <= LEVEL.roof + 12;
      const central = pos && Math.abs(pos.x) < 52 && Math.abs(pos.z) < 50;
      const feature = /tragaluz|hueco.*atrio|atrio.*central|centro.*terraza|terraza.*centro|jardín.*central|jardin.*central|fuente.*central|pérgola.*central|pergola.*central/i.test(name) || mesh?.metadata?.centralTerraceFeature === true;
      const protectedItem = /panel|mapa|calendario|reloj|agenda|clima|luna|planeta|estrella|etiqueta|telescopio|escalera|peldaño|baranda|pasamanos/i.test(name);
      if (!(nearRoof && central && feature) || protectedItem) continue;
      if (!state.terraceHidden.has(mesh)) state.terraceHidden.set(mesh, mesh.isEnabled?.() !== false);
      mesh.setEnabled?.(false);
      mesh.checkCollisions = false;
      state.terraceCenterRemoved += 1;
    }
    if (state.terracePanels.length) return;
    createTerracePanel('terraza completa Quest V300 oeste', -72, STAIR.minX, -60, 60);
    createTerracePanel('terraza completa Quest V300 este', STAIR.maxX, 72, -60, 60);
    createTerracePanel('terraza completa Quest V300 sur', STAIR.minX, STAIR.maxX, -60, STAIR.minZ);
    createTerracePanel('terraza completa Quest V300 norte', STAIR.minX, STAIR.maxX, STAIR.maxZ, 60);
  }

  function restoreTerrace() {
    for (const mesh of state.terracePanels.splice(0)) {
      try { mesh.dispose?.(); } catch (_) {}
    }
    for (const [mesh, enabled] of state.terraceHidden) {
      try { mesh.setEnabled?.(enabled); } catch (_) {}
    }
    state.terraceHidden.clear();
  }

  function enterRuntime() {
    state.inXR = true;
    state.questDevice = questDetected();
    state.xr = state.helper?.baseExperience?.camera || state.xr;
    state.desktop = window.__UCAN_API__?.getCamera?.() || state.desktop;
    state.floor = stableFloor();
    state.rooftopCommitted = Math.abs(state.floor - LEVEL.roof) <= 0.4;
    window.__UCAN_BROWSER_XR_EMULATION_ACTIVE__ = true;
    refreshCollisionCache(true);
    stabilizeGlass();
    removeTerraceCenterAndCompleteFloor();
    lockFloorMaterials();
    window.__UCAN_API__?.setStatus?.('Meta Quest V300: correr, brincar, giro continuo y piso estable activados.');
    updateAudit();
  }

  function exitRuntime() {
    state.inXR = false;
    state.sprintHeld = false;
    state.jumpRequested = false;
    state.jumpActive = false;
    window.__UCAN_BROWSER_XR_EMULATION_ACTIVE__ = false;
    restoreFloorMaterials();
    restoreGlass();
    restoreTerrace();
    updateAudit();
  }

  function frame() {
    const active = xrActive();
    if (active && !state.inXR) enterRuntime();
    if (!active && state.inXR) exitRuntime();
    if (!state.inXR) return;
    if (!state.questDevice) state.questDevice = questDetected();
    if (!state.questDevice) return;
    state.xr = state.helper?.baseExperience?.camera || state.xr;
    refreshCollisionCache();
    stabilizeGlass();
    removeTerraceCenterAndCompleteFloor();
    lockFloorMaterials();
    const rawDt = clamp((state.scene.getEngine().getDeltaTime() || 16) / 1000, 0.001, MAX_FRAME_DT);
    state.lastFrameDt = rawDt;
    const moveAxes = pollControllerButtons();
    applyTurn(rawDt);
    applyMovement(rawDt, moveAxes);
    updateAudit();
  }

  function recordError(stage, error) {
    state.lastError = { stage, name:String(error?.name || 'Error'), message:String(error?.message || error || 'Error desconocido'), at:new Date().toISOString() };
    console.error(`[UCAN ${VERSION}] ${stage}:`, error);
    updateAudit();
  }

  function updateAudit() {
    const data = {
      version:VERSION,
      build:BUILD,
      installed:state.installed,
      inXR:state.inXR,
      questDevice:state.questDevice,
      v299MovementSuperseded:true,
      singleMovementAuthority:true,
      fullTouchControllerMapping:true,
      leftStickMovement:true,
      rightStickSmoothTurn:true,
      leftStickClickSprint:true,
      leftGripSprint:true,
      fullStickSprint:true,
      rightStickClickJump:true,
      primaryButtonJump:true,
      secondaryButtonClosesWindow:true,
      triggerSelectionPreservedFromV299:true,
      browserNormalSpeed:SPEED.normal,
      browserComfortSpeed:SPEED.comfort,
      browserSprintSpeed:SPEED.sprint,
      lowFpsMovementCompensation:true,
      maxFrameDt:MAX_FRAME_DT,
      movementSubstepsEnabled:true,
      maximumMoveSubstep:MAX_MOVE_SUBSTEP,
      floorThreeSpeedStable:true,
      jumpEnabled:true,
      jumpHeight:JUMP_HEIGHT,
      jumpDurationMs:JUMP_DURATION_MS,
      floorMaterialLockedInXR:true,
      floorReceivesAvatarShadows:false,
      floorColorStableDuringMovement:true,
      floorStableColor:'#7f898d',
      glassCompatibility:true,
      rooftopCenterRemoved:true,
      rooftopFullSurface:true,
      rooftopStairOpeningPreserved:true,
      rooftopStairsManual:true,
      movementFrames:state.movementFrames,
      lowFpsCompensatedFrames:state.lowFpsCompensatedFrames,
      movementSubsteps:state.movementSubsteps,
      normalFrames:state.normalFrames,
      sprintFrames:state.sprintFrames,
      comfortFrames:state.comfortFrames,
      floorThreeMovementFrames:state.floorThreeMovementFrames,
      jumpCount:state.jumpCount,
      jumpFrames:state.jumpFrames,
      turnFrames:state.turnFrames,
      collisionChecks:state.collisionChecks,
      collisionBlocks:state.collisionBlocks,
      collisionSlides:state.collisionSlides,
      stairFrames:state.stairFrames,
      terraceCenterRemoved:state.terraceCenterRemoved,
      terraceFloorPanels:state.terracePanels.length,
      floorMeshesLocked:state.floorMeshesLocked,
      floorMaterialCorrections:state.floorMaterialCorrections,
      glassMaterialsFixed:state.glassMaterialsFixed,
      glassMeshesFixed:state.glassMeshesFixed,
      closeButtonUses:state.closeButtonUses,
      controllers:state.controllers.size,
      sprintHeld:state.sprintHeld,
      jumpActive:state.jumpActive,
      rooftopCommitted:state.rooftopCommitted,
      lastAxes:state.lastAxes,
      lastAxisSource:state.lastAxisSource,
      lastSpeed:state.lastSpeed,
      lastFrameDt:state.lastFrameDt,
      lastError:state.lastError,
      getState:() => ({
        inXR:state.inXR,
        questDevice:state.questDevice,
        controllers:state.controllers.size,
        movementFrames:state.movementFrames,
        lowFpsCompensatedFrames:state.lowFpsCompensatedFrames,
        floorThreeMovementFrames:state.floorThreeMovementFrames,
        sprintFrames:state.sprintFrames,
        jumpCount:state.jumpCount,
        jumpActive:state.jumpActive,
        stairFrames:state.stairFrames,
        floorMeshesLocked:state.floorMeshesLocked,
        terraceFloorPanels:state.terracePanels.length,
        glassMaterialsFixed:state.glassMaterialsFixed,
        lastSpeed:state.lastSpeed,
        lastAxes:state.lastAxes,
        lastAxisSource:state.lastAxisSource,
        lastError:state.lastError
      })
    };
    window.__UCAN_QUEST_V300__ = data;
    window.__UCAN_UNIFIED_XR_AUDIT__ = data;
    window.__UCAN_QUEST_CONTROLS_V300__ = data;
  }

  function install(scene, helper) {
    if (state.installed) return;
    state.installed = true;
    state.scene = scene;
    state.helper = helper;
    state.xr = helper.baseExperience?.camera || null;
    state.desktop = window.__UCAN_API__?.getCamera?.() || null;
    state.floor = stableFloor();
    installControllers();
    helper.baseExperience?.onStateChangedObservable?.add?.(xrState => {
      if (xrState === XR_STATE.ENTERING_XR || xrState === XR_STATE.IN_XR) enterRuntime();
      else if (xrState === XR_STATE.NOT_IN_XR) exitRuntime();
    });
    scene.onBeforeRenderObservable.add(() => {
      try { frame(); } catch (error) { recordError('frame', error); }
    });
    if (xrActive()) enterRuntime();
    updateAudit();
    console.info(`[UCAN ${VERSION}] Controles completos y piso estable Meta Quest instalados.`);
  }

  function boot(attempt = 0) {
    const scene = window.__UCAN_API__?.getScene?.();
    const helper = window.__UCAN_XR_HELPER__;
    const v299Ready = window.__UCAN_BROWSER_XR_EMULATION_V299__?.version === 'V299';
    const floorReady = window.__UCAN_FLOOR_STATE_V287__?.version === 'V287';
    if (scene && helper?.baseExperience && v299Ready && floorReady) return install(scene, helper);
    if (attempt < 400) window.setTimeout(() => boot(attempt + 1), 100);
    else {
      state.lastError = { stage:'boot', name:'Timeout', message:'No se encontró la escena, WebXR, V299 o V287.', at:new Date().toISOString() };
      updateAudit();
    }
  }

  updateAudit();
  boot();
})();
