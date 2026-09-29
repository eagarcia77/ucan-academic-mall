(() => {
  'use strict';

  const fs = require('fs');
  const { Readable } = require('stream');
  const path = require('path');

  const VERSION = 'V329';
  const BUILD = 'V329-20260928-VR-INNOVATION-QUEST-COMFORT';
  const TARGET_FILE = `${path.sep}public${path.sep}campus.html`;
  const SCRIPT = `<script src="/js/ucan_v329_vr_innovation_overlay.js?build=${BUILD}"></script>`;

  const originalCreateReadStream = fs.createReadStream.bind(fs);
  const originalStat = fs.promises.stat.bind(fs.promises);
  const cache = new Map();

  function isCampus(filePath) {
    return String(filePath || '').endsWith(TARGET_FILE) || String(filePath || '').endsWith('/public/campus.html');
  }

  function enhanceHtml(raw) {
    let html = String(raw || '');
    html = html.replace(/UCAN Academic Mall V272/g, 'UCAN Academic Mall V329');
    html = html.replace(/COMPILACIÓN V272 ACTIVA/g, 'COMPILACIÓN V329 VR ACTIVA');
    html = html.replace(/Cargando áreas comunes, anfiteatro renovado y pizarras electrónicas…/g, 'Cargando entorno VR innovador, rutas Meta Quest y ayudas de confort…');
    if (!html.includes('/js/ucan_v329_vr_innovation_overlay.js')) {
      html = html.replace(/<\/body>/i, `${SCRIPT}\n</body>`);
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
    mode: 'campus-html-injection'
  };
})();
