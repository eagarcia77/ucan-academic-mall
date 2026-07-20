(() => {
  'use strict';

  const VERSION = 'V281';
  const BUILD = 'V281-20260720-QUEST-VISUAL-ROOFTOP-PARITY';
  const B = window.BABYLON;
  if (!B?.Scene?.prototype?.createDefaultXRExperienceAsync) return;

  const ROOFTOP = 27.2;
  const EYE_FALLBACK = 1.72;
  const SPEED = Object.freeze({ comfort:3.4, natural:5.0 });
  const WORLD = Object.freeze({ minX:-73, maxX:73, minZ:-59, maxZ:59 });
  const EXPOSURE_KEY = 'ucanQuestExposureFactor';
  const DEFAULT_EXPOSURE_FACTOR = 0.86;
  const DEAD_ZONE = 0.14;
  const states = new WeakMap();

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const finite = value => Number.isFinite(Number(value));
  const near = (a, b, epsilon = 0.55) => Math.abs(Number(a) - Number(b)) <= epsilon;
  const clone = value => { try { return value?.clone?.() ?? value; } catch (_) { return value; } };

  function status(message) {
    window.__UCAN_API__?.setStatus?.(message);
    const element = document.getElementById('status');
    if (element && !window.__UCAN_API__?.setStatus) element.textContent = message;
  }

  function exposureFactor() {
    const stored = Number(localStorage.getItem(EXPOSURE_KEY));
    return finite(stored) ? clamp(stored, 0.70, 1.05) : DEFAULT_EXPOSURE_FACTOR;
  }

  function controller(helper, handedness) {
    return (helper?.input?.controllers || []).find(item =>
      (item?.inputSource?.handedness || item?.motionController?.handedness) === handedness
    ) || null;
  }

  function axes(helper, handedness) {
    const item = controller(helper, handedness);
    const gamepad = item?.inputSource?.gamepad || item?.motionController?.gamepadObject || item?.motionController?.gamepad;
    const values = Array.from(gamepad?.axes || []);
    if (values.length < 2) return { x:0, y:0 };
    const offset = values.length >= 4 ? values.length - 2 : 0;
    const dead = raw => {
      const value = finite(raw) ? Number(raw) : 0;
      const magnitude = Math.abs(value);
      if (magnitude <= DEAD_ZONE) return 0;
      return Math.sign(value) * clamp((magnitude - DEAD_ZONE) / (1 - DEAD_ZONE), 0, 1);
    };
    return { x:dead(values[offset]), y:dead(values[offset + 1]) };
  }

  function cameraYaw(camera) {
    try { if (camera?.rotationQuaternion?.toEulerAngles) return camera.rotationQuaternion.toEulerAngles().y; } catch (_) {}
    return Number(camera?.rotation?.y || camera?.cameraRotation?.y || 0);
  }

  function horizontalBasis(camera) {
    let forward;
    try { forward = camera.getForwardRay?.(1)?.direction?.clone?.(); } catch (_) {}
    if (!forward) {
      const yaw = cameraYaw(camera);
      forward = new B.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
    }
    forward.y = 0;
    if (forward.lengthSquared() < 0.0001) forward.set(0, 0, 1);
    forward.normalize();
    return { forward, right:new B.Vector3(forward.z, 0, -forward.x).normalize() };
  }

  function eyeHeight(camera) {
    const candidates = [camera?.realWorldHeight, camera?._realWorldHeight, EYE_FALLBACK];
    return candidates.map(Number).find(value => finite(value) && value >= 0.8 && value <= 2.4) || EYE_FALLBACK;
  }

  function questNavigationState() {
    try { return window.__UCAN_QUEST_XR_AUDIT__?.getState?.() || null; } catch (_) { return null; }
  }

  function onRooftop(state, nav) {
    if (nav?.transition) return false;
    if (near(nav?.floor, ROOFTOP, 0.25)) return true;
    const feet = Number(state.xr?.position?.y || 0) - eyeHeight(state.xr);
    return near(feet, ROOFTOP, 0.65);
  }

  function comfortEnabled() {
    return document.getElementById('comfortBtn')?.getAttribute('aria-pressed') === 'true';
  }

  function captureDesktopVisual(state) {
    const image = state.scene.imageProcessingConfiguration;
    state.desktopVisual = image ? {
      exposure:Number(image.exposure ?? 1),
      contrast:Number(image.contrast ?? 1),
      toneMappingEnabled:Boolean(image.toneMappingEnabled),
      toneMappingType:image.toneMappingType,
      vignetteEnabled:Boolean(image.vignetteEnabled),
      colorCurvesEnabled:Boolean(image.colorCurvesEnabled),
      colorGradingEnabled:Boolean(image.colorGradingEnabled),
      applyByPostProcess:image.applyByPostProcess,
      isEnabled:image.isEnabled
    } : null;
    state.desktopEnvironmentIntensity = state.scene.environmentIntensity;
  }

  function applyQuestVisualCalibration(state) {
    if (!state.inXR || !state.desktopVisual) return;
    const image = state.scene.imageProcessingConfiguration;
    if (!image) return;
    const factor = exposureFactor();
    image.exposure = state.desktopVisual.exposure * factor;
    image.contrast = state.desktopVisual.contrast;
    image.toneMappingEnabled = state.desktopVisual.toneMappingEnabled;
    image.toneMappingType = state.desktopVisual.toneMappingType;
    image.vignetteEnabled = state.desktopVisual.vignetteEnabled;
    image.colorCurvesEnabled = state.desktopVisual.colorCurvesEnabled;
    image.colorGradingEnabled = state.desktopVisual.colorGradingEnabled;
    if ('applyByPostProcess' in image) image.applyByPostProcess = state.desktopVisual.applyByPostProcess;
    if ('isEnabled' in image && state.desktopVisual.isEnabled !== undefined) image.isEnabled = state.desktopVisual.isEnabled;
    state.scene.environmentIntensity = state.desktopEnvironmentIntensity;
    state.appliedExposure = image.exposure;
    state.exposureFactor = factor;
  }

  function restoreDesktopVisual(state) {
    if (!state.desktopVisual) return;
    const image = state.scene.imageProcessingConfiguration;
    if (!image) return;
    image.exposure = state.desktopVisual.exposure;
    image.contrast = state.desktopVisual.contrast;
    image.toneMappingEnabled = state.desktopVisual.toneMappingEnabled;
    image.toneMappingType = state.desktopVisual.toneMappingType;
    image.vignetteEnabled = state.desktopVisual.vignetteEnabled;
    image.colorCurvesEnabled = state.desktopVisual.colorCurvesEnabled;
    image.colorGradingEnabled = state.desktopVisual.colorGradingEnabled;
    if ('applyByPostProcess' in image) image.applyByPostProcess = state.desktopVisual.applyByPostProcess;
    if ('isEnabled' in image && state.desktopVisual.isEnabled !== undefined) image.isEnabled = state.desktopVisual.isEnabled;
    state.scene.environmentIntensity = state.desktopEnvironmentIntensity;
  }

  function collisionMesh(mesh) {
    if (!mesh || mesh.isVisible === false || !mesh.checkCollisions) return false;
    if (typeof mesh.isEnabled === 'function' && !mesh.isEnabled()) return false;
    if (mesh.metadata?.xrStairSurface || mesh.metadata?.walkable || mesh.metadata?.teleportable) return false;
    return !/gran losa|ruta avatar|zona segura VR|rooftop deck|rampa invisible|plataforma (?:inicio|fin)|peldaño|banda escalera/i.test(String(mesh.name || ''));
  }

  function blocked(state, step, ground) {
    if (!state.scene?.pickWithRay || !B.Ray || step.lengthSquared() < 1e-8) return false;
    const direction = step.clone().normalize();
    const length = step.length() + 0.42;
    for (const height of [0.42, 1.18]) {
      const origin = new B.Vector3(state.xr.position.x, ground + height, state.xr.position.z);
      const hit = state.scene.pickWithRay(new B.Ray(origin, direction, length), collisionMesh, false);
      if (hit?.hit && hit.distance <= length) return true;
    }
    return false;
  }

  function moveWithDesktopCollision(state, step) {
    const camera = state.xr;
    const y = camera.position.y;
    const originalCheck = camera.checkCollisions;
    const originalGravity = camera.applyGravity;
    const originalEllipsoid = clone(camera.ellipsoid);
    const originalOffset = clone(camera.ellipsoidOffset);
    try {
      if (state.desktop?.ellipsoid && camera.ellipsoid?.copyFrom) camera.ellipsoid.copyFrom(state.desktop.ellipsoid);
      if (state.desktop?.ellipsoidOffset && camera.ellipsoidOffset?.copyFrom) camera.ellipsoidOffset.copyFrom(state.desktop.ellipsoidOffset);
      camera.checkCollisions = true;
      camera.applyGravity = false;
      if (typeof camera._collideWithWorld === 'function') {
        camera._collideWithWorld(step);
      } else if (!blocked(state, step, ROOFTOP)) {
        camera.position.addInPlace(step);
      } else {
        for (const part of [new B.Vector3(step.x, 0, 0), new B.Vector3(0, 0, step.z)]) {
          if (part.lengthSquared() > 1e-8 && !blocked(state, part, ROOFTOP)) camera.position.addInPlace(part);
        }
      }
    } catch (_) {
      if (!blocked(state, step, ROOFTOP)) camera.position.addInPlace(step);
    } finally {
      camera.position.y = y;
      camera.position.x = clamp(camera.position.x, WORLD.minX, WORLD.maxX);
      camera.position.z = clamp(camera.position.z, WORLD.minZ, WORLD.maxZ);
      camera.checkCollisions = originalCheck;
      camera.applyGravity = originalGravity;
      if (originalEllipsoid && camera.ellipsoid?.copyFrom) camera.ellipsoid.copyFrom(originalEllipsoid);
      if (originalOffset && camera.ellipsoidOffset?.copyFrom) camera.ellipsoidOffset.copyFrom(originalOffset);
    }
  }

  function captureBeforeLocomotion(state) {
    if (!state.inXR || !state.xr?.position) return;
    state.beforePosition.copyFrom(state.xr.position);
    state.beforeAxes = axes(state.helper, 'left');
    state.beforeNav = questNavigationState();
    state.beforeCaptured = true;
  }

  function applyRooftopMovementParity(state) {
    if (!state.inXR || !state.beforeCaptured || !state.xr?.position) return;
    const nav = questNavigationState() || state.beforeNav;
    if (!onRooftop(state, nav)) return;

    const after = state.xr.position.clone();
    const internalDelta = after.subtract(state.beforePosition);
    if (Math.hypot(internalDelta.x, internalDelta.z) > 1.35) {
      state.beforePosition.copyFrom(state.xr.position);
      state.teleportFrames += 1;
      return;
    }

    const y = state.xr.position.y;
    state.xr.position.x = state.beforePosition.x;
    state.xr.position.z = state.beforePosition.z;
    state.xr.position.y = y;

    const left = state.beforeAxes || { x:0, y:0 };
    const magnitude = Math.min(1, Math.hypot(left.x, left.y));
    if (magnitude > 0.001) {
      const basis = horizontalBasis(state.xr);
      const desired = basis.right.scale(left.x).add(basis.forward.scale(-left.y));
      if (desired.lengthSquared() > 1) desired.normalize();
      const dt = clamp((state.scene.getEngine().getDeltaTime() || 16) / 1000, 0.001, 0.05);
      const speed = comfortEnabled() ? SPEED.comfort : SPEED.natural;
      desired.scaleInPlace(speed * dt);
      moveWithDesktopCollision(state, desired);
      state.movingFrames += 1;
    } else if (Math.hypot(internalDelta.x, internalDelta.z) > 0.0005) {
      state.inertiaCancelledFrames += 1;
    }

    if (state.desktop?.position) {
      state.desktop.position.x = state.xr.position.x;
      state.desktop.position.z = state.xr.position.z;
      state.desktop.position.y = ROOFTOP + EYE_FALLBACK;
    }
    state.rooftopFrames += 1;
  }

  function updateAudit(state) {
    window.__UCAN_QUEST_VISUAL_ROOFTOP_PARITY__ = {
      version:VERSION,
      build:BUILD,
      installed:true,
      inXR:state.inXR,
      questExposureFactor:state.exposureFactor,
      desktopExposure:state.desktopVisual?.exposure ?? null,
      appliedExposure:state.appliedExposure ?? null,
      rooftopDesktopResponse:true,
      rooftopNativeCollisions:true,
      rooftopImmediateStop:true,
      preservesRoomScalePose:true,
      rooftopFrames:state.rooftopFrames,
      movingFrames:state.movingFrames,
      inertiaCancelledFrames:state.inertiaCancelledFrames,
      teleportFrames:state.teleportFrames,
      setExposureFactor:value => {
        const next = clamp(Number(value), 0.70, 1.05);
        if (!finite(next)) return state.exposureFactor;
        localStorage.setItem(EXPOSURE_KEY, String(next));
        state.exposureFactor = next;
        applyQuestVisualCalibration(state);
        updateAudit(state);
        return next;
      }
    };
  }

  function install(scene, helper) {
    if (!helper || helper.__ucanV281QuestVisualRooftopParity) return helper;
    helper.__ucanV281QuestVisualRooftopParity = true;
    const state = {
      scene,
      helper,
      xr:helper.baseExperience.camera,
      desktop:scene.activeCamera,
      inXR:false,
      desktopVisual:null,
      desktopEnvironmentIntensity:scene.environmentIntensity,
      exposureFactor:exposureFactor(),
      appliedExposure:null,
      beforePosition:new B.Vector3(0, 0, 0),
      beforeAxes:{ x:0, y:0 },
      beforeNav:null,
      beforeCaptured:false,
      rooftopFrames:0,
      movingFrames:0,
      inertiaCancelledFrames:0,
      teleportFrames:0,
      auditFrame:0
    };
    states.set(scene, state);

    helper.baseExperience.onStateChangedObservable.add(xrState => {
      if (xrState === B.WebXRState.ENTERING_XR) {
        captureDesktopVisual(state);
        state.inXR = true;
      } else if (xrState === B.WebXRState.IN_XR) {
        state.inXR = true;
        applyQuestVisualCalibration(state);
        status('V281: iluminación de Meta Quest y movimiento de la terraza igualados con la vista del browser.');
      } else if (xrState === B.WebXRState.NOT_IN_XR) {
        state.inXR = false;
        state.beforeCaptured = false;
        restoreDesktopVisual(state);
      }
      updateAudit(state);
    });

    scene.onBeforeRenderObservable.add(() => captureBeforeLocomotion(state), -1, true);
    scene.onBeforeRenderObservable.add(() => {
      if (!state.inXR) return;
      applyQuestVisualCalibration(state);
      applyRooftopMovementParity(state);
      if (++state.auditFrame % 30 === 0) updateAudit(state);
    });

    updateAudit(state);
    console.info('[UCAN V281] Paridad visual Quest y locomoción de terraza instalada.');
    return helper;
  }

  const original = B.Scene.prototype.createDefaultXRExperienceAsync;
  if (original.__ucanV281QuestVisualRooftopPatched) return;
  async function patched(options = {}) {
    const helper = await original.call(this, options);
    return install(this, helper);
  }
  patched.__ucanV281QuestVisualRooftopPatched = true;
  patched.__ucanOriginal = original;
  B.Scene.prototype.createDefaultXRExperienceAsync = patched;

  window.__UCAN_QUEST_VISUAL_ROOFTOP_BOOT__ = {
    version:VERSION,
    build:BUILD,
    patched:true,
    questExposureCalibrated:true,
    rooftopDesktopMovement:true,
    rooftopNativeCollisions:true
  };
})();
