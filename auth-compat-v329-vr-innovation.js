(() => {
  'use strict';

  const fs = require('fs');
  const { Readable } = require('stream');
  const path = require('path');

  const VERSION = 'V331';
  const BUILD = 'V331-20261002-XR-SINGLE-VERTICAL-AUTHORITY-R40';
  const TARGET_FILE = `${path.sep}public${path.sep}campus.html`;
  const SCRIPT = `<script src="/js/ucan_v329_vr_innovation_overlay.js?build=${BUILD}"></script>`;
  const STABILITY_SCRIPT = `<script src="/js/ucan_v331_xr_single_authority_guard.js?build=${BUILD}"></script>`;

  global.__UCAN_ACTIVE_RELEASE__ = Object.freeze({
    version: VERSION,
    releaseVersion: VERSION,
    revision: 'R40',
    build: BUILD,
    vrInnovation: true,
    immersiveVisualParityGuard: true,
    xrImmersiveStabilityGuard: true,
    singleVerticalAuthority: true
  });

  const originalCreateReadStream = fs.createReadStream.bind(fs);
  const originalStat = fs.promises.stat.bind(fs.promises);
  const cache = new Map();

  function isCampus(filePath) {
    return String(filePath || '').endsWith(TARGET_FILE) || String(filePath || '').endsWith('/public/campus.html');
  }

  function enhanceHtml(raw) {
    let html = String(raw || '');
    html = html.replace(/UCAN Academic Mall V272/g, 'UCAN Academic Mall V331');
    html = html.replace(/COMPILACIÓN V272 ACTIVA/g, 'COMPILACIÓN V331 · AUTORIDAD VERTICAL ÚNICA ACTIVA');
    html = html.replace(/Cargando áreas comunes, anfiteatro renovado y pizarras electrónicas…/g, 'Cargando entorno VR innovador, rutas Meta Quest y ayudas de confort…');
    if (!html.includes('/js/ucan_v329_vr_innovation_overlay.js')) {
      html = html.replace(/<\/body>/i, `${SCRIPT}\n</body>`);
    }
    if (!html.includes('/js/ucan_v331_xr_single_authority_guard.js')) {
      html = html.replace(/<\/body>/i, `${STABILITY_SCRIPT}\n</body>`);
    }
    return html;
  }

  function getEnhancedBuffer(filePath) {
    const key = String(filePath);
    const stat = fs.statSync(filePath);
    const previous = cache.get(key);
    if (previous && previous.mtimeMs === stat.mtimeMs && previous.size === stat.size) return previous.buffer;
    const raw = fs.readFileSync(filePath, 'utf8');
    const buffer = Buffer.from(enhanceHtml(raw), 'utf8');
    cache.set(key, { mtimeMs: stat.mtimeMs, size: stat.size, buffer });
    return buffer;
  }

  fs.createReadStream = function patchedCreateReadStream(filePath, options) {
    if (isCampus(filePath)) {
      const buffer = getEnhancedBuffer(filePath);
      return Readable.from(buffer);
    }
    return originalCreateReadStream(filePath, options);
  };

  fs.promises.stat = async function patchedStat(filePath, ...rest) {
    const stat = await originalStat(filePath, ...rest);
    if (!isCampus(filePath)) return stat;
    const buffer = getEnhancedBuffer(filePath);
    return new Proxy(stat, {
      get(target, prop) {
        if (prop === 'size') return buffer.length;
        return Reflect.get(target, prop);
      }
    });
  };

  global.__UCAN_V329_VR_INNOVATION_PRELOAD__ = {
    version: VERSION,
    build: BUILD,
    installed: true,
    mode: 'campus-html-injection',
    revision: 'R40',
    immersiveVisualParityGuard: true,
    xrImmersiveStabilityGuard: true,
    singleVerticalAuthority: true
  };
})();
