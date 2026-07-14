(() => {
  'use strict';

  const ROOMS = ['SV-201','SV-202','SV-203','SV-204','SV-205','ANF-301'];
  let isAccountAdmin = false;
  let selectedMapFloor = 1;
  let slideshowTimer = null;

  function ready(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn, { once:true });
    else fn();
  }

  function injectStyles() {
    const style = document.createElement('style');
    style.textContent = `
      #ucanMiniMap{position:fixed;right:16px;top:16px;z-index:12;width:220px;background:rgba(6,16,18,.88);border:1px solid rgba(255,255,255,.18);border-radius:16px;padding:10px;box-shadow:0 18px 55px rgba(0,0,0,.34);backdrop-filter:blur(14px)}
      #ucanMiniMap canvas{width:200px;height:135px;display:block;border-radius:10px;background:#e8ece8;border:1px solid rgba(255,255,255,.2)}
      .map-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:7px;font-size:12px;font-weight:800}.map-floor-buttons{display:flex;gap:4px}.map-floor-buttons button{padding:4px 8px;border-radius:7px;font-size:11px}.map-floor-buttons button.active{background:#fff;color:#07382d}
      #adminPanel{position:fixed;inset:0;z-index:42;display:none;align-items:center;justify-content:center;padding:18px;background:rgba(0,0,0,.76);backdrop-filter:blur(8px)}
      #adminPanel.open{display:flex}.admin-card{width:min(1120px,97vw);max-height:94vh;overflow:auto;background:#f7f8f5;color:#14211e;border-radius:20px;border:3px solid #007b5f;box-shadow:0 28px 90px rgba(0,0,0,.55)}
      .admin-head{position:sticky;top:0;z-index:2;display:flex;align-items:center;justify-content:space-between;padding:14px 16px;background:linear-gradient(120deg,#007b5f,#0b5446);color:#fff}.admin-head h2{margin:0;font-size:19px}.admin-close{background:#fff;color:#17302b;min-width:42px}
      .admin-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;padding:16px}.admin-section{background:#fff;border:1px solid #c7d3ce;border-radius:14px;padding:14px}.admin-section h3{margin:0 0 10px;font-size:16px}.admin-field{margin-bottom:10px}.admin-field label{display:block;font-size:12px;font-weight:800;margin-bottom:4px}.admin-field input,.admin-field select{width:100%;background:#fff;border:1px solid #b9c8c1;color:#14211e}.admin-actions{display:flex;flex-wrap:wrap;gap:8px}.admin-status{margin-top:9px;font-size:12px;color:#37514a;white-space:pre-wrap}
      #assetList{display:grid;gap:8px;max-height:360px;overflow:auto}.asset-row{display:grid;grid-template-columns:1fr auto;gap:8px;border:1px solid #d7e0dc;border-radius:10px;padding:9px;background:#fbfcfb}.asset-meta{font-size:12px;color:#48615a}.asset-actions{display:flex;gap:5px;align-items:center}.asset-actions button{padding:6px 8px;font-size:11px}
      #routeAudit{font-size:12px;line-height:1.45}.audit-ok{color:#087a59;font-weight:800}.audit-bad{color:#a12626;font-weight:800}.audit-item{border-bottom:1px solid #e3e8e5;padding:7px 0}
      #pptThumbs{display:none;margin:0 16px 14px;padding:10px;background:#edf1ee;border:1px solid #c8d2ce;border-radius:12px;overflow-x:auto;gap:8px}.ppt-thumb{flex:0 0 120px;border:3px solid transparent;border-radius:8px;background:#111;padding:0;overflow:hidden}.ppt-thumb.active{border-color:#007b5f}.ppt-thumb img{width:100%;height:68px;object-fit:contain;display:block;background:#111}.ppt-thumb span{display:block;background:#fff;color:#17302b;padding:4px;font-size:10px;text-align:center}
      .ppt-extra-actions{padding:0 16px 12px;display:flex;flex-wrap:wrap;gap:8px}.ppt-extra-actions button{background:#e5ece8;color:#17302b;border:1px solid #c6d3cd}
      @media(max-width:900px){#ucanMiniMap{right:8px;top:auto;bottom:8px;width:180px}#ucanMiniMap canvas{width:160px;height:108px}.admin-grid{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  function addHudButtons() {
    const hud = document.getElementById('hud');
    if (!hud) return;
    const row = document.createElement('div');
    row.className = 'control-grid';
    row.innerHTML = '<button id="adminBtn" class="secondary" style="display:none">Contenido</button><button id="auditBtn" class="secondary">Auditar rutas</button>';
    const host = document.getElementById('utilityActions');
    if (host) host.appendChild(row);
    else {
      const status = document.getElementById('status');
      hud.insertBefore(row, status || null);
    }
    document.getElementById('adminBtn')?.addEventListener('click', openAdmin);
    fetch('/api/auth/me').then(r=>r.ok?r.json():null).then(data=>{isAccountAdmin=data?.user?.role==='admin';const btn=document.getElementById('adminBtn');if(btn)btn.style.display=isAccountAdmin?'block':'none';}).catch(()=>{});
    document.getElementById('auditBtn')?.addEventListener('click', () => { openAdmin(); setTimeout(runRouteAudit, 100); });
  }

  function createMiniMap() {
    const wrap = document.createElement('aside');
    wrap.id = 'ucanMiniMap';
    wrap.setAttribute('aria-label','Minimapa del campus');
    wrap.innerHTML = `
      <div class="map-head"><span id="mapTitle">Mapa · Piso 1</span><div class="map-floor-buttons"><button data-floor="1" class="active">1</button><button data-floor="2">2</button><button data-floor="3">3</button><button data-floor="4">R</button></div></div>
      <canvas id="mapCanvas" width="400" height="270"></canvas>`;
    document.body.appendChild(wrap);
    wrap.querySelectorAll('[data-floor]').forEach(btn => btn.addEventListener('click', () => {
      selectedMapFloor = Number(btn.dataset.floor);
      wrap.querySelectorAll('[data-floor]').forEach(b => b.classList.toggle('active', b === btn));
      document.getElementById('mapTitle').textContent = selectedMapFloor===4 ? 'Mapa · Terraza' : `Mapa · Piso ${selectedMapFloor}`;
      teleportToFloor(selectedMapFloor);
    }));
    requestAnimationFrame(drawMiniMapLoop);
  }

  function teleportToFloor(floor) {
    const runtime = window.__UCAN_RUNTIME__;
    if (!runtime?.camera) return;
    const areaKey = floor === 1 ? 'foodcourt' : floor === 2 ? 'floor2' : floor === 3 ? 'theater' : 'rooftop';
    const area = runtime.areas?.[areaKey];
    if (!area) return;
    runtime.camera.position.copyFrom(area.pos());
    runtime.camera.setTarget(area.target());
    window.__UCAN_API__?.setStatus(floor===4?'Minimapa: reubicado en la terraza.':`Minimapa: reubicado en el Piso ${floor}.`);
  }

  function worldToMap(x,z,canvas) {
    return { x: ((x + 72) / 144) * canvas.width, y: ((56 - z) / 112) * canvas.height };
  }

  function drawMiniMapLoop() {
    const canvas = document.getElementById('mapCanvas');
    const runtime = window.__UCAN_RUNTIME__;
    if (canvas && runtime?.camera) {
      const ctx = canvas.getContext('2d');
      const floor = selectedMapFloor;
      ctx.clearRect(0,0,canvas.width,canvas.height);
      ctx.fillStyle = '#eef2ee'; ctx.fillRect(0,0,canvas.width,canvas.height);
      ctx.strokeStyle = '#65746e'; ctx.lineWidth = 3; ctx.strokeRect(10,10,canvas.width-20,canvas.height-20);
      ctx.fillStyle = '#dbe4df';
      if (floor === 1) {
        ctx.fillRect(24,55,95,145); ctx.fillRect(281,55,95,145); ctx.fillRect(145,110,110,45);
        label(ctx,'Cafetería',62,130); label(ctx,'Biblioteca',322,130); label(ctx,'Áreas comunes',200,136);
      } else if (floor === 2) {
        const boxes=[[20,75,'201'],[100,25,'202'],[170,25,'203'],[240,25,'204'],[315,75,'205']];
        boxes.forEach(([x,y,t])=>{ctx.fillRect(x,y,65,80);label(ctx,`SV-${t}`,x+32,y+42);});
      } else if (floor === 3) {
        ctx.fillRect(90,45,240,170); label(ctx,'ANF-301',210,130);
        ctx.fillStyle='#fed141'; ctx.fillRect(45,82,35,105); label(ctx,'Esc.',62,137);
      } else {
        ctx.fillStyle='#c8d8c4'; ctx.fillRect(24,28,88,205); ctx.fillRect(288,28,88,205);
        ctx.fillStyle='#9cc4d0'; ctx.fillRect(125,78,150,105);
        label(ctx,'Terraza',200,42); label(ctx,'Tragaluz',200,130); label(ctx,'Pérgola',67,76); label(ctx,'Mesas',332,78);
      }
      // Escalator markers
      const stairs = floor===1 ? [[-20,32],[-8,32]] : floor===2 ? [[-20,10],[-8,10],[-34,32],[-26,32]] : floor===3 ? [[-34,10],[-26,10]] : [[-58,14]];
      ctx.fillStyle='#85714d'; stairs.forEach(([x,z])=>{const p=worldToMap(x,z,canvas);ctx.beginPath();ctx.arc(p.x,p.y,7,0,Math.PI*2);ctx.fill();});
      // Camera marker only if same floor
      const camFloor = runtime.camera.position.y < 6 ? 1 : runtime.camera.position.y < 14 ? 2 : runtime.camera.position.y < 24 ? 3 : 4;
      if (camFloor === floor) {
        const p = worldToMap(runtime.camera.position.x,runtime.camera.position.z,canvas);
        ctx.save(); ctx.translate(p.x,p.y); ctx.rotate(-runtime.camera.rotation.y);
        ctx.fillStyle='#007b5f'; ctx.beginPath(); ctx.moveTo(0,-12); ctx.lineTo(8,10); ctx.lineTo(0,6); ctx.lineTo(-8,10); ctx.closePath(); ctx.fill(); ctx.restore();
      }
    }
    requestAnimationFrame(drawMiniMapLoop);
  }

  function label(ctx,text,x,y) { ctx.fillStyle='#17302b'; ctx.font='bold 15px Segoe UI,Arial'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(text,x,y); }

  function createAdminPanel() {
    const panel = document.createElement('section');
    panel.id = 'adminPanel';
    panel.setAttribute('role','dialog'); panel.setAttribute('aria-modal','true');
    panel.innerHTML = `
      <div class="admin-card">
        <div class="admin-head"><h2>Contenido institucional · V265</h2><button class="admin-close" id="adminClose" aria-label="Cerrar">×</button></div>
        <div class="admin-grid">
          <div class="admin-section">
            <h3>Contenido persistente</h3>
            <div class="admin-field"><label for="adminRoom">Sala</label><select id="adminRoom">${ROOMS.map(r=>`<option value="${r}">${r}</option>`).join('')}</select></div>
            <div class="admin-field"><label for="adminFile">Archivo para guardar</label><input id="adminFile" type="file"></div>
            <div class="admin-actions"><button id="adminUpload">Guardar y proyectar</button><button id="adminRefresh" class="secondary">Actualizar lista</button></div>
            <div id="adminStatus" class="admin-status">Los archivos se guardan en el volumen local del proyecto.</div>
          </div>
          <div class="admin-section">
            <h3>Archivos guardados</h3>
            <div id="assetList"><div class="asset-meta">Presione “Actualizar lista”.</div></div>
          </div>
          <div class="admin-section">
            <h3>Auditoría de rutas y colisiones</h3>
            <div class="admin-actions"><button id="runAudit">Ejecutar auditoría</button></div>
            <div id="routeAudit" class="admin-status">La auditoría revisa escaleras, pasillos y acceso al anfiteatro.</div>
          </div>
          <div class="admin-section">
            <h3>Estado del servidor</h3>
            <div class="admin-actions"><button id="loadDiagnostics">Consultar diagnóstico</button></div>
            <pre id="diagnosticBox" class="admin-status">Sin consultar.</pre>
          </div>
        </div>
      </div>`;
    document.body.appendChild(panel);
    document.getElementById('adminClose')?.addEventListener('click', closeAdmin);
    panel.addEventListener('click', ev => { if (ev.target === panel) closeAdmin(); });
    document.getElementById('adminUpload')?.addEventListener('click', uploadPersistentAsset);
    document.getElementById('adminRefresh')?.addEventListener('click', refreshAssets);
    document.getElementById('runAudit')?.addEventListener('click', runRouteAudit);
    document.getElementById('loadDiagnostics')?.addEventListener('click', loadDiagnostics);
  }

  function openAdmin() { if(!isAccountAdmin){window.__UCAN_API__?.setStatus('Se requiere una cuenta de administrador para gestionar contenido.');return;} document.getElementById('adminPanel')?.classList.add('open'); refreshAssets(); }
  function closeAdmin() { document.getElementById('adminPanel')?.classList.remove('open'); }
  function setAdminStatus(message) { const el=document.getElementById('adminStatus'); if(el) el.textContent=message; }
  function escapeAttr(v) { return String(v||'').replace(/[&"<>]/g,c=>({'&':'&amp;','"':'&quot;','<':'&lt;','>':'&gt;'}[c])); }
  function escapeHtml(v) { return String(v||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

  async function uploadPersistentAsset() {
    const file = document.getElementById('adminFile')?.files?.[0];
    const room = document.getElementById('adminRoom')?.value || 'SV-201';
    if (!file) { setAdminStatus('Seleccione un archivo.'); return; }
    setAdminStatus(`Guardando ${file.name}…`);
    try {
      const response = await fetch(`/api/assets?room=${encodeURIComponent(room)}&filename=${encodeURIComponent(file.name)}`, {
        method:'POST', headers:{'Content-Type':file.type||'application/octet-stream'}, body:await file.arrayBuffer()
      });
      const data = await response.json().catch(()=>({}));
      if (!response.ok) throw new Error(data.error || `Error ${response.status}`);
      setAdminStatus(`${file.name} guardado en ${room}. Proyectando…`);
      window.__UCAN_API__?.setActiveBoardId(room);
      await window.__UCAN_API__?.loadFileToBoard(room,file);
      window.__UCAN_API__?.openBoardPanel(room);
      await refreshAssets();
    } catch(err) { setAdminStatus(`No se pudo guardar: ${err.message||err}`); }
  }

  async function refreshAssets() {
    const list = document.getElementById('assetList'); if (!list) return;
    list.innerHTML = '<div class="asset-meta">Cargando…</div>';
    try {
      const response = await fetch('/api/assets');
      const data = await response.json();
      const assets = Array.isArray(data.assets) ? data.assets : [];
      if (!assets.length) { list.innerHTML='<div class="asset-meta">No hay archivos guardados.</div>'; return; }
      list.innerHTML = assets.map(asset => `
        <div class="asset-row">
          <div><strong>${escapeHtml(asset.name)}</strong><div class="asset-meta">${escapeHtml(asset.room)} · ${formatBytes(asset.size)} · ${escapeHtml(new Date(asset.createdAt).toLocaleString())}</div></div>
          <div class="asset-actions"><button data-activate="${asset.id}">Proyectar</button><button data-delete="${asset.id}" class="secondary">Eliminar</button></div>
        </div>`).join('');
      list.querySelectorAll('[data-activate]').forEach(btn=>btn.addEventListener('click',()=>activateAsset(btn.dataset.activate)));
      list.querySelectorAll('[data-delete]').forEach(btn=>btn.addEventListener('click',()=>deleteAsset(btn.dataset.delete)));
    } catch(err) { list.innerHTML=`<div class="asset-meta">Error: ${escapeHtml(err.message||err)}</div>`; }
  }

  async function activateAsset(id) {
    try {
      const metaRes = await fetch(`/api/assets/${encodeURIComponent(id)}`);
      const meta = await metaRes.json();
      if (!metaRes.ok) throw new Error(meta.error || 'No se encontró el archivo');
      const fileRes = await fetch(meta.fileUrl);
      if (!fileRes.ok) throw new Error('No se pudo descargar el archivo guardado');
      const blob = await fileRes.blob();
      const file = new File([blob], meta.name, { type: meta.type || blob.type });
      window.__UCAN_API__?.setActiveBoardId(meta.room);
      await window.__UCAN_API__?.loadFileToBoard(meta.room,file);
      window.__UCAN_API__?.openBoardPanel(meta.room);
      closeAdmin();
    } catch(err) { setAdminStatus(`No se pudo proyectar: ${err.message||err}`); }
  }

  async function deleteAsset(id) {
    if (!confirm('¿Eliminar este archivo guardado?')) return;
    try {
      const response = await fetch(`/api/assets/${encodeURIComponent(id)}`, { method:'DELETE' });
      const data = await response.json().catch(()=>({}));
      if (!response.ok) throw new Error(data.error || `Error ${response.status}`);
      await refreshAssets();
    } catch(err) { setAdminStatus(`No se pudo eliminar: ${err.message||err}`); }
  }

  function formatBytes(bytes) { if(!bytes)return '0 B'; const u=['B','KB','MB','GB'];const i=Math.min(Math.floor(Math.log(bytes)/Math.log(1024)),3);return `${(bytes/Math.pow(1024,i)).toFixed(i?1:0)} ${u[i]}`; }

  async function loadDiagnostics() {
    const box = document.getElementById('diagnosticBox');
    if (!box) return;
    box.textContent='Consultando…';
    try { const r=await fetch('/diagnostics'); box.textContent=JSON.stringify(await r.json(),null,2); }
    catch(err){ box.textContent=`Error: ${err.message||err}`; }
  }

  function runRouteAudit() {
    const target = document.getElementById('routeAudit');
    const runtime = window.__UCAN_RUNTIME__;
    if (!target || !runtime?.scene) { if(target) target.textContent='La escena todavía no está lista.'; return; }
    const L=runtime.levels;
    const routes=[
      {name:'Escalera P1 → P2',x1:-23,x2:-17,z1:8,z2:34,y1:L.one,y2:L.two+2.5},
      {name:'Escalera P2 → P1',x1:-11,x2:-5,z1:8,z2:34,y1:L.one,y2:L.two+2.5},
      {name:'Escalera P2 → P3',x1:-37,x2:-31,z1:8,z2:34,y1:L.two,y2:L.three+2.5},
      {name:'Escalera P3 → P2',x1:-29,x2:-23,z1:8,z2:34,y1:L.two,y2:L.three+2.5},
      {name:'Pasillo central anfiteatro',x1:-4.8,x2:1.2,z1:-14,z2:19,y1:L.three-.2,y2:L.three+4.5},
      {name:'Acceso posterior anfiteatro',x1:-18,x2:18,z1:36,z2:45,y1:L.three-.2,y2:L.three+4.5},
      {name:'Corredor central Piso 1',x1:-6,x2:6,z1:-50,z2:48,y1:L.one-.2,y2:L.one+3.5},
      {name:'Corredor central Piso 2',x1:-6,x2:6,z1:-20,z2:48,y1:L.two-.2,y2:L.two+3.5}
    ];
    const blockerPattern=/pared|wall|mesa|silla|butaca|banco|jardinera|podio|control táctil|respaldo|asiento|apoya brazos|sofá|planta|graderia/i;
    const allowed=/escalera|peldaño|banda|pasamanos|cristal|plataforma|ruta|zona VR|zona segura|rampa invisible|escalon central|borde|baranda|señal|techo|losa/i;
    const results=routes.map(route=>{
      const blockers=[];
      for(const mesh of runtime.scene.meshes){
        if(!mesh?.isEnabled?.() || !mesh.getBoundingInfo || !mesh.getAbsolutePosition) continue;
        const name=String(mesh.name||''); if(!blockerPattern.test(name)||allowed.test(name)) continue;
        try{
          mesh.computeWorldMatrix(true); const b=mesh.getBoundingInfo().boundingBox;
          const min=b.minimumWorld,max=b.maximumWorld;
          const hit=max.x>=route.x1&&min.x<=route.x2&&max.z>=route.z1&&min.z<=route.z2&&max.y>=route.y1&&min.y<=route.y2;
          if(hit) blockers.push(name);
        }catch(e){}
      }
      return {...route,blockers:[...new Set(blockers)].slice(0,6)};
    });
    const ok=results.filter(r=>!r.blockers.length).length;
    target.innerHTML=`<div><strong>${ok}/${results.length} rutas sin bloqueos detectados.</strong></div>`+results.map(r=>`<div class="audit-item"><span class="${r.blockers.length?'audit-bad':'audit-ok'}">${r.blockers.length?'REVISAR':'LIBRE'}</span> · ${escapeHtml(r.name)}${r.blockers.length?`<div>Posibles obstáculos: ${r.blockers.map(escapeHtml).join(', ')}</div>`:''}</div>`).join('');
    window.__UCAN_API__?.setStatus(`Auditoría V265: ${ok} de ${results.length} rutas libres.`);
  }

  function setupPowerPointControls() {
    const actions=document.querySelector('.board-actions');
    const viewer=document.getElementById('boardViewer');
    if(!actions||!viewer)return;
    const extra=document.createElement('div'); extra.className='ppt-extra-actions';
    extra.innerHTML='<button id="pptFirst">⏮ Primera</button><button id="pptLast">Última ⏭</button><button id="pptAuto">Auto 5 s</button><button id="pptFull">Pantalla completa</button><a id="pptPdf" hidden target="_blank" rel="noopener"><button type="button">Abrir PDF</button></a>';
    actions.insertAdjacentElement('afterend',extra);
    const thumbs=document.createElement('div'); thumbs.id='pptThumbs'; viewer.insertAdjacentElement('afterend',thumbs);
    document.getElementById('pptFirst')?.addEventListener('click',()=>goToSlide(0));
    document.getElementById('pptLast')?.addEventListener('click',()=>{const r=currentRecord(); if(r?.slideImages?.length)goToSlide(r.slideImages.length-1);});
    document.getElementById('pptAuto')?.addEventListener('click',toggleSlideShow);
    document.getElementById('pptFull')?.addEventListener('click',()=>viewer.requestFullscreen?.());
    window.addEventListener('ucan:board-updated',renderThumbnails);
    setInterval(renderThumbnails,1500);
  }

  function currentRecord(){return window.__UCAN_API__?.getBoardRecord?.();}
  async function goToSlide(index){const r=currentRecord(); if(!r?.slideImages?.length)return; const delta=index-r.pageIndex; if(delta)await window.__UCAN_API__.changeBoardPage(delta); renderThumbnails();}
  function toggleSlideShow(){
    const btn=document.getElementById('pptAuto');
    if(slideshowTimer){clearInterval(slideshowTimer);slideshowTimer=null;if(btn)btn.textContent='Auto 5 s';return;}
    const r=currentRecord(); if(!r?.slideImages?.length)return;
    slideshowTimer=setInterval(()=>window.__UCAN_API__?.changeBoardPage?.(1),5000); if(btn)btn.textContent='Detener auto';
  }
  function renderThumbnails(){
    const r=currentRecord(); const wrap=document.getElementById('pptThumbs'); const pdf=document.getElementById('pptPdf');
    if(!wrap)return;
    if(!r?.slideImages?.length){wrap.style.display='none';wrap.innerHTML='';if(pdf)pdf.hidden=true;return;}
    wrap.style.display='flex';
    if(pdf){pdf.hidden=!r.slidePdfUrl;pdf.href=r.slidePdfUrl||'#';}
    if(wrap.dataset.signature!==r.slideImages.join('|')){
      wrap.dataset.signature=r.slideImages.join('|');
      wrap.innerHTML=r.slideImages.map((src,i)=>`<button class="ppt-thumb" data-slide="${i}"><img src="${escapeAttr(src)}" alt="Diapositiva ${i+1}"><span>${i+1}</span></button>`).join('');
      wrap.querySelectorAll('[data-slide]').forEach(btn=>btn.addEventListener('click',()=>goToSlide(Number(btn.dataset.slide))));
    }
    wrap.querySelectorAll('[data-slide]').forEach((btn,i)=>btn.classList.toggle('active',i===r.pageIndex));
  }

  ready(() => {
    injectStyles();
    addHudButtons();
    createMiniMap();
    createAdminPanel();
    setupPowerPointControls();
    setTimeout(runRouteAudit, 2500);
  });
})();
