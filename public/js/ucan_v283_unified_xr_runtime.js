(() => {
  'use strict';

  const VERSION = 'V283';
  const BUILD = 'V283-20260720-UNIFIED-XR-DESKTOP-PARITY';
  const B = window.BABYLON;
  if (!B?.Scene?.prototype?.createDefaultXRExperienceAsync) return;

  const LEVEL = Object.freeze({ one:0, two:8.2, three:16.4, roof:27.2 });
  const FLOORS = Object.freeze([LEVEL.one, LEVEL.two, LEVEL.three, LEVEL.roof]);
  const PLAYER_HEIGHT = 1.72;
  const SPEED = Object.freeze({ comfort:3.4, natural:5.0, fast:7.0 });
  const TURN_SPEED = Object.freeze({ comfort:1.2, natural:1.9 });
  const WORLD = Object.freeze({ minX:-73, maxX:73, minZ:-59, maxZ:59 });
  const DEAD_ZONE = 0.18;
  const ENTRY_RADIUS = 4.6;
  const WRONG_WAY_RADIUS = 4.8;
  const XR_STATE = B.WebXRState || Object.freeze({ NOT_IN_XR:0, ENTERING_XR:1, IN_XR:2, EXITING_XR:3 });

  const AREAS = Object.freeze({
    foodcourt:{ floor:LEVEL.one, x:0, z:42, yaw:Math.PI },
    cafeteria:{ floor:LEVEL.one, x:-56, z:12, yaw:Math.PI },
    library:{ floor:LEVEL.one, x:56, z:12, yaw:Math.PI },
    floor2:{ floor:LEVEL.two, x:0, z:42, yaw:Math.PI },
    class201:{ floor:LEVEL.two, x:-56, z:12, yaw:Math.PI },
    class202:{ floor:LEVEL.two, x:-28, z:-20, yaw:Math.PI },
    class203:{ floor:LEVEL.two, x:0, z:-20, yaw:Math.PI },
    class204:{ floor:LEVEL.two, x:28, z:-20, yaw:Math.PI },
    class205:{ floor:LEVEL.two, x:56, z:12, yaw:Math.PI },
    theater:{ floor:LEVEL.three, x:0, z:38, yaw:Math.PI },
    rooftop:{ floor:LEVEL.roof, x:0, z:42, yaw:Math.PI },
    rooftopWeather:{ floor:LEVEL.roof, x:-33, z:38, yaw:0 },
    rooftopAgenda:{ floor:LEVEL.roof, x:34, z:37, yaw:0 },
    rooftopMoon:{ floor:LEVEL.roof, x:-33, z:-38, yaw:Math.PI },
    rooftopSky:{ floor:LEVEL.roof, x:0, z:-37, yaw:Math.PI },
    rooftopCalendar:{ floor:LEVEL.roof, x:34, z:-37, yaw:Math.PI }
  });

  const ROUTES = Object.freeze([
    { id:'up12', kind:'escalator', direction:'up', fromFloor:LEVEL.one, toFloor:LEVEL.two, x:-20, minX:-24.8, maxX:-15.2, fromZ:32, toZ:10, duration:3600, message:'Subiendo al Piso 2' },
    { id:'down21', kind:'escalator', direction:'down', fromFloor:LEVEL.two, toFloor:LEVEL.one, x:-8, minX:-12.8, maxX:-3.2, fromZ:10, toZ:32, duration:3600, message:'Bajando al Piso 1' },
    { id:'up23', kind:'escalator', direction:'up', fromFloor:LEVEL.two, toFloor:LEVEL.three, x:-34, minX:-38.8, maxX:-29.2, fromZ:32, toZ:10, duration:3600, message:'Subiendo al Piso 3' },
    { id:'down32', kind:'escalator', direction:'down', fromFloor:LEVEL.three, toFloor:LEVEL.two, x:-26, minX:-30.8, maxX:-21.2, fromZ:10, toZ:32, duration:3600, message:'Bajando al Piso 2' },
    { id:'up34', kind:'stairs', direction:'up', fromFloor:LEVEL.three, toFloor:LEVEL.roof, x:44, minX:38.7, maxX:49.3, fromZ:39, toZ:10.5, duration:5200, message:'Subiendo por las escaleras a la terraza' },
    { id:'down43', kind:'stairs', direction:'down', fromFloor:LEVEL.roof, toFloor:LEVEL.three, x:44, minX:38.7, maxX:49.3, fromZ:10.5, toZ:39, duration:5200, message:'Bajando por las escaleras al Piso 3' }
  ]);

  const states = new WeakMap();
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const finite = value => Number.isFinite(Number(value));
  const near = (a, b, epsilon = 0.55) => Math.abs(Number(a) - Number(b)) <= epsilon;
  const lerp = (a, b, t) => a + (b - a) * t;
  const smoothStep = t => t * t * (3 - 2 * t);
  const copyValue = value => { try { return value?.clone?.() ?? value; } catch (_) { return value; } };

  function status(message) {
    window.__UCAN_API__?.setStatus?.(message);
    const element = document.getElementById('status');
    if (element && !window.__UCAN_API__?.setStatus) element.textContent = message;
  }

  function recordError(state, stage, error) {
    const detail = { stage, message:String(error?.message || error || 'Error XR desconocido'), stack:String(error?.stack || ''), at:new Date().toISOString() };
    state.errors.push(detail);
    if (state.errors.length > 12) state.errors.shift();
    state.lastError = detail;
    updateAudit(state);
    console.error(`[UCAN ${VERSION}] ${stage}:`, error);
  }

  function nearestFloor(value) {
    return FLOORS.reduce((best, floor) => Math.abs(value - floor) < Math.abs(value - best) ? floor : best, FLOORS[0]);
  }

  function eyeHeight(camera, fallback = PLAYER_HEIGHT) {
    const candidates = [camera?.realWorldHeight, camera?._realWorldHeight, fallback, PLAYER_HEIGHT];
    return candidates.map(Number).find(value => finite(value) && value >= 0.8 && value <= 2.4) || PLAYER_HEIGHT;
  }

  function comfortEnabled() {
    return document.getElementById('comfortBtn')?.getAttribute('aria-pressed') === 'true';
  }

  function controller(helper, handedness) {
    return (helper?.input?.controllers || []).find(item => (item?.inputSource?.handedness || item?.motionController?.handedness) === handedness) || null;
  }

  function axes(helper, handedness) {
    const item = controller(helper, handedness);
    const gamepad = item?.inputSource?.gamepad || item?.motionController?.gamepadObject || item?.motionController?.gamepad;
    const values = Array.from(gamepad?.axes || []);
    if (values.length < 2) return { x:0, y:0 };
    const offset = values.length >= 4 ? values.length - 2 : 0;
    const normalize = raw => {
      const value = finite(raw) ? Number(raw) : 0;
      const magnitude = Math.abs(value);
      if (magnitude <= DEAD_ZONE) return 0;
      return Math.sign(value) * clamp((magnitude - DEAD_ZONE) / (1 - DEAD_ZONE), 0, 1);
    };
    return { x:normalize(values[offset]), y:normalize(values[offset + 1]) };
  }

  function yaw(camera) {
    try { if (camera?.rotationQuaternion?.toEulerAngles) return camera.rotationQuaternion.toEulerAngles().y; } catch (_) {}
    return Number(camera?.rotation?.y || camera?.cameraRotation?.y || 0);
  }

  function setYaw(camera, value) {
    if (!camera) return;
    try {
      if (camera.rotationQuaternion && B.Quaternion?.FromEulerAngles) camera.rotationQuaternion.copyFrom(B.Quaternion.FromEulerAngles(0, value, 0));
      else if (camera.rotation) camera.rotation.y = value;
    } catch (_) {}
  }

  function horizontalBasis(camera) {
    let forward;
    try { forward = camera.getForwardRay?.(1)?.direction?.clone?.(); } catch (_) {}
    if (!forward) {
      const angle = yaw(camera);
      forward = new B.Vector3(Math.sin(angle), 0, Math.cos(angle));
    }
    forward.y = 0;
    if (forward.lengthSquared() < 0.0001) forward.set(0, 0, 1);
    forward.normalize();
    return { forward, right:new B.Vector3(forward.z, 0, -forward.x).normalize() };
  }

  function captureVisualState(scene) {
    const image = scene.imageProcessingConfiguration;
    return {
      clearColor:copyValue(scene.clearColor), ambientColor:copyValue(scene.ambientColor), environmentIntensity:scene.environmentIntensity,
      fogEnabled:scene.fogEnabled, fogMode:scene.fogMode, fogDensity:scene.fogDensity, fogStart:scene.fogStart, fogEnd:scene.fogEnd, fogColor:copyValue(scene.fogColor),
      image:image ? { exposure:image.exposure, contrast:image.contrast, toneMappingEnabled:image.toneMappingEnabled, toneMappingType:image.toneMappingType, vignetteEnabled:image.vignetteEnabled, colorCurvesEnabled:image.colorCurvesEnabled, colorGradingEnabled:image.colorGradingEnabled } : null
    };
  }

  function applySharedVisualState(state) {
    const visual = state.visual;
    if (!state.inXR || !visual) return;
    const scene = state.scene;
    if (visual.clearColor) scene.clearColor = copyValue(visual.clearColor);
    if (visual.ambientColor) scene.ambientColor = copyValue(visual.ambientColor);
    scene.environmentIntensity = visual.environmentIntensity;
    scene.fogEnabled = visual.fogEnabled;
    scene.fogMode = visual.fogMode;
    scene.fogDensity = visual.fogDensity;
    scene.fogStart = visual.fogStart;
    scene.fogEnd = visual.fogEnd;
    if (visual.fogColor) scene.fogColor = copyValue(visual.fogColor);
    const image = scene.imageProcessingConfiguration;
    if (image && visual.image) {
      image.exposure = visual.image.exposure;
      image.contrast = visual.image.contrast;
      image.toneMappingEnabled = visual.image.toneMappingEnabled;
      image.toneMappingType = visual.image.toneMappingType;
      image.vignetteEnabled = visual.image.vignetteEnabled;
      image.colorCurvesEnabled = visual.image.colorCurvesEnabled;
      image.colorGradingEnabled = visual.image.colorGradingEnabled;
    }
  }

  function standardizeTransparentMaterials(scene) {
    let count = 0;
    for (const material of scene.materials || []) {
      if (!material || Number(material.alpha ?? 1) >= 0.999) continue;
      material.backFaceCulling = false;
      material.needDepthPrePass = false;
      material.disableDepthWrite = true;
      if ('forceDepthWrite' in material) material.forceDepthWrite = false;
      material.separateCullingPass = true;
      if (B.Material?.MATERIAL_ALPHABLEND != null) material.transparencyMode = B.Material.MATERIAL_ALPHABLEND;
      if (B.Engine?.ALPHA_COMBINE != null) material.alphaMode = B.Engine.ALPHA_COMBINE;
      count += 1;
    }
    return count;
  }

  function disableConflictingFeatures(helper) {
    const manager = helper?.baseExperience?.featuresManager;
    if (!manager) return;
    for (const feature of [B.WebXRFeatureName?.MOVEMENT, B.WebXRFeatureName?.TELEPORTATION].filter(Boolean)) {
      try { manager.disableFeature(feature); } catch (_) {}
    }
  }

  function floorGround(state) {
    const p = state.xr?.position;
    if (!p) return state.floor;
    if (near(state.floor, LEVEL.three, 0.3)) {
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

  function routeEntry(state) {
    const p = state.xr?.position;
    if (!p || state.transition) return null;
    return ROUTES.find(route => near(state.floor, route.fromFloor, 0.35) && p.x >= route.minX - 0.45 && p.x <= route.maxX + 0.45 && Math.abs(p.z - route.fromZ) <= ENTRY_RADIUS) || null;
  }

  function wrongWayRoute(state) {
    const p = state.xr?.position;
    if (!p || state.transition) return null;
    return ROUTES.find(route => route.kind === 'escalator' && near(state.floor, route.toFloor, 0.35) && p.x >= route.minX - 0.45 && p.x <= route.maxX + 0.45 && Math.abs(p.z - route.toZ) <= WRONG_WAY_RADIUS) || null;
  }

  function beginRoute(state, route) {
    state.transition = { route, startedAt:performance.now(), eyeHeight:state.eyeHeight };
    state.lastSafe.copyFrom(state.xr.position);
    status(`${route.message}. Movimiento automático igual al browser.`);
  }

  function updateRoute(state) {
    const transition = state.transition;
    if (!transition) return false;
    const route = transition.route;
    const raw = clamp((performance.now() - transition.startedAt) / route.duration, 0, 1);
    const t = smoothStep(raw);
    const ground = lerp(route.fromFloor, route.toFloor, t);
    state.xr.position.x = lerp(state.xr.position.x, route.x, clamp(0.12 + t * 0.18, 0, 0.3));
    state.xr.position.z = lerp(route.fromZ, route.toZ, t);
    state.xr.position.y = ground + state.eyeHeight;
    if (raw >= 1) {
      state.floor = route.toFloor;
      state.xr.position.set(route.x, route.toFloor + state.eyeHeight, route.toZ + (route.direction === 'up' ? -1.2 : 1.2));
      state.desktop?.position?.set?.(route.x, route.toFloor + PLAYER_HEIGHT, state.xr.position.z);
      state.transition = null;
      state.lastSafe.copyFrom(state.xr.position);
      state.completedRoutes += 1;
      status(`${route.message} completado.`);
    }
    return true;
  }

  function blockWrongWay(state, route) {
    const now = performance.now();
    const outward = route.direction === 'down' ? 1 : -1;
    state.xr.position.z = route.toZ + outward * 1.15;
    state.xr.position.x = clamp(state.xr.position.x, route.minX + 0.45, route.maxX - 0.45);
    state.wrongWayAttempts[route.id] = (state.wrongWayAttempts[route.id] || 0) + 1;
    state.lastWrongWay = route.id;
    if (now - state.lastWarningAt > 1200) {
      state.lastWarningAt = now;
      status(route.direction === 'down' ? 'Esta escalera eléctrica es únicamente para bajar. Use la escalera de subida.' : 'Esta escalera eléctrica es únicamente para subir. Use la escalera de bajada.');
    }
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
    const length = step.length() + 0.42;
    for (const height of [0.42, 1.18]) {
      const origin = new B.Vector3(state.xr.position.x, ground + height, state.xr.position.z);
      const hit = state.scene.pickWithRay(new B.Ray(origin, direction, length), collisionCandidate, false);
      if (hit?.hit && hit.distance <= length) return true;
    }
    return false;
  }

  function moveWithDesktopRules(state, step, ground) {
    if (step.lengthSquared() < 1e-8) return;
    const camera = state.xr;
    const y = camera.position.y;
    try {
      if (state.desktop?.ellipsoid && camera.ellipsoid?.copyFrom) camera.ellipsoid.copyFrom(state.desktop.ellipsoid);
      if (state.desktop?.ellipsoidOffset && camera.ellipsoidOffset?.copyFrom) camera.ellipsoidOffset.copyFrom(state.desktop.ellipsoidOffset);
      if (typeof camera._collideWithWorld === 'function') camera._collideWithWorld(step);
      else if (!rayBlocked(state, step, ground)) camera.position.addInPlace(step);
    } catch (error) {
      recordError(state, 'movement-collision-fallback', error);
      if (!rayBlocked(state, step, ground)) camera.position.addInPlace(step);
    } finally {
      camera.position.y = y;
      camera.position.x = clamp(camera.position.x, WORLD.minX, WORLD.maxX);
      camera.position.z = clamp(camera.position.z, WORLD.minZ, WORLD.maxZ);
    }
  }

  function applyMovement(state, dt) {
    const left = axes(state.helper, 'left');
    const right = axes(state.helper, 'right');
    const comfort = comfortEnabled();
    const speed = comfort ? SPEED.comfort : SPEED.natural;
    const turnSpeed = comfort ? TURN_SPEED.comfort : TURN_SPEED.natural;
    if (Math.abs(right.x) > 0.25 && Math.abs(right.y) < 0.65) setYaw(state.xr, yaw(state.xr) + right.x * turnSpeed * dt);
    const magnitude = Math.min(1, Math.hypot(left.x, left.y));
    if (magnitude < 0.01) return;
    const basis = horizontalBasis(state.xr);
    const desired = basis.right.scale(left.x).add(basis.forward.scale(-left.y));
    if (desired.lengthSquared() > 1) desired.normalize();
    desired.scaleInPlace(speed * dt);
    moveWithDesktopRules(state, desired, floorGround(state));
    state.movingFrames += 1;
  }

  function syncHeightAndDesktop(state) {
    state.eyeHeight = eyeHeight(state.xr, state.eyeHeight);
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
    const valid = p && finite(p.x) && finite(p.y) && finite(p.z) && p.x >= WORLD.minX - 5 && p.x <= WORLD.maxX + 5 && p.z >= WORLD.minZ - 5 && p.z <= WORLD.maxZ + 5 && p.y >= -1 && p.y <= LEVEL.roof + 6;
    if (valid) {
      if (!state.transition) state.lastSafe.copyFrom(p);
      return;
    }
    p?.copyFrom?.(state.lastSafe || new B.Vector3(0, state.floor + state.eyeHeight, 42));
    state.transition = null;
    state.recoveries += 1;
    status('La posición XR fue recuperada automáticamente.');
  }

  function teleportTo(state, key, source = 'control') {
    const target = AREAS[key];
    if (!target || !state.xr?.position) return false;
    state.floor = target.floor;
    state.transition = null;
    state.xr.position.set(target.x, target.floor + state.eyeHeight, target.z);
    setYaw(state.xr, target.yaw);
    if (state.desktop?.position) {
      state.desktop.position.set(target.x, target.floor + PLAYER_HEIGHT, target.z);
      setYaw(state.desktop, target.yaw);
    }
    state.lastSafe.copyFrom(state.xr.position);
    status(`Ubicación XR actualizada desde ${source}.`);
    return true;
  }

  function patchNavigation(state) {
    const attempt = () => {
      const api = window.__UCAN_API__;
      if (!api) { window.setTimeout(attempt, 120); return; }
      if (!api.__v283OriginalGoToArea) api.__v283OriginalGoToArea = api.goToArea;
      api.goToArea = key => state.inXR ? teleportTo(state, key, 'API') : api.__v283OriginalGoToArea?.(key);
      api.goTo = api.goToArea;
    };
    attempt();
    document.addEventListener('click', event => {
      if (!state.inXR) return;
      const button = event.target?.closest?.('[data-go],#destinationGo');
      if (!button) return;
      const key = button.id === 'destinationGo' ? document.getElementById('destinationSelect')?.value : button.dataset.go;
      if (!key || !AREAS[key]) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      teleportTo(state, key, 'botón');
    }, true);
  }

  function initialPose(state) {
    state.eyeHeight = eyeHeight(state.xr, PLAYER_HEIGHT);
    const desktopY = Number(state.desktop?.position?.y || PLAYER_HEIGHT);
    state.floor = nearestFloor(desktopY - PLAYER_HEIGHT);
    state.xr.position.set(Number(state.desktop?.position?.x || 0), state.floor + state.eyeHeight, Number(state.desktop?.position?.z || 42));
    setYaw(state.xr, yaw(state.desktop));
    state.lastSafe.copyFrom(state.xr.position);
    state.poseReady = true;
  }

  function updateAudit(state) {
    window.__UCAN_UNIFIED_XR_AUDIT__ = {
      version:VERSION, build:BUILD, installed:true, inXR:state.inXR, poseReady:state.poseReady,
      singleController:true, deprecatedXrLayersLoaded:false, sameScene:true, sameLighting:true,
      questExposureFactor:1, noQuestSpecificExposure:true,
      sharedNaturalSpeed:SPEED.natural, sharedComfortSpeed:SPEED.comfort,
      sharedTurnSpeed:TURN_SPEED.natural, sharedComfortTurnSpeed:TURN_SPEED.comfort,
      realWorldHeightAware:true, automaticEscalators:true, oneWayElectricEscalators:true,
      downEscalatorsCannotAscend:true, upEscalatorsCannotDescend:true, rooftopStairsBidirectional:true,
      completedRoutes:state.completedRoutes, movingFrames:state.movingFrames,
      wrongWayAttempts:{ ...state.wrongWayAttempts }, lastWrongWay:state.lastWrongWay,
      recoveries:state.recoveries, standardizedTransparentMaterials:state.transparentMaterials,
      lastError:state.lastError, errors:[...state.errors],
      getState:() => ({ inXR:state.inXR, floor:state.floor, eyeHeight:state.eyeHeight, position:state.xr?.position ? { x:state.xr.position.x, y:state.xr.position.y, z:state.xr.position.z } : null, transition:state.transition ? { id:state.transition.route.id, direction:state.transition.route.direction } : null }),
      teleportTo:key => teleportTo(state, key, 'auditoría')
    };
  }

  function frame(state) {
    if (!state.inXR || !state.poseReady || !state.xr?.position) return;
    try {
      const dt = clamp((state.scene.getEngine().getDeltaTime() || 16) / 1000, 0.001, 0.05);
      const wrong = wrongWayRoute(state);
      if (wrong) blockWrongWay(state, wrong);
      if (!state.transition) {
        const route = routeEntry(state);
        if (route) beginRoute(state, route);
      }
      if (!updateRoute(state)) {
        applyMovement(state, dt);
        syncHeightAndDesktop(state);
      }
      recoverIfInvalid(state);
      if (++state.auditFrame % 30 === 0) updateAudit(state);
    } catch (error) {
      recordError(state, 'frame', error);
      recoverIfInvalid(state);
    }
  }

  function install(scene, helper) {
    if (!helper || helper.__ucanV283UnifiedXR) return helper;
    helper.__ucanV283UnifiedXR = true;
    const xr = helper.baseExperience?.camera;
    if (!xr) throw new Error('WebXR no devolvió una cámara válida.');
    const desktop = scene.activeCamera;
    const state = {
      scene, helper, xr, desktop, inXR:false, poseReady:false,
      floor:nearestFloor(Number(desktop?.position?.y || PLAYER_HEIGHT) - PLAYER_HEIGHT), eyeHeight:PLAYER_HEIGHT,
      transition:null, lastSafe:new B.Vector3(0, PLAYER_HEIGHT, 42), visual:null, transparentMaterials:0,
      completedRoutes:0, movingFrames:0, wrongWayAttempts:{ up12:0, down21:0, up23:0, down32:0 },
      lastWrongWay:null, lastWarningAt:0, recoveries:0, errors:[], lastError:null, auditFrame:0
    };
    states.set(scene, state);
    state.transparentMaterials = standardizeTransparentMaterials(scene);
    disableConflictingFeatures(helper);
    xr.applyGravity = false;
    xr.checkCollisions = false;
    if (xr.cameraDirection?.set) xr.cameraDirection.set(0, 0, 0);
    patchNavigation(state);

    helper.baseExperience.onInitialXRPoseSetObservable?.add?.(() => initialPose(state));
    helper.baseExperience.onStateChangedObservable.add(xrState => {
      try {
        if (xrState === XR_STATE.ENTERING_XR) {
          state.visual = captureVisualState(scene);
          state.inXR = true;
        } else if (xrState === XR_STATE.IN_XR) {
          state.inXR = true;
          disableConflictingFeatures(helper);
          if (!state.poseReady) initialPose(state);
          applySharedVisualState(state);
          status('V283: Meta Quest y browser usan la misma iluminación, velocidad, altura y lógica de escaleras.');
        } else if (xrState === XR_STATE.NOT_IN_XR) {
          state.inXR = false;
          state.poseReady = false;
          state.transition = null;
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

    scene.onBeforeRenderObservable.add(() => frame(state));
    window.__UCAN_XR_HELPER__ = helper;
    updateAudit(state);
    console.info('[UCAN V283] Controlador XR unificado instalado sin calibraciones específicas de Meta Quest.');
    return helper;
  }

  const original = B.Scene.prototype.createDefaultXRExperienceAsync;
  if (original.__ucanV283UnifiedPatched) return;
  async function patched(options = {}) {
    const safe = { ...options, disableTeleportation:true, optionalFeatures:options.optionalFeatures ?? true, uiOptions:{ ...(options.uiOptions || {}), sessionMode:'immersive-vr', referenceSpaceType:'local-floor' } };
    delete safe.outputCanvasOptions;
    delete safe.ignoreNativeCameraTransformation;
    try {
      const helper = await original.call(this, safe);
      return install(this, helper);
    } catch (firstError) {
      console.warn('[UCAN V283] Inicialización XR completa falló; intentando modo compatible:', firstError);
      const fallback = { floorMeshes:options.floorMeshes || [], disableTeleportation:true, uiOptions:{ sessionMode:'immersive-vr', referenceSpaceType:'local-floor' } };
      try {
        const helper = await original.call(this, fallback);
        const installed = install(this, helper);
        const audit = window.__UCAN_UNIFIED_XR_AUDIT__;
        if (audit) audit.compatibilityFallbackUsed = true;
        return installed;
      } catch (secondError) {
        window.__UCAN_UNIFIED_XR_BOOT__ = { version:VERSION, build:BUILD, patched:true, ready:false, firstError:String(firstError?.message || firstError), secondError:String(secondError?.message || secondError) };
        throw secondError;
      }
    }
  }
  patched.__ucanV283UnifiedPatched = true;
  patched.__ucanOriginal = original;
  B.Scene.prototype.createDefaultXRExperienceAsync = patched;

  window.__UCAN_UNIFIED_XR_BOOT__ = { version:VERSION, build:BUILD, patched:true, ready:true, singleController:true, noQuestSpecificExposure:true, oneWayElectricEscalators:true, sameDesktopMovementConstants:true };
})();