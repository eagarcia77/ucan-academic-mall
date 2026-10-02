(() => {
  'use strict';

  const VERSION = 'V330';
  const REVISION = 'R39';
  const BUILD = 'V330-20261002-XR-IMMERSIVE-STABILITY-R39';
  const state = {
    installed: false,
    scene: null,
    engine: null,
    camera: null,
    panel: null,
    focusIndex: 0,
    lastFrameRate: 72,
    adaptive: true,
    comfort: true,
    interactionNodes: [],
    baseHardwareScaling: 1,
    xrScaleLocked: false
  };

  const QUEST_POINTS = Object.freeze([
    { id:'vr-start', label:'Entrada VR', x:0, y:1.35, z:29, area:'foodcourt', note:'Inicio seguro para Meta Quest. Use joystick izquierdo para caminar y gatillo para seleccionar.' },
    { id:'vr-stairs-1', label:'Ruta a Piso 2', x:-20, y:1.6, z:30, area:null, note:'Entrada de la escalera al Piso 2. En VR acérquese caminando; la autoridad V328 gestiona la subida.' },
    { id:'vr-stairs-2', label:'Ruta a Piso 3', x:-34, y:9.8, z:30, area:null, note:'Entrada del segundo tramo. En VR no se mueve la cámara directamente para proteger la altura y el piso.' },
    { id:'vr-terrace', label:'Terraza VR', x:0, y:28.8, z:40, area:'rooftop', note:'Punto seguro de orientación en la terraza panorámica.' },
    { id:'vr-classroom', label:'Salas virtuales', x:0, y:9.7, z:-18, area:'floor2', note:'Zona de aulas inmersivas para clase, demostración y colaboración.' },
    { id:'vr-theater', label:'Anfiteatro', x:0, y:17.9, z:38, area:'theater', note:'Área para conferencias, orientación y presentaciones inmersivas.' }
  ]);

  function byId(id){ return document.getElementById(id); }
  function xrAuthority(){ return window.__UCAN_XR_FINAL_AUTHORITY_V328__ || null; }
  function inXR(){ return xrAuthority()?.getState?.().inXR === true; }

  window.__UCAN_VR_INNOVATION_V329__ = {
    version:VERSION,
    revision:REVISION,
    build:BUILD,
    loaded:true,
    purpose:'Meta Quest comfort, wayfinding, visual parity guard and safe XR interaction',
    immersiveHardwareScalingLocked:true,
    directXrCameraMovesDisabled:true,
    finalAuthorityDelegation:true,
    getState:()=>({
      inXR:inXR(),
      adaptive:state.adaptive,
      comfort:state.comfort,
      lastFrameRate:state.lastFrameRate,
      baseHardwareScaling:state.baseHardwareScaling,
      xrScaleLocked:state.xrScaleLocked,
      focusIndex:state.focusIndex
    })
  };

  function status(message){
    const el=byId('status')||byId('loadStatus');
    if(el) el.textContent=message;
    const p=byId('ucanV329Status');
    if(p) p.textContent=message;
  }

  function injectUi(){
    if(byId('ucanV329Panel')) return;
    const style=document.createElement('style');
    style.textContent=`
      #ucanV329Panel{position:fixed;right:16px;top:16px;z-index:18;width:min(360px,calc(100vw - 32px));background:rgba(4,18,24,.88);color:#fff;border:1px solid rgba(255,255,255,.18);border-radius:18px;box-shadow:0 22px 70px rgba(0,0,0,.38);backdrop-filter:blur(16px);padding:12px;font-family:Inter,Segoe UI,system-ui,sans-serif}
      #ucanV329Panel h2{margin:0 0 6px;font-size:16px;color:#fed141}#ucanV329Panel p{margin:5px 0;font-size:12px;line-height:1.35;color:#d8fffa}.ucan-v329-grid{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:8px}.ucan-v329-grid button{border:0;border-radius:11px;padding:8px 9px;background:#fed141;color:#07110f;font-weight:800;cursor:pointer}.ucan-v329-grid button.secondary{background:#173033;color:#e7fffb;border:1px solid rgba(255,255,255,.18)}#ucanV329Panel.collapsed .ucan-v329-body{display:none}.ucan-v329-badge{display:inline-flex;gap:6px;align-items:center;border-radius:999px;background:rgba(0,123,95,.25);border:1px solid rgba(255,255,255,.16);padding:4px 8px;font-size:11px;color:#eafffb}.ucan-v329-small{font-size:11px!important;color:#bde3df!important}@media(max-width:820px){#ucanV329Panel{left:10px;right:10px;top:auto;bottom:10px;width:auto;max-height:40vh;overflow:auto}}`;
    document.head.appendChild(style);
    const panel=document.createElement('aside');
    panel.id='ucanV329Panel';
    panel.setAttribute('aria-label','Panel de innovación VR V330');
    panel.innerHTML=`
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
        <div><span class="ucan-v329-badge">${VERSION} · Meta Quest</span><h2>Innovación VR</h2></div>
        <button id="ucanV329Toggle" class="secondary" type="button" aria-expanded="true" style="min-width:38px">−</button>
      </div>
      <div class="ucan-v329-body">
        <p id="ucanV329Status">Inicializando ayudas VR…</p>
        <p class="ucan-v329-small">B/Y o Escape cierra paneles. A/X confirma. En VR, la autoridad V328 controla altura, pisos y traslados.</p>
        <div class="ucan-v329-grid">
          <button id="ucanV329Focus" type="button">Siguiente punto</button>
          <button id="ucanV329Comfort" type="button" class="secondary">Confort: ON</button>
          <button id="ucanV329Quality" type="button" class="secondary">Auto calidad: ON</button>
          <button id="ucanV329Recenter" type="button" class="secondary">Recentrar</button>
        </div>
      </div>`;
    document.body.appendChild(panel);
    state.panel=panel;
    byId('ucanV329Toggle')?.addEventListener('click',()=>{
      panel.classList.toggle('collapsed');
      const open=!panel.classList.contains('collapsed');
      byId('ucanV329Toggle').textContent=open?'−':'+';
      byId('ucanV329Toggle').setAttribute('aria-expanded',String(open));
    });
    byId('ucanV329Focus')?.addEventListener('click',focusNextPoint);
    byId('ucanV329Comfort')?.addEventListener('click',toggleComfort);
    byId('ucanV329Quality')?.addEventListener('click',toggleAdaptive);
    byId('ucanV329Recenter')?.addEventListener('click',recenterCamera);
  }

  function findScene(){
    const B=window.BABYLON;
    const engine=B?.EngineStore?.Instances?.[0]||null;
    const scene=engine?.scenes?.find(s=>s&&!s.isDisposed?.())||null;
    const camera=scene?.activeCamera||null;
    return{B,engine,scene,camera};
  }

  function makeTextTexture(B,scene,label){
    const texture=new B.DynamicTexture(`v329Label-${label}`,{width:512,height:192},scene,false);
    const ctx=texture.getContext();
    ctx.clearRect(0,0,512,192);ctx.fillStyle='rgba(0,123,95,0.94)';ctx.fillRect(0,0,512,192);
    ctx.strokeStyle='#fed141';ctx.lineWidth=10;ctx.strokeRect(6,6,500,180);
    ctx.fillStyle='#ffffff';ctx.font='bold 34px Segoe UI, Arial';ctx.textAlign='center';ctx.fillText(label,256,78);
    ctx.fillStyle='#fed141';ctx.font='22px Segoe UI, Arial';ctx.fillText('Punto interactivo VR',256,120);texture.update();
    return texture;
  }

  function createInteractionPoints(B,scene){
    if(state.interactionNodes.length)return;
    QUEST_POINTS.forEach((point,index)=>{
      const disc=B.MeshBuilder.CreateDisc(`ucanV329Point-${point.id}`,{radius:1.15,tessellation:40},scene);
      disc.position.set(point.x,point.y,point.z);disc.rotation.x=Math.PI/2;
      const mat=new B.StandardMaterial(`ucanV329PointMat-${point.id}`,scene);
      mat.diffuseColor=new B.Color3(0,0.48,0.37);mat.emissiveColor=new B.Color3(0.02,0.22,0.18);mat.alpha=0.88;mat.needDepthPrePass=false;mat.backFaceCulling=false;
      if(B.Material?.MATERIAL_ALPHABLEND!=null)mat.transparencyMode=B.Material.MATERIAL_ALPHABLEND;
      disc.material=mat;
      const plane=B.MeshBuilder.CreatePlane(`ucanV329Label-${point.id}`,{width:4.2,height:1.55},scene);
      plane.position.set(point.x,point.y+1.65,point.z);plane.billboardMode=B.Mesh.BILLBOARDMODE_Y;
      const labelMat=new B.StandardMaterial(`ucanV329LabelMat-${point.id}`,scene);
      labelMat.diffuseTexture=makeTextTexture(B,scene,point.label);labelMat.emissiveColor=new B.Color3(0.4,0.36,0.08);labelMat.backFaceCulling=false;plane.material=labelMat;
      disc.metadata={ucanV329:true,point};plane.metadata={ucanV329:true,point};
      const action=()=>showPoint(point,index);
      [disc,plane].forEach(mesh=>{
        mesh.isPickable=true;
        if(B.ActionManager){mesh.actionManager=new B.ActionManager(scene);mesh.actionManager.registerAction(new B.ExecuteCodeAction(B.ActionManager.OnPickTrigger,action));}
      });
      state.interactionNodes.push({disc,plane,point});
    });
  }

  function showPoint(point,index){
    state.focusIndex=index;
    status(`${point.label}: ${point.note}`);
    const live=byId('currentLocation');if(live)live.textContent=`📍 VR · ${point.label}`;
  }

  function focusNextPoint(){
    if(!state.interactionNodes.length)return;
    state.focusIndex=(state.focusIndex+1)%state.interactionNodes.length;
    const item=state.interactionNodes[state.focusIndex];
    showPoint(item.point,state.focusIndex);
    moveCameraTo(item.point);
  }

  function moveCameraTo(point){
    if(inXR()){
      const authority=xrAuthority();
      if(point.area&&typeof authority?.teleportTo==='function'){
        authority.teleportTo(point.area,'v329-safe-wayfinding');
        status(`${point.label}: traslado realizado mediante la autoridad XR final.`);
      }else{
        status(`${point.label}: punto informativo. En VR camine hasta esta entrada; no se moverá la cámara directamente.`);
      }
      return;
    }
    const cam=window.__UCAN_API__?.getCamera?.()||state.camera||state.scene?.activeCamera;
    if(!cam?.position)return;
    cam.position.x=point.x;cam.position.y=point.y+1.72;cam.position.z=point.z+4.8;
    if(cam.setTarget)cam.setTarget(new window.BABYLON.Vector3(point.x,point.y+1.4,point.z));
  }

  function recenterCamera(){
    const authority=xrAuthority();
    if(inXR()&&typeof authority?.recalibrate==='function'){
      authority.recalibrate();
      status('Altura y centro VR recalibrados por la autoridad V328 sin mover directamente la cámara.');
      return;
    }
    const item=state.interactionNodes[state.focusIndex]||state.interactionNodes[0];
    if(item)moveCameraTo(item.point);
    status('Vista recentrada al punto de innovación seleccionado.');
  }

  function toggleComfort(){
    state.comfort=!state.comfort;
    byId('ucanV329Comfort').textContent=`Confort: ${state.comfort?'ON':'OFF'}`;
    applyComfort();
  }

  function toggleAdaptive(){
    state.adaptive=!state.adaptive;
    byId('ucanV329Quality').textContent=`Auto calidad: ${state.adaptive?'ON':'OFF'}`;
    status(`Calidad automática ${state.adaptive?'activada':'pausada'}. En inmersivo se conserva la escala visual de escritorio.`);
  }

  function applyComfort(){
    document.body.classList.toggle('reduced-motion',state.comfort);
    const scene=state.scene;if(!scene)return;
    scene.animationTimeScale=state.comfort?0.85:1;
    status(state.comfort?'Modo confort VR activo: reduce estímulos y mantiene orientación estable.':'Modo confort VR desactivado.');
  }

  function adaptiveQualityTick(){
    if(!state.engine||!state.adaptive)return;
    const fps=Number(state.engine.getFps?.()||72);
    state.lastFrameRate=Math.round(fps);
    const scene=state.scene;if(!scene)return;
    if(inXR()){
      state.xrScaleLocked=true;
      scene.skipPointerMovePicking=fps<58;
      const current=Number(state.engine.getHardwareScalingLevel?.()||state.baseHardwareScaling);
      if(Math.abs(current-state.baseHardwareScaling)>0.01)state.engine.setHardwareScalingLevel?.(state.baseHardwareScaling);
      return;
    }
    state.xrScaleLocked=false;
    if(fps<58){
      scene.skipPointerMovePicking=true;
      state.engine.setHardwareScalingLevel?.(Math.max(state.baseHardwareScaling,1.35));
      status(`Auto calidad de navegador: rendimiento protegido (${Math.round(fps)} FPS).`);
    }else if(fps>70){
      scene.skipPointerMovePicking=false;
      state.engine.setHardwareScalingLevel?.(state.baseHardwareScaling);
    }
  }

  function installInputShortcuts(){
    window.addEventListener('keydown',event=>{
      const key=event.key.toLowerCase();
      if(key==='escape'||key==='b'||key==='y'){
        ['boardPanel','livePanelViewer'].forEach(id=>byId(id)?.classList?.remove('open'));
        status('Paneles cerrados con atajo B/Y/Escape.');
      }
      if(key==='x'||key==='a')focusNextPoint();
    },{passive:true});
  }

  function installScene(scene,engine,camera,B){
    if(state.installed)return;
    state.installed=true;state.scene=scene;state.engine=engine;state.camera=camera;
    state.baseHardwareScaling=Number(engine.getHardwareScalingLevel?.()||1);
    injectUi();createInteractionPoints(B,scene);applyComfort();installInputShortcuts();
    scene.onBeforeRenderObservable.add(adaptiveQualityTick);
    status('UCAN V330 R39 listo: paridad inmersiva protegida, navegación segura y calidad adaptativa sin cambiar la escala XR.');
  }

  function waitForScene(){
    const found=findScene();
    if(found.B&&found.scene&&found.engine){installScene(found.scene,found.engine,found.camera,found.B);return;}
    setTimeout(waitForScene,700);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{injectUi();waitForScene();});
  else{injectUi();waitForScene();}
})();
