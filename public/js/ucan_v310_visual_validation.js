(() => {
  'use strict';

  const B = window.BABYLON;
  if (!B) return;

  const VERSION = 'V310';
  const REVISION = 'R14';
  const BUILD = 'V310-20260728-BROWSER-WEBXR-VISUAL-VALIDATION-R14';
  const API = '/api/visual-validation-v310';
  const XR_STATE = B.WebXRState || Object.freeze({ NOT_IN_XR:0, ENTERING_XR:1, IN_XR:2, EXITING_XR:3 });
  const WIDTH = 384;
  const HEIGHT = 216;
  const PASS_THRESHOLD = 0.03;
  const WARNING_THRESHOLD = 0.07;
  const ALL_LAYERS = 0x0fffffff;

  const AREAS = Object.freeze([
    { id:'floor1', label:'Piso 1 · Áreas comunes', position:[0, 1.72, 42], target:[0, 1.4, 0] },
    { id:'cafeteria', label:'Piso 1 · Cafetería', position:[-56, 1.72, 12], target:[-63, 1.6, -14] },
    { id:'library', label:'Piso 1 · Biblioteca', position:[56, 1.72, 12], target:[63, 1.6, -14] },
    { id:'floor2', label:'Piso 2 · Galería', position:[0, 9.92, 42], target:[0, 9.6, -18] },
    { id:'sv201', label:'Sala virtual SV-201', position:[-56, 9.92, 12], target:[-56, 10.0, -12] },
    { id:'sv202', label:'Sala virtual SV-202', position:[-28, 9.92, -20], target:[-28, 10.0, -47] },
    { id:'sv203', label:'Sala virtual SV-203', position:[0, 9.92, -20], target:[0, 10.0, -47] },
    { id:'sv204', label:'Sala virtual SV-204', position:[28, 9.92, -20], target:[28, 10.0, -47] },
    { id:'sv205', label:'Sala virtual SV-205', position:[56, 9.92, 12], target:[56, 10.0, -12] },
    { id:'theater', label:'Piso 3 · Anfiteatro', position:[0, 18.12, 38], target:[0, 19.0, -28] },
    { id:'rooftop', label:'Terraza · Vista general', position:[0, 28.92, 42], target:[0, 28.5, 0] },
    { id:'weather', label:'Terraza · Estado del tiempo', position:[-33, 28.92, 38], target:[-33, 32.7, 49.2] },
    { id:'astronomy', label:'Terraza · Mapa celeste', position:[0, 28.92, -37], target:[0, 33.5, -49.2] },
    { id:'calendar', label:'Terraza · Calendario astronómico', position:[34, 28.92, -37], target:[34, 34.0, -49.2] },
    { id:'patio-north', label:'Patio exterior · Norte', position:[0, 4.2, 92], target:[0, 3.0, 60] },
    { id:'patio-east', label:'Patio exterior · Este', position:[98, 4.2, 0], target:[72, 3.0, 0] },
    { id:'patio-south', label:'Patio exterior · Sur', position:[0, 4.2, -92], target:[0, 3.0, -60] },
    { id:'patio-west', label:'Patio exterior · Oeste', position:[-98, 4.2, 0], target:[-72, 3.0, 0] }
  ]);

  const state = {
    scene:null,
    helper:null,
    engine:null,
    validationCamera:null,
    renderTarget:null,
    installed:false,
    running:false,
    inXR:false,
    autoRunVr:false,
    browserCapturedAt:null,
    vrCapturedAt:null,
    browser:new Map(),
    vr:new Map(),
    comparisons:new Map(),
    diagnostics:null,
    savedReport:null,
    currentArea:null,
    captures:0,
    captureFailures:0,
    lastError:null,
    panel:null,
    statusNode:null,
    resultsNode:null,
    viewerNode:null
  };

  const wait = ms => new Promise(resolve => window.setTimeout(resolve, ms));
  const nextFrame = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  function setStatus(message) {
    window.__UCAN_API__?.setStatus?.(message);
    if (state.statusNode) state.statusNode.textContent = message;
  }

  function recordError(stage, error) {
    state.lastError = {
      stage,
      name:String(error?.name || 'Error'),
      message:String(error?.message || error || 'Error desconocido'),
      at:new Date().toISOString()
    };
    state.captureFailures += 1;
    console.error(`[UCAN ${VERSION} ${REVISION}] ${stage}:`, error);
    updateAudit();
  }

  function vector(values) {
    return new B.Vector3(Number(values[0]), Number(values[1]), Number(values[2]));
  }

  function ensureCaptureResources() {
    if (state.validationCamera && state.renderTarget) return true;
    if (!state.scene || !state.engine) return false;

    const camera = new B.FreeCamera('Cámara canónica de validación visual V310', new B.Vector3(0, 1.72, 42), state.scene);
    camera.minZ = 0.08;
    camera.maxZ = 1600;
    camera.fov = 0.82;
    camera.layerMask = ALL_LAYERS;
    camera.inputs?.clear?.();
    camera.metadata = { validationCameraV310:true, nonInteractive:true };

    const target = new B.RenderTargetTexture(
      'Render canónico de validación visual V310',
      { width:WIDTH, height:HEIGHT },
      state.scene,
      false,
      true,
      B.Engine.TEXTURETYPE_UNSIGNED_BYTE,
      false,
      B.Texture.BILINEAR_SAMPLINGMODE
    );
    target.activeCamera = camera;
    target.renderList = null;
    target.renderParticles = true;
    target.renderSprites = true;
    target.clearColor = state.scene.clearColor?.clone?.() || new B.Color4(0, 0, 0, 1);
    target.metadata = { validationRenderTargetV310:true };
    state.scene.customRenderTargets = state.scene.customRenderTargets || [];
    if (!state.scene.customRenderTargets.includes(target)) state.scene.customRenderTargets.push(target);

    state.validationCamera = camera;
    state.renderTarget = target;
    return true;
  }

  function typedPixels(value) {
    if (!value) return null;
    if (value instanceof Uint8Array || value instanceof Uint8ClampedArray) return value;
    if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
    if (value instanceof ArrayBuffer) return new Uint8Array(value);
    return null;
  }

  function flipPixelsToDataUrl(pixels) {
    if (!pixels || pixels.length < WIDTH * HEIGHT * 4) return null;
    const source = document.createElement('canvas');
    source.width = WIDTH;
    source.height = HEIGHT;
    const sourceContext = source.getContext('2d', { alpha:false });
    const image = sourceContext.createImageData(WIDTH, HEIGHT);
    image.data.set(new Uint8ClampedArray(pixels.buffer, pixels.byteOffset, WIDTH * HEIGHT * 4));
    sourceContext.putImageData(image, 0, 0);

    const output = document.createElement('canvas');
    output.width = WIDTH;
    output.height = HEIGHT;
    const outputContext = output.getContext('2d', { alpha:false });
    outputContext.translate(0, HEIGHT);
    outputContext.scale(1, -1);
    outputContext.drawImage(source, 0, 0);
    return output.toDataURL('image/png');
  }

  function pixelFingerprint(pixels) {
    if (!pixels || pixels.length < WIDTH * HEIGHT * 4) return null;
    const gridX = 32;
    const gridY = 18;
    const samples = [];
    let red = 0;
    let green = 0;
    let blue = 0;
    let count = 0;

    for (let gy = 0; gy < gridY; gy += 1) {
      for (let gx = 0; gx < gridX; gx += 1) {
        const x = Math.min(WIDTH - 1, Math.floor((gx + 0.5) * WIDTH / gridX));
        const y = Math.min(HEIGHT - 1, Math.floor((gy + 0.5) * HEIGHT / gridY));
        const index = (y * WIDTH + x) * 4;
        const r = Number(pixels[index] || 0);
        const g = Number(pixels[index + 1] || 0);
        const b = Number(pixels[index + 2] || 0);
        samples.push(r, g, b);
        red += r;
        green += g;
        blue += b;
        count += 1;
      }
    }

    return {
      width:WIDTH,
      height:HEIGHT,
      gridX,
      gridY,
      samples,
      mean:[red / count, green / count, blue / count]
    };
  }

  function differenceBetween(left, right) {
    const a = left?.samples;
    const b = right?.samples;
    if (!Array.isArray(a) || !Array.isArray(b) || !a.length || a.length !== b.length) return null;
    let total = 0;
    for (let index = 0; index < a.length; index += 1) total += Math.abs(Number(a[index]) - Number(b[index]));
    return total / (a.length * 255);
  }

  function fnv1a(text) {
    let hash = 0x811c9dc5;
    const value = String(text || '');
    for (let index = 0; index < value.length; index += 1) {
      hash ^= value.charCodeAt(index);
      hash = Math.imul(hash, 0x01000193);
    }
    return (`00000000${(hash >>> 0).toString(16)}`).slice(-8);
  }

  function enabled(mesh) {
    try { return mesh?.isEnabled?.() !== false; }
    catch (_) { return true; }
  }

  function materialKey(material) {
    if (!material) return 'sin-material';
    const texture = material.diffuseTexture || material.albedoTexture || material.emissiveTexture;
    return [
      material.name || material.id || 'material',
      Number(material.alpha ?? 1).toFixed(3),
      texture?.name || texture?.url || 'sin-textura',
      Number(texture?.uScale ?? 1).toFixed(3),
      Number(texture?.vScale ?? 1).toFixed(3)
    ].join('|');
  }

  function frustumSnapshot(camera) {
    let planes = null;
    try { planes = B.Frustum.GetPlanes(camera.getTransformationMatrix()); }
    catch (_) {}

    const visible = [];
    for (const mesh of state.scene?.meshes || []) {
      if (!mesh || mesh.isDisposed?.() || !enabled(mesh) || mesh.isVisible === false || Number(mesh.visibility ?? 1) <= 0.001) continue;
      if (mesh.metadata?.validationCameraV310 || mesh.metadata?.validationRenderTargetV310) continue;
      if (planes && typeof mesh.isInFrustum === 'function') {
        try { if (!mesh.isInFrustum(planes)) continue; }
        catch (_) {}
      }
      visible.push([
        String(mesh.name || mesh.uniqueId),
        materialKey(mesh.material),
        Number(mesh.visibility ?? 1).toFixed(3),
        Number(mesh.layerMask ?? ALL_LAYERS),
        mesh.metadata?.remoteAvatarV307 ? 'remote-avatar' : '',
        mesh.metadata?.externalPatioV305 ? 'patio' : ''
      ].join('~'));
    }
    visible.sort();
    return {
      count:visible.length,
      signature:fnv1a(visible.join('\n')),
      items:visible
    };
  }

  async function readRenderTargetPixels() {
    const target = state.renderTarget;
    if (!target) return null;
    target.activeCamera = state.validationCamera;
    target.clearColor = state.scene.clearColor?.clone?.() || target.clearColor;
    target.render(true);
    await nextFrame();
    try {
      return typedPixels(await Promise.resolve(target.readPixels()));
    } catch (error) {
      recordError('read-render-target', error);
      return null;
    }
  }

  async function captureArea(mode, area) {
    ensureCaptureResources();
    state.currentArea = area.id;
    setStatus(`Validación visual ${mode === 'browser' ? 'browser' : 'VR'}: ${area.label}…`);

    state.validationCamera.position.copyFrom(vector(area.position));
    state.validationCamera.setTarget(vector(area.target));
    state.validationCamera.layerMask = ALL_LAYERS;
    state.renderTarget.activeCamera = state.validationCamera;
    await wait(80);
    await nextFrame();

    const structure = frustumSnapshot(state.validationCamera);
    const pixels = await readRenderTargetPixels();
    const fingerprint = pixelFingerprint(pixels);
    const image = flipPixelsToDataUrl(pixels);
    const capture = {
      id:area.id,
      label:area.label,
      mode,
      capturedAt:new Date().toISOString(),
      position:[...area.position],
      target:[...area.target],
      visibleMeshes:structure.count,
      signature:structure.signature,
      fingerprint,
      image,
      pixelReadback:Boolean(pixels),
      structuralItems:structure.items
    };
    state.captures += 1;
    return capture;
  }

  function comparisonStatus(pixelDifference, structuralMatch, meshDeltaRatio) {
    if (pixelDifference == null) return structuralMatch ? 'warning' : 'fail';
    if (!structuralMatch || meshDeltaRatio > 0.04 || pixelDifference > WARNING_THRESHOLD) return 'fail';
    if (meshDeltaRatio > 0.015 || pixelDifference > PASS_THRESHOLD) return 'warning';
    return 'pass';
  }

  function compareArea(area, browserCapture, vrCapture) {
    const pixelDifference = differenceBetween(browserCapture?.fingerprint, vrCapture?.fingerprint);
    const structuralMatch = Boolean(browserCapture && vrCapture && browserCapture.signature === vrCapture.signature);
    const baseCount = Math.max(1, Number(browserCapture?.visibleMeshes || 0));
    const meshDelta = Math.abs(Number(browserCapture?.visibleMeshes || 0) - Number(vrCapture?.visibleMeshes || 0));
    const meshDeltaRatio = meshDelta / baseCount;
    const status = comparisonStatus(pixelDifference, structuralMatch, meshDeltaRatio);
    const notes = [];
    if (pixelDifference == null) notes.push('El dispositivo no permitió leer los píxeles del render canónico.');
    else if (pixelDifference > PASS_THRESHOLD) notes.push(`Diferencia visual ${(pixelDifference * 100).toFixed(2)}%.`);
    if (!structuralMatch) notes.push('La firma de geometría o materiales visibles cambió entre browser y VR.');
    if (meshDelta) notes.push(`Diferencia de ${meshDelta} mallas visibles.`);
    return {
      id:area.id,
      label:area.label,
      status,
      pixelDifference,
      structuralMatch,
      meshDelta,
      meshDeltaRatio,
      browserVisibleMeshes:browserCapture?.visibleMeshes ?? null,
      vrVisibleMeshes:vrCapture?.visibleMeshes ?? null,
      browserSignature:browserCapture?.signature || '',
      vrSignature:vrCapture?.signature || '',
      browserImage:browserCapture?.image || null,
      vrImage:vrCapture?.image || null,
      notes
    };
  }

  function signLike(mesh) {
    const metadata = mesh?.metadata || {};
    const name = String(mesh?.name || '');
    return Boolean(
      metadata.brandLogo || metadata.readableSign || metadata.livePanel || metadata.livePanelKey ||
      metadata.correctedFloor1AnnouncementV305R9 || metadata.correctedFloor1BrandV306R10 || metadata.correctedBoardFaceV305R7 ||
      /anuncio|cartel|letrero|rótulo|rotulo|banner|panel|logo|publicidad/i.test(name)
    );
  }

  function textureOf(mesh) {
    return mesh?.material?.diffuseTexture || mesh?.material?.albedoTexture || mesh?.material?.emissiveTexture || null;
  }

  function visibleMesh(mesh) {
    return Boolean(mesh && !mesh.isDisposed?.() && enabled(mesh) && mesh.isVisible !== false && Number(mesh.visibility ?? 1) > 0.001);
  }

  function collectDiagnostics() {
    const scene = state.scene;
    const signs = (scene?.meshes || []).filter(signLike);
    const visibleSigns = signs.filter(visibleMesh);
    const invertedVisibleSigns = visibleSigns.filter(mesh => {
      const texture = textureOf(mesh);
      const scale = mesh.scaling || {};
      return Number(texture?.uScale ?? 1) < 0 || Number(texture?.vScale ?? 1) < 0 || Number(scale.x ?? 1) < 0 || Number(scale.y ?? 1) < 0;
    });
    const brandFaces = (scene?.meshes || []).filter(mesh => visibleMesh(mesh) && (
      mesh.metadata?.correctedFloor1BrandV306R10 || mesh.metadata?.floor1BrandOrientationR10 || /Anuncio institucional.*R10/i.test(String(mesh.name || ''))
    ));
    const remoteAvatarMeshes = (scene?.meshes || []).filter(mesh => visibleMesh(mesh) && (
      mesh.metadata?.remoteAvatarV307 || mesh.metadata?.remoteAvatar || /avatar remoto|remote avatar/i.test(String(mesh.name || ''))
    ));
    const strict = window.__UCAN_STRICT_VISUAL_PARITY_V309__?.getState?.() || window.__UCAN_STRICT_VISUAL_PARITY_V309__ || null;
    const patio = window.__UCAN_TROPICAL_PATIO_V305__?.getState?.() || window.__UCAN_TROPICAL_PATIO_V305_AUDIT__ || null;
    const presence = window.__UCAN_PRESENCE_XR_V307__?.getState?.() || null;
    const world = window.__UCAN_CROSS_ENV_V308__?.getState?.() || null;
    const voice = window.__UCAN_VOICE_XR_V306__?.getState?.() || null;

    return {
      capturedAt:new Date().toISOString(),
      inXR:state.inXR,
      sceneMeshes:scene?.meshes?.length || 0,
      sceneMaterials:scene?.materials?.length || 0,
      sceneLights:scene?.lights?.length || 0,
      signs:{ total:signs.length, visible:visibleSigns.length, invertedVisible:invertedVisibleSigns.length, brandFaces:brandFaces.length },
      avatars:{ visibleRemoteMeshes:remoteAvatarMeshes.length, presence },
      patio,
      strictParity:strict,
      crossEnvironment:world,
      voice,
      requirements:{
        noVisibleInvertedSigns:invertedVisibleSigns.length === 0,
        floor1BrandFacesPresent:brandFaces.length >= 4,
        patioOutsideBuilding:patio?.remainingViolations === 0 || patio?.patioOutsideBuilding === true,
        strictParityInstalled:Boolean(strict?.installed),
        strictParityCurrentDeviations:Number(strict?.currentDeviations || 0) === 0,
        sameSceneInteraction:Boolean(world?.installed),
        browserVrPresence:Boolean(presence?.installed),
        voiceBridge:Boolean(voice?.installed)
      }
    };
  }

  function summaryFromComparisons() {
    const values = [...state.comparisons.values()];
    const counts = values.reduce((result, item) => {
      result[item.status] = (result[item.status] || 0) + 1;
      return result;
    }, { pass:0, warning:0, fail:0, 'not-run':0 });
    const differences = values.map(item => item.pixelDifference).filter(value => Number.isFinite(value));
    const maximumPixelDifference = differences.length ? Math.max(...differences) : null;
    const averagePixelDifference = differences.length ? differences.reduce((sum, value) => sum + value, 0) / differences.length : null;
    const requirements = state.diagnostics?.requirements || {};
    const semanticFailure = requirements.noVisibleInvertedSigns === false || requirements.patioOutsideBuilding === false || requirements.strictParityInstalled === false;
    const overallStatus = counts.fail || semanticFailure ? 'fail' : counts.warning || Object.values(requirements).some(value => value === false) ? 'warning' : counts.pass ? 'pass' : 'not-run';
    return { overallStatus, totalAreas:values.length, ...counts, maximumPixelDifference, averagePixelDifference };
  }

  async function captureBrowserBaseline() {
    if (state.running) return false;
    if (state.inXR) {
      setStatus('Salga de VR antes de capturar la referencia del browser.');
      return false;
    }
    state.running = true;
    state.browser.clear();
    state.vr.clear();
    state.comparisons.clear();
    state.savedReport = null;
    renderResults();
    try {
      ensureCaptureResources();
      for (const area of AREAS) {
        const capture = await captureArea('browser', area);
        state.browser.set(area.id, capture);
        renderResults();
      }
      state.browserCapturedAt = new Date().toISOString();
      state.autoRunVr = true;
      state.diagnostics = collectDiagnostics();
      setStatus(`Referencia browser completada en ${AREAS.length} áreas. Entre en VR para ejecutar la comparación automática.`);
      openPanel();
      updateAudit();
      return true;
    } catch (error) {
      recordError('browser-baseline', error);
      setStatus(`No se pudo completar la referencia browser: ${error?.message || error}`);
      return false;
    } finally {
      state.running = false;
      state.currentArea = null;
      renderPanel();
    }
  }

  async function captureVrComparison() {
    if (state.running) return false;
    if (!state.inXR) {
      setStatus('Entre en VR antes de ejecutar la comparación WebXR.');
      return false;
    }
    if (!state.browser.size) {
      setStatus('Primero capture la referencia del browser.');
      return false;
    }
    state.running = true;
    state.vr.clear();
    state.comparisons.clear();
    try {
      ensureCaptureResources();
      await wait(650);
      for (const area of AREAS) {
        const capture = await captureArea('vr', area);
        state.vr.set(area.id, capture);
        state.comparisons.set(area.id, compareArea(area, state.browser.get(area.id), capture));
        renderResults();
      }
      state.vrCapturedAt = new Date().toISOString();
      state.diagnostics = collectDiagnostics();
      const summary = summaryFromComparisons();
      setStatus(`Validación visual VR completada: ${summary.pass} correctas, ${summary.warning} advertencias y ${summary.fail} fallos.`);
      await saveReport();
      updateAudit();
      return true;
    } catch (error) {
      recordError('vr-comparison', error);
      setStatus(`No se pudo completar la comparación VR: ${error?.message || error}`);
      return false;
    } finally {
      state.running = false;
      state.currentArea = null;
      renderPanel();
    }
  }

  function reportPayload() {
    state.diagnostics = collectDiagnostics();
    const summary = summaryFromComparisons();
    return {
      runId:`v310-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      version:VERSION,
      revision:REVISION,
      build:BUILD,
      browserCapturedAt:state.browserCapturedAt,
      vrCapturedAt:state.vrCapturedAt,
      userAgent:navigator.userAgent,
      environment:{
        device:/OculusBrowser|Meta Quest|Quest/i.test(navigator.userAgent) ? 'quest' : /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) ? 'mobile' : 'browser',
        secureContext:window.isSecureContext,
        pixelRatio:window.devicePixelRatio,
        renderWidth:state.engine?.getRenderWidth?.() || null,
        renderHeight:state.engine?.getRenderHeight?.() || null,
        hardwareScaling:state.engine?.getHardwareScalingLevel?.() || null,
        browserLanguage:navigator.language
      },
      diagnostics:state.diagnostics,
      summary,
      areas:AREAS.map(area => {
        const comparison = state.comparisons.get(area.id);
        const browserCapture = state.browser.get(area.id);
        const vrCapture = state.vr.get(area.id);
        return comparison ? {
          ...comparison,
          browserImage:browserCapture?.image || null,
          vrImage:vrCapture?.image || null
        } : {
          id:area.id,
          label:area.label,
          status:'not-run',
          browserVisibleMeshes:browserCapture?.visibleMeshes ?? null,
          vrVisibleMeshes:vrCapture?.visibleMeshes ?? null,
          browserSignature:browserCapture?.signature || '',
          vrSignature:vrCapture?.signature || '',
          structuralMatch:false,
          notes:[],
          browserImage:browserCapture?.image || null,
          vrImage:vrCapture?.image || null
        };
      })
    };
  }

  async function saveReport() {
    if (!state.browser.size) return null;
    const payload = reportPayload();
    try {
      const response = await fetch(`${API}/report`, {
        method:'POST',
        credentials:'same-origin',
        headers:{ 'Content-Type':'application/json' },
        body:JSON.stringify(payload)
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || `HTTP ${response.status}`);
      state.savedReport = result;
      setStatus(`Reporte visual guardado: ${result.id}.`);
      renderPanel();
      updateAudit();
      return result;
    } catch (error) {
      recordError('save-report', error);
      setStatus(`La validación terminó, pero el reporte no se pudo guardar: ${error?.message || error}`);
      return null;
    }
  }

  function statusLabel(status) {
    return status === 'pass' ? 'Correcto' : status === 'warning' ? 'Advertencia' : status === 'fail' ? 'Fallo' : 'Pendiente';
  }

  function percent(value) {
    return Number.isFinite(value) ? `${(value * 100).toFixed(2)}%` : '—';
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, character => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[character]));
  }

  function renderResults() {
    if (!state.resultsNode) return;
    const rows = AREAS.map(area => {
      const comparison = state.comparisons.get(area.id);
      const browserCapture = state.browser.get(area.id);
      const vrCapture = state.vr.get(area.id);
      const status = comparison?.status || (browserCapture ? 'warning' : 'not-run');
      const detail = comparison ? percent(comparison.pixelDifference) : browserCapture ? 'Referencia lista' : 'Pendiente';
      const buttons = browserCapture || vrCapture ? `<button class="v310-mini" data-v310-view="${escapeHtml(area.id)}">Comparar</button>` : '';
      return `<tr><td>${escapeHtml(area.label)}</td><td><span class="v310-status ${status}">${statusLabel(status)}</span></td><td>${detail}</td><td>${browserCapture?.visibleMeshes ?? '—'} / ${vrCapture?.visibleMeshes ?? '—'}</td><td>${buttons}</td></tr>`;
    }).join('');
    state.resultsNode.innerHTML = `<table><thead><tr><th>Área</th><th>Estado</th><th>Diferencia</th><th>Mallas B/VR</th><th>Vista</th></tr></thead><tbody>${rows}</tbody></table>`;
    for (const button of state.resultsNode.querySelectorAll('[data-v310-view]')) {
      button.addEventListener('click', () => showComparison(button.dataset.v310View));
    }
  }

  function showComparison(areaId) {
    if (!state.viewerNode) return;
    const browserCapture = state.browser.get(areaId);
    const vrCapture = state.vr.get(areaId);
    const comparison = state.comparisons.get(areaId);
    const area = AREAS.find(item => item.id === areaId);
    state.viewerNode.innerHTML = `
      <h3>${escapeHtml(area?.label || areaId)}</h3>
      <div class="v310-images">
        <figure><figcaption>Browser</figcaption>${browserCapture?.image ? `<img src="${browserCapture.image}" alt="Captura browser de ${escapeHtml(area?.label || areaId)}">` : '<div class="v310-empty">Sin captura</div>'}</figure>
        <figure><figcaption>WebXR</figcaption>${vrCapture?.image ? `<img src="${vrCapture.image}" alt="Captura WebXR de ${escapeHtml(area?.label || areaId)}">` : '<div class="v310-empty">Sin captura</div>'}</figure>
      </div>
      <p><strong>Diferencia visual:</strong> ${percent(comparison?.pixelDifference)} · <strong>Firma estructural:</strong> ${comparison?.structuralMatch ? 'coincide' : 'no coincide'}</p>
      ${comparison?.notes?.length ? `<ul>${comparison.notes.map(note => `<li>${escapeHtml(note)}</li>`).join('')}</ul>` : ''}
    `;
  }

  function renderSemanticChecks() {
    const checks = state.diagnostics?.requirements || {};
    const labels = {
      noVisibleInvertedSigns:'Anuncios sin inversión visible',
      floor1BrandFacesPresent:'Caras corregidas de anuncios del piso 1',
      patioOutsideBuilding:'Patio tropical fuera del edificio',
      strictParityInstalled:'Paridad V309 activa',
      strictParityCurrentDeviations:'Sin desviaciones visuales actuales',
      sameSceneInteraction:'Interacción browser/VR activa',
      browserVrPresence:'Presencia compartida activa',
      voiceBridge:'Puente de audio activo'
    };
    return Object.entries(labels).map(([key, label]) => {
      const value = checks[key];
      const status = value === true ? 'pass' : value === false ? 'fail' : 'warning';
      return `<li><span class="v310-status ${status}">${value === true ? '✓' : value === false ? '✕' : '—'}</span> ${escapeHtml(label)}</li>`;
    }).join('');
  }

  function renderPanel() {
    if (!state.panel) return;
    const summary = summaryFromComparisons();
    const baselineReady = state.browser.size === AREAS.length;
    const vrReady = state.vr.size === AREAS.length;
    state.panel.querySelector('#v310BrowserCapture').disabled = state.running || state.inXR;
    state.panel.querySelector('#v310VrCapture').disabled = state.running || !state.inXR || !baselineReady;
    state.panel.querySelector('#v310Save').disabled = state.running || !baselineReady;
    state.panel.querySelector('#v310BrowserState').textContent = baselineReady ? `Lista · ${state.browserCapturedAt || ''}` : 'Pendiente';
    state.panel.querySelector('#v310VrState').textContent = vrReady ? `Lista · ${state.vrCapturedAt || ''}` : baselineReady ? 'Entre en VR; comenzará automáticamente' : 'Pendiente';
    state.panel.querySelector('#v310Summary').innerHTML = `<strong>Resultado:</strong> ${statusLabel(summary.overallStatus)} · ${summary.pass} correctas · ${summary.warning} advertencias · ${summary.fail} fallos · diferencia máxima ${percent(summary.maximumPixelDifference)}`;
    state.panel.querySelector('#v310Semantic').innerHTML = renderSemanticChecks();
    const saved = state.panel.querySelector('#v310Saved');
    saved.textContent = state.savedReport?.id ? `Reporte guardado: ${state.savedReport.id}` : 'Reporte todavía no guardado.';
    renderResults();
  }

  function ensurePanel() {
    if (state.panel) return;
    const style = document.createElement('style');
    style.id = 'ucanVisualValidationStylesV310';
    style.textContent = `
      #ucanVisualValidationV310{position:fixed;inset:0;z-index:180;display:none;align-items:center;justify-content:center;padding:16px;background:rgba(0,0,0,.82);backdrop-filter:blur(8px)}
      #ucanVisualValidationV310.open{display:flex}#ucanVisualValidationV310 .v310-card{width:min(1180px,98vw);max-height:95vh;overflow:auto;border:3px solid #fed141;border-radius:20px;background:#f4f6f2;color:#10251f;box-shadow:0 30px 100px rgba(0,0,0,.65)}
      #ucanVisualValidationV310 header{position:sticky;top:0;z-index:3;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 16px;background:#007b5f;color:#fff}#ucanVisualValidationV310 h2,#ucanVisualValidationV310 h3{margin:0}
      #ucanVisualValidationV310 .v310-close{min-width:44px;background:#fff;color:#17302b;font-size:22px;padding:6px 12px}#ucanVisualValidationV310 .v310-body{padding:16px}
      #ucanVisualValidationV310 .v310-actions{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0}#ucanVisualValidationV310 button{border:0;border-radius:10px;padding:9px 12px;font-weight:800;background:#fed141;color:#111;cursor:pointer}#ucanVisualValidationV310 button.secondary{background:#173b35;color:#fff}#ucanVisualValidationV310 button:disabled{opacity:.45;cursor:not-allowed}
      #ucanVisualValidationV310 .v310-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}#ucanVisualValidationV310 .v310-box{border:1px solid #c9d6d0;border-radius:14px;background:#fff;padding:12px}
      #ucanVisualValidationV310 table{width:100%;border-collapse:collapse;font-size:13px}#ucanVisualValidationV310 th,#ucanVisualValidationV310 td{padding:8px;border-bottom:1px solid #d8e0dc;text-align:left;vertical-align:top}#ucanVisualValidationV310 th{background:#e8efeb;position:sticky;top:52px}
      #ucanVisualValidationV310 .v310-status{display:inline-block;border-radius:999px;padding:3px 7px;font-size:11px;font-weight:900}.v310-status.pass{background:#d3f4df;color:#075d2b}.v310-status.warning{background:#fff0bd;color:#745400}.v310-status.fail{background:#ffd9d4;color:#8c1d12}.v310-status.not-run{background:#e5e8e7;color:#42504c}
      #ucanVisualValidationV310 .v310-mini{font-size:11px;padding:5px 8px}#ucanVisualValidationV310 .v310-images{display:grid;grid-template-columns:1fr 1fr;gap:10px}#ucanVisualValidationV310 figure{margin:0}#ucanVisualValidationV310 figcaption{font-weight:900;margin-bottom:5px}#ucanVisualValidationV310 img{display:block;width:100%;height:auto;border:1px solid #aebdb6;border-radius:9px;background:#111}#ucanVisualValidationV310 .v310-empty{display:grid;place-items:center;min-height:150px;background:#dfe5e2;border-radius:9px}
      #ucanVisualValidationV310 #v310Status{padding:9px 11px;border-radius:10px;background:#103e37;color:#fff}#ucanVisualValidationV310 ul{margin:8px 0;padding-left:22px}#ucanVisualValidationV310 .v310-note{font-size:13px;color:#405850;line-height:1.45}
      @media(max-width:820px){#ucanVisualValidationV310 .v310-grid,#ucanVisualValidationV310 .v310-images{grid-template-columns:1fr}#ucanVisualValidationV310 th{position:static}}
    `;
    document.head.appendChild(style);

    const panel = document.createElement('section');
    panel.id = 'ucanVisualValidationV310';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('aria-hidden', 'true');
    panel.innerHTML = `
      <div class="v310-card">
        <header><div><h2>Validación visual browser ↔ WebXR</h2><div>UCAN V310 R14</div></div><button class="v310-close" id="v310Close" aria-label="Cerrar">×</button></header>
        <div class="v310-body">
          <p class="v310-note">La validación usa cámaras canónicas idénticas para comparar geometría, materiales, iluminación y píxeles sin mover al usuario. Capture primero el browser y luego entre en VR.</p>
          <div class="v310-grid">
            <div class="v310-box"><strong>Referencia browser</strong><p id="v310BrowserState">Pendiente</p></div>
            <div class="v310-box"><strong>Comparación WebXR</strong><p id="v310VrState">Pendiente</p></div>
          </div>
          <div class="v310-actions"><button id="v310BrowserCapture">1. Capturar browser</button><button id="v310VrCapture">2. Validar ahora en VR</button><button id="v310Save" class="secondary">Guardar reporte</button><button id="v310Export" class="secondary">Exportar JSON</button></div>
          <p id="v310Status" aria-live="polite">Preparando sistema de validación…</p>
          <p id="v310Summary"><strong>Resultado:</strong> Pendiente</p>
          <div class="v310-grid">
            <div class="v310-box"><h3>Comprobaciones funcionales</h3><ul id="v310Semantic"></ul><p id="v310Saved" class="v310-note">Reporte todavía no guardado.</p></div>
            <div class="v310-box" id="v310Viewer"><h3>Comparación de imágenes</h3><p>Seleccione “Comparar” en una de las áreas.</p></div>
          </div>
          <div class="v310-box" style="margin-top:12px"><h3>Resultados por área</h3><div id="v310Results"></div></div>
        </div>
      </div>`;
    document.body.appendChild(panel);
    state.panel = panel;
    state.statusNode = panel.querySelector('#v310Status');
    state.resultsNode = panel.querySelector('#v310Results');
    state.viewerNode = panel.querySelector('#v310Viewer');

    panel.querySelector('#v310Close').addEventListener('click', closePanel);
    panel.querySelector('#v310BrowserCapture').addEventListener('click', captureBrowserBaseline);
    panel.querySelector('#v310VrCapture').addEventListener('click', captureVrComparison);
    panel.querySelector('#v310Save').addEventListener('click', saveReport);
    panel.querySelector('#v310Export').addEventListener('click', exportJson);
    panel.addEventListener('click', event => { if (event.target === panel) closePanel(); });

    const utility = document.getElementById('utilityActions') || document.querySelector('.control-grid');
    if (utility && !document.getElementById('visualValidationBtnV310')) {
      const button = document.createElement('button');
      button.id = 'visualValidationBtnV310';
      button.className = 'secondary';
      button.textContent = 'Validación visual';
      button.addEventListener('click', openPanel);
      utility.appendChild(button);
    }
    renderPanel();
  }

  function openPanel() {
    ensurePanel();
    state.diagnostics = collectDiagnostics();
    renderPanel();
    state.panel.classList.add('open');
    state.panel.setAttribute('aria-hidden', 'false');
  }

  function closePanel() {
    state.panel?.classList.remove('open');
    state.panel?.setAttribute('aria-hidden', 'true');
  }

  function exportJson() {
    const payload = reportPayload();
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type:'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `ucan-validacion-visual-${VERSION.toLowerCase()}-${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  }

  function currentXRState() {
    return state.helper?.baseExperience?.state ?? XR_STATE.NOT_IN_XR;
  }

  function onXRStateChanged(value) {
    const active = value === XR_STATE.ENTERING_XR || value === XR_STATE.IN_XR;
    state.inXR = active;
    if (value === XR_STATE.IN_XR && state.autoRunVr && state.browser.size === AREAS.length && !state.running) {
      state.autoRunVr = false;
      window.setTimeout(captureVrComparison, 1100);
    }
    if (value === XR_STATE.NOT_IN_XR && state.vr.size === AREAS.length) window.setTimeout(openPanel, 350);
    state.diagnostics = collectDiagnostics();
    renderPanel();
    updateAudit();
  }

  function updateAudit() {
    const summary = summaryFromComparisons();
    window.__UCAN_VISUAL_VALIDATION_V310__ = {
      version:VERSION,
      revision:REVISION,
      build:BUILD,
      installed:state.installed,
      inXR:state.inXR,
      running:state.running,
      browserBaselineReady:state.browser.size === AREAS.length,
      vrComparisonReady:state.vr.size === AREAS.length,
      canonicalCameraRenderTargets:true,
      sameCameraForBrowserAndVr:true,
      pixelComparison:true,
      structuralSceneComparison:true,
      screenshotComparison:true,
      persistentReports:true,
      passThreshold:PASS_THRESHOLD,
      warningThreshold:WARNING_THRESHOLD,
      areas:AREAS.length,
      captures:state.captures,
      captureFailures:state.captureFailures,
      currentArea:state.currentArea,
      summary,
      savedReport:state.savedReport,
      lastError:state.lastError,
      open:openPanel,
      captureBrowser:captureBrowserBaseline,
      captureVr:captureVrComparison,
      save:saveReport,
      exportJson,
      getState:() => ({
        installed:state.installed,
        inXR:state.inXR,
        running:state.running,
        browserBaselineReady:state.browser.size === AREAS.length,
        vrComparisonReady:state.vr.size === AREAS.length,
        areas:AREAS.length,
        captures:state.captures,
        summary:summaryFromComparisons(),
        savedReport:state.savedReport,
        lastError:state.lastError
      })
    };
  }

  function install() {
    if (state.installed) return true;
    state.scene = window.__UCAN_API__?.getScene?.() || null;
    state.helper = window.__UCAN_XR_HELPER__ || null;
    state.engine = state.scene?.getEngine?.() || null;
    const parityReady = window.__UCAN_STRICT_VISUAL_PARITY_V309__?.installed === true;
    if (!state.scene || !state.helper?.baseExperience || !state.engine || !parityReady) return false;

    state.installed = true;
    ensureCaptureResources();
    ensurePanel();
    state.helper.baseExperience.onStateChangedObservable?.add?.(onXRStateChanged);
    onXRStateChanged(currentXRState());
    state.diagnostics = collectDiagnostics();
    setStatus('Validación visual V310 lista. Capture primero la referencia del browser.');
    updateAudit();
    console.info('[UCAN V310 R14] Validación visual browser/WebXR instalada.');
    return true;
  }

  let attempts = 0;
  const timer = window.setInterval(() => {
    attempts += 1;
    try {
      if (install() || attempts >= 900) window.clearInterval(timer);
    } catch (error) {
      recordError('install', error);
      if (attempts >= 900) window.clearInterval(timer);
    }
  }, 100);

  updateAudit();
})();
