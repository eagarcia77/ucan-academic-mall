(() => {
  'use strict';
  let attempts = 0;
  const startup = window.setInterval(() => {
    attempts += 1;
    const sky = window.__UCAN_INTERACTIVE_SKY__;
    const snapshot = window.__UCAN_SAN_GERMAN__?.skySnapshot;
    if (sky && snapshot) {
      sky.refresh?.();
      const planets = sky.getObjects?.().filter(item => item.kind === 'planet').length || 0;
      const stars = sky.getObjects?.().filter(item => item.kind === 'star').length || 0;
      if (planets >= 7 && stars > 0) window.clearInterval(startup);
    }
    if (attempts >= 30) window.clearInterval(startup);
  }, 1000);
  window.setInterval(() => {
    if (window.__UCAN_SAN_GERMAN__?.skySnapshot) window.__UCAN_INTERACTIVE_SKY__?.refresh?.();
  }, 300000);
})();
