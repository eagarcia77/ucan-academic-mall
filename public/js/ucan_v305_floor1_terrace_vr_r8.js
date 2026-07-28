(() => {
  'use strict';
  const B = window.BABYLON;
  if (!B) return;
  const BUILD = 'V305-20260728-FLOOR1-UPRIGHT-TERRACE-JOYSTICK-R8';
  const ROOF_Y = 26;
  const state = { scene:null, helper:null, records:new Map(), controllers:new Map(), candidates:[], infoRoot:null, infoTex:null, infoOpen:false, scans:0, floor1Signs:0, floor1Faces:0, joystickBindings:0, joystickSelections:0, failed:0, lastError:null };
  const md = m => { const o={}; for(let n=m,d=0;n&&d<8;n=n.parent,d++) Object.assign(o,n.metadata||{}); return o; };
  const names = m => { const a=[]; for(let n=m,d=0;n&&d<8;n=n.parent,d++) a.push(String(n.name||'')); return a.join(' '); };
  const pos = m => { try { m.computeWorldMatrix?.(true); return m.getAbsolutePosition?.().clone?.() || m.position.clone(); } catch { return m?.position?.clone?.() || B.Vector3.Zero(); } };
  const canvasOf = m => { try { return (m?.material?.diffuseTexture || m?.material?.emissiveTexture)?.getContext?.()?.canvas || null; } catch { return null; } };
  const dims = m => { try { const b=m.getBoundingInfo().boundingBox; return {w:Math.max(.8,b.maximum.x-b.minimum.x),h:Math.max(.5,b.maximum.y-b.minimum.y)}; } catch { return {w:8,h:4.5}; } };
  const yaw = m => { try { const s=new B.Vector3(),q=new B.Quaternion(),t=new B.Vector3(); m.computeWorldMatrix(true).decompose(s,q,t); return q.toEulerAngles().y; } catch { return Number(m?.rotation?.y||0); } };
  const keyOf = m => {
    const x=md(m), p=pos(m), n=names(m);
    if (p.y<.2 || p.y>7.75 || x.correctedFloor1AnnouncementV305R8 || x.cafeteriaMenu || x.seasonalBoard || x.correctedBoardFaceV305R7) return null;
    if (!canvasOf(m) || /panel información|panel flotante|cielo optimizado|VR R7/i.test(n)) return null;
    if (!(x.livePanel||x.livePanelKey||x.readableSign||/anuncio|publicidad|promoci[oó]n|evento|comunicado|noticia|directorio|cartel|letrero|r[oó]tulo|pantalla digital|informaci[oó]n/i.test(n))) return null;
    return String(x.livePanelKey||x.title||m.name||m.uniqueId).toLowerCase().replace(/\b(frente|reverso|posterior|interior|exterior)\b/g,'').replace(/[^a-z0-9áéíóúñ]+/gi,'-').replace(/^-|-$/g,'');
  };
  function copyTexture(source,key){
    const c=canvasOf(source), t0=source.material?.diffuseTexture||source.material?.emissiveTexture, size=t0?.getSize?.()||{};
    const t=new B.DynamicTexture(`textura piso1 R8 ${key}`,{width:c?.width||size.width||1024,height:c?.height||size.height||512},state.scene,false);
    t.wrapU=t.wrapV=B.Texture.CLAMP_ADDRESSMODE; t.uScale=t.vScale=1; t.uOffset=t.vOffset=0;
    return t;
  }
  function sync(r){
    const c=canvasOf(r.source); if(!c) return;
    const ctx=r.texture.getContext(), s=r.texture.getSize(); ctx.setTransform?.(1,0,0,1,0,0); ctx.clearRect(0,0,s.width,s.height); ctx.drawImage(c,0,0,s.width,s.height); r.texture.update(false);
  }
  function face(r,side,add){
    const m=B.MeshBuilder.CreatePlane(`Anuncio piso 1 R8 ${r.key} ${side}`,{width:r.w,height:r.h,sideOrientation:B.Mesh.FRONTSIDE},state.scene);
    const mat=new B.StandardMaterial(`material piso1 R8 ${r.key} ${side}`,state.scene); mat.diffuseTexture=mat.emissiveTexture=r.texture; mat.disableLighting=true; mat.backFaceCulling=true; mat.specularColor=B.Color3.Black();
    m.material=mat; m.rotationQuaternion=null; m.billboardMode=B.Mesh.BILLBOARDMODE_NONE; m.isPickable=true; m.alwaysSelectAsActiveMesh=true; m.renderingGroupId=3;
    m.metadata={correctedFloor1AnnouncementV305R8:true,floor1KeyR8:r.key,title:r.title,angle:add,side,dynamicTextureInvertYFalse:true};
    return m;
  }
  function align(r){
    const p=pos(r.source), y=yaw(r.source);
    for(const f of r.faces){ const a=y+f.metadata.angle, n=new B.Vector3(Math.sin(a),0,Math.cos(a)); f.position.copyFrom(p.add(n.scale(.045))); f.rotation.set(0,a,0); f.setEnabled(true); f.isVisible=true; f.visibility=1; f.isPickable=true; }
  }
  function hideLegacy(key,source){
    for(const m of state.scene.meshes){ if(!m||m===source||m.metadata?.correctedFloor1AnnouncementV305R8) continue; if(keyOf(m)!==key) continue; m.isPickable=false; m.isVisible=false; m.visibility=0; m.setEnabled?.(false); }
    source.isPickable=false; source.isVisible=false; source.visibility=0; source.setEnabled?.(false);
  }
  function scanFloor1(){
    const best=new Map();
    for(const m of state.scene.meshes){ const k=keyOf(m); if(!k) continue; if(!best.has(k)||md(m).livePanelKey) best.set(k,m); }
    for(const [k,s] of best){ let r=state.records.get(k); if(!r){ const d=dims(s), x=md(s); r={key:k,source:s,w:d.w,h:d.h,title:String(x.title||x.livePanelKey||s.name||'Anuncio'),texture:copyTexture(s,k),faces:[]}; r.faces=[face(r,'frente',0),face(r,'reverso',Math.PI)]; state.records.set(k,r); } sync(r); align(r); hideLegacy(k,r.source); }
    state.floor1Signs=state.records.size; state.floor1Faces=[...state.records.values()].reduce((n,r)=>n+r.faces.length,0);
  }
  function terraceInfo(m){
    if(!m||m.isDisposed?.()||m.isVisible===false||m.isEnabled?.()===false) return null;
    const x=md(m), p=pos(m), n=names(m); if(/Panel información R8|panel flotante cielo optimizado/i.test(n)) return null;
    const celestial=Boolean(x.celestialId||x.celestialData||x.celestialObject)||/objeto cielo|etiqueta cielo|planeta|estrella|luna|saturno|j[uú]piter|marte|venus|mercurio|urano|neptuno|eei|iss/i.test(n);
    const panel=Boolean(x.correctedBoardFaceV305R7||x.livePanel||x.livePanelKey||x.readableSign)||/panel clima|agenda astron[oó]mica|fase lunar|mapa celeste|calendario astron[oó]mico|reloj san germ[aá]n|cartel|letrero|r[oó]tulo/i.test(n);
    if(!(celestial||panel)||(!celestial&&p.y<ROOF_Y)) return null;
    return {celestial,panel};
  }
  function scanTerrace(){
    state.candidates=[];
    for(const m of state.scene.meshes){ const i=terraceInfo(m); if(!i) continue; m.isPickable=true; m.alwaysSelectAsActiveMesh=true; m.metadata={...(m.metadata||{}),terraceR8:true,terraceTypeR8:i.celestial?'celestial':'panel'}; state.candidates.push(m); }
  }
  function createInfo(){
    if(state.infoRoot) return;
    const root=new B.TransformNode('Panel información R8',state.scene), tex=new B.DynamicTexture('textura información R8',{width:1100,height:660},state.scene,false), mat=new B.StandardMaterial('material información R8',state.scene);
    mat.diffuseTexture=mat.emissiveTexture=tex; mat.disableLighting=true; mat.backFaceCulling=true; mat.disableDepthWrite=true;
    for(const [z,r] of [[-.01,0],[.01,Math.PI]]){ const p=B.MeshBuilder.CreatePlane('cara panel información R8',{width:4,height:2.4,sideOrientation:B.Mesh.FRONTSIDE},state.scene); p.parent=root; p.position.z=z; p.rotation.y=r; p.material=mat; p.isPickable=false; p.renderingGroupId=7; }
    root.setEnabled(false); state.infoRoot=root; state.infoTex=tex;
  }
  function drawPanel(m){
    createInfo(); const x=md(m), c=canvasOf(m), celestial=x.celestialId||x.celestialData||x.celestialObject, ctx=state.infoTex.getContext();
    ctx.clearRect(0,0,1100,660); ctx.fillStyle='#071426'; ctx.fillRect(0,0,1100,660); ctx.fillStyle='#fed141'; ctx.fillRect(0,0,1100,16); ctx.fillStyle='#fff'; ctx.textBaseline='top';
    if(celestial){ const id=x.celestialId||x.celestialData?.id, e=x.celestialData||(window.__UCAN_INTERACTIVE_SKY__?.getObjects?.()||[]).find(o=>o.id===id)||{}; ctx.font='bold 50px Arial'; ctx.fillText(e.name||m.name||'Objeto celeste',38,36); ctx.font='28px Arial'; ctx.fillStyle='#9edbe6'; ctx.fillText(e.category||e.kind||'Astronomía',40,106); ctx.fillStyle='#fff'; let y=170; for(const t of [e.constellation&&`Constelación: ${e.constellation}`,Number.isFinite(Number(e.altitude))&&`Altitud: ${Number(e.altitude).toFixed(1)}°`,Number.isFinite(Number(e.azimuth))&&`Azimut: ${Number(e.azimuth).toFixed(1)}°`,e.phase].filter(Boolean)){ctx.fillText(`• ${t}`,42,y);y+=42;} ctx.fillStyle='#e5fbff'; ctx.fillText(e.summary||'Información astronómica disponible.',42,430); }
    else { const title=String(x.title||x.livePanelKey||x.floor1AnnouncementTitleV305R8||m.name||'Información'); ctx.font='bold 46px Arial'; ctx.fillText(title.slice(0,45),38,30); ctx.fillStyle='#f7f5ec'; ctx.fillRect(38,112,1024,470); if(c){ const q=Math.min(1000/c.width,446/c.height),w=c.width*q,h=c.height*q; ctx.drawImage(c,50+(1000-w)/2,124+(446-h)/2,w,h); } }
    ctx.fillStyle='#fff'; ctx.font='22px Arial'; ctx.fillText('B/Y: cerrar · Joystick, gatillo o A/X: seleccionar',38,620); state.infoTex.update(false);
  }
  function placeInfo(){
    if(!state.infoOpen) return; const cam=state.scene.activeCamera||state.helper?.baseExperience?.camera; if(!cam) return; const o=cam.globalPosition?.clone?.()||cam.position.clone(); let f=cam.getForwardRay?.(1)?.direction?.clone?.()||new B.Vector3(0,0,1); f.normalize(); const t=o.add(f.scale(2.7)); t.y=o.y-.05; state.infoRoot.position.copyFrom(t); const v=o.subtract(t); state.infoRoot.rotation.set(0,Math.atan2(v.x,v.z),0);
  }
  function open(m){
    if(!m) return false; const x=md(m), id=x.celestialId||x.celestialData?.id, r7=x.r7PanelKey;
    if(id) window.__UCAN_INTERACTIVE_SKY__?.select?.(id);
    else if(r7) window.__UCAN_VR_SIGNS_V305_R7__?.openByKey?.(r7);
    drawPanel(m); state.infoOpen=true; state.infoRoot.setEnabled(true); placeInfo(); return true;
  }
  function close(){ state.infoOpen=false; state.infoRoot?.setEnabled(false); window.__UCAN_VR_SIGNS_V305_R7__?.close?.(); }
  const rayOf=c=>{ const r=new B.Ray(B.Vector3.Zero(),new B.Vector3(0,0,1),280); try{c.getWorldPointerRayToRef(r);r.direction.normalize();return r;}catch{} const p=c.pointer||c.grip; try{r.origin.copyFrom(p.getAbsolutePosition());B.Vector3.TransformNormalToRef(new B.Vector3(0,0,1),p.getWorldMatrix(),r.direction);r.direction.normalize();}catch{} return r; };
  function pick(c){
    scanFloor1(); scanTerrace(); const all=[...state.records.values()].flatMap(r=>r.faces).concat(state.candidates), ids=new Set(all.map(m=>m.uniqueId)); let r=rayOf(c), p=state.scene.pickWithRay(r,m=>ids.has(m.uniqueId),false); if(p?.hit) return p.pickedMesh;
    let best=null; for(const m of all){ const v=pos(m).subtract(r.origin),d=v.length(); if(d<.4||d>280) continue; v.scaleInPlace(1/d); const a=Math.acos(Math.max(-1,Math.min(1,B.Vector3.Dot(r.direction,v)))), lim=md(m).terraceTypeR8==='celestial'?.35:.24; if(a<lim&&(!best||a<best.a)) best={m,a}; } return best?.m||null;
  }
  function activate(c,kind){ const m=pick(c); if(!m){state.failed++;return false;} if(open(m)&&kind==='joystick') state.joystickSelections++; return true; }
  function bind(c,motion){
    const add=(id,fn)=>{ let q; try{q=motion.getComponent(id);}catch{} if(!q||q.__r8) return; q.__r8=true; q.onButtonStateChangedObservable?.add(()=>{if(q.changes?.pressed&&q.pressed)fn();}); if(/thumbstick/.test(id))state.joystickBindings++; };
    add('xr-standard-thumbstick',()=>activate(c,'joystick')); add('thumbstick',()=>activate(c,'joystick')); add('xr-standard-trigger',()=>activate(c,'trigger')); add('a-button',()=>activate(c,'primary')); add('x-button',()=>activate(c,'primary')); add('b-button',close); add('y-button',close);
  }
  function register(c){ if(!c)return; const k=c.uniqueId||c; if(!state.controllers.has(k))state.controllers.set(k,{c,j:false}); if(c.motionController)bind(c,c.motionController); c.onMotionControllerInitObservable?.add(m=>bind(c,m)); }
  function poll(){
    if(state.helper?.baseExperience?.state!==XR_STATE.IN_XR)return; for(const r of state.controllers.values()){ const p=r.c.inputSource?.gamepad||r.c.motionController?.gamepadObject, j=Boolean(p?.buttons?.[3]?.pressed); if(j&&!r.j)activate(r.c,'joystick'); r.j=j; }
  }
  function audit(){ window.__UCAN_VR_INTERACTION_V305_R8__={version:'V305',revision:'R8',build:BUILD,installed:state.installed,floor1DynamicTextureInvertY:false,floor1TwoFrontFaces:true,terracePlanets:true,terraceSigns:true,joystickEvents:true,joystickFallback:true,floor1Signs:state.floor1Signs,floor1Faces:state.floor1Faces,terraceCandidates:state.candidates.length,controllers:state.controllers.size,joystickBindings:state.joystickBindings,joystickSelections:state.joystickSelections,failedSelections:state.failed,lastError:state.lastError,refresh:()=>{scanFloor1();scanTerrace();},getState:()=>({installed:state.installed,floor1Signs:state.floor1Signs,floor1Faces:state.floor1Faces,terraceCandidates:state.candidates.length,controllers:state.controllers.size,joystickBindings:state.joystickBindings,joystickSelections:state.joystickSelections,lastError:state.lastError})}; }
  function install(){
    if(state.installed)return true; state.scene=window.__UCAN_API__?.getScene?.(); state.helper=window.__UCAN_XR_HELPER__; if(!state.scene||!state.helper?.baseExperience)return false; state.installed=true; createInfo(); scanFloor1(); scanTerrace(); const input=state.helper.input; for(const c of input?.controllers||[])register(c); input?.onControllerAddedObservable?.add(register); input?.onControllerRemovedObservable?.add(c=>state.controllers.delete(c.uniqueId||c)); state.scene.onBeforeRenderObservable.add(()=>{try{poll();placeInfo();if(++state.scans%90===0){scanFloor1();scanTerrace();}audit();}catch(e){state.lastError=String(e?.message||e);}}); audit(); console.info('[UCAN V305 R8] Piso 1 y terraza VR corregidos.'); return true;
  }
  let tries=0; const timer=setInterval(()=>{tries++; if(install()||tries>480)clearInterval(timer);},100); audit();
})();
