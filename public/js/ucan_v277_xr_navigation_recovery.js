(() => {
  'use strict';

  const VERSION = 'V277';
  const BUILD = 'V277-20260720-XR-NAV-ROLLBACK-PERSISTENCE';
  const B = window.BABYLON;
  if (!B?.Scene?.prototype?.createDefaultXRExperienceAsync) return;

  const LEVEL = Object.freeze({ one:0, two:8.2, three:16.4, roof:27.2 });
  const FLOORS = Object.freeze([LEVEL.one, LEVEL.two, LEVEL.three, LEVEL.roof]);
  const WORLD = Object.freeze({ minX:-73, maxX:73, minZ:-59, maxZ:59 });
  const SPEED = Object.freeze({ comfort:3.4, natural:5, fast:7 });
  const RUN_SPEED = Object.freeze({ comfort:5, natural:7.5, fast:8.5 });
  const ENTRY_DEPTH = 4.3;
  const AUTO_ESCALATOR_SPEED = 2.15;

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

  const LANES = Object.freeze([
    { id:'p1-p2-oeste', minX:-24.8, maxX:-15.2, zLow:34.4, zHigh:7.6, low:LEVEL.one, high:LEVEL.two },
    { id:'p2-p1-este', minX:-12.8, maxX:-3.2, zLow:34.4, zHigh:7.6, low:LEVEL.one, high:LEVEL.two },
    { id:'p2-p3-oeste', minX:-38.8, maxX:-29.2, zLow:34.4, zHigh:7.6, low:LEVEL.two, high:LEVEL.three },
    { id:'p3-p2-este', minX:-30.8, maxX:-21.2, zLow:34.4, zHigh:7.6, low:LEVEL.two, high:LEVEL.three },
    { id:'p3-terraza', minX:38.7, maxX:49.3, zLow:41.2, zHigh:8.0, low:LEVEL.three, high:LEVEL.roof }
  ]);

  const RAMPS = Object.freeze([
    { id:'anfiteatro-central', minX:-5.2, maxX:1.6, z0:-14.5, z1:19.3, rise:2.38 },
    { id:'anfiteatro-lateral', minX:17.8, maxX:23.2, z0:-8.5, z1:19.3, rise:2.04 }
  ]);

  const state = {
    scene:null, helper:null, xr:null, desktop:null, inXR:false, poseReady:false,
    floor:LEVEL.one, ground:LEVEL.one, appliedGround:LEVEL.one, transition:null,
    velocity:null, lastSafe:null, previousSafe:null, run:false,
    jumpPressed:false, jumping:false, jumpVelocity:0, jumpOffset:0,
    rollbackPressed:false, verticalLatch:false, turnLatch:false,
    speedMode:'natural', turnMode:localStorage.getItem('ucanVrTurnMode') || 'smooth',
    blockers:[], railMaterial:null, navigationPatched:false
  };

  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const lerp=(a,b,t)=>a+(b-a)*t;
  const finite=v=>Number.isFinite(Number(v));
  const same=(a,b)=>Math.abs(Number(a)-Number(b))<0.05;
  const nearestFloor=y=>FLOORS.reduce((best,f)=>Math.abs(y-f)<Math.abs(y-best)?f:best,FLOORS[0]);
  const normalSpeed=()=>SPEED[state.speedMode]||SPEED.natural;
  const currentSpeed=()=>state.run?(RUN_SPEED[state.speedMode]||RUN_SPEED.natural):normalSpeed();

  function status(message){
    window.__UCAN_API__?.setStatus?.(message);
    const el=document.getElementById('status');
    if(el&&!window.__UCAN_API__?.setStatus)el.textContent=message;
  }

  function yaw(camera){
    try{if(camera?.rotationQuaternion?.toEulerAngles)return camera.rotationQuaternion.toEulerAngles().y;}catch(_){}
    return Number(camera?.rotation?.y||0);
  }
  function setYaw(camera,value){
    if(camera?.rotationQuaternion&&B.Quaternion?.FromEulerAngles)camera.rotationQuaternion.copyFrom(B.Quaternion.FromEulerAngles(0,value,0));
    else if(camera?.rotation)camera.rotation.y=value;
  }

  function controller(hand){
    return (state.helper?.input?.controllers||[]).find(item=>(item?.inputSource?.handedness||item?.motionController?.handedness)===hand)||null;
  }
  function gamepad(hand){
    const item=controller(hand);
    return item?.inputSource?.gamepad||item?.motionController?.gamepadObject||item?.motionController?.gamepad||null;
  }
  function components(hand){
    const motion=controller(hand)?.motionController;
    if(!motion)return[];
    if(motion.components&&typeof motion.components==='object')return Object.entries(motion.components).map(([id,value])=>({id,value}));
    try{return(motion.getComponentIds?.()||[]).map(id=>({id,value:motion.getComponent?.(id)}));}catch(_){return[];}
  }
  function componentPressed(hand,pattern){
    return components(hand).some(({id,value})=>pattern.test(String(id))&&(value?.pressed===true||Number(value?.value||0)>0.72));
  }
  function buttonPressed(hand,indexes){
    const buttons=Array.from(gamepad(hand)?.buttons||[]);
    return indexes.some(index=>buttons[index]?.pressed===true||Number(buttons[index]?.value||0)>0.72);
  }
  function axes(hand){
    const values=Array.from(gamepad(hand)?.axes||[]);
    if(values.length<2)return{x:0,y:0};
    const offset=values.length>=4?values.length-2:0;
    const dead=raw=>{const v=finite(raw)?Number(raw):0,m=Math.abs(v);return m<=0.14?0:Math.sign(v)*clamp((m-0.14)/0.86,0,1);};
    return{x:dead(values[offset]),y:dead(values[offset+1])};
  }
  const runControl=()=>componentPressed('left',/thumbstick|squeeze|grip/i)||buttonPressed('left',[1,3]);
  const jumpControl=()=>componentPressed('right',/(?:^|[-_])(a|x)-?button|thumbstick/i)||buttonPressed('right',[3,4]);
  const rollbackControl=()=>componentPressed('right',/(?:^|[-_])b-?button/i)||buttonPressed('right',[5]);

  function insideLane(p,l,margin=0){
    return p.x>=l.minX-margin&&p.x<=l.maxX+margin&&p.z>=Math.min(l.zLow,l.zHigh)-margin&&p.z<=Math.max(l.zLow,l.zHigh)+margin;
  }
  function progress(p,l){return clamp((l.zLow-p.z)/(l.zLow-l.zHigh),0,1);}
  function compatibleEntry(p,l){
    if(!insideLane(p,l,0.3))return null;
    if(same(state.floor,l.low)&&Math.abs(p.z-l.zLow)<=ENTRY_DEPTH)return'up';
    if(same(state.floor,l.high)&&Math.abs(p.z-l.zHigh)<=ENTRY_DEPTH)return'down';
    return null;
  }
  function beginTransition(lane,direction){
    state.transition={id:lane.id,direction,origin:direction==='up'?lane.low:lane.high,target:direction==='up'?lane.high:lane.low,startedAt:performance.now()};
    state.previousSafe=state.lastSafe?.clone?.()||null;
    state.jumping=false;state.jumpOffset=0;state.jumpVelocity=0;
    status(direction==='up'?(lane.id==='p3-terraza'?'Subiendo automáticamente hacia la terraza.':'Subiendo por la escalera.'):'Bajando por la escalera.');
  }
  function activeLane(){
    if(state.transition)return LANES.find(l=>l.id===state.transition.id)||null;
    for(const lane of LANES){const direction=compatibleEntry(state.xr.position,lane);if(direction){beginTransition(lane,direction);return lane;}}
    return null;
  }
  function surfaceAt(){
    const lane=activeLane();
    if(lane){const t=progress(state.xr.position,lane);return{type:'stair',lane,t,ground:lerp(lane.low,lane.high,t)};}
    if(!same(state.floor,LEVEL.three))return null;
    const ramp=RAMPS.find(r=>state.xr.position.x>=r.minX&&state.xr.position.x<=r.maxX&&state.xr.position.z>=r.z0&&state.xr.position.z<=r.z1);
    if(!ramp)return null;
    const t=clamp((state.xr.position.z-ramp.z0)/(ramp.z1-ramp.z0),0,1);
    return{type:'ramp',ramp,t,ground:LEVEL.three+ramp.rise*t};
  }

  function applyGround(target){
    const delta=target-state.appliedGround;
    if(state.poseReady&&finite(delta)&&Math.abs(delta)>0.0005)state.xr.position.y+=delta;
    state.appliedGround=target;
  }
  function finishTransition(lane,target){
    const up=same(target,lane.high);
    state.floor=target;state.ground=target;state.appliedGround=target;state.transition=null;
    state.xr.position.y=target;
    state.xr.position.z=up?lane.zHigh-1.25:lane.zLow+1.25;
    state.xr.position.x=clamp(state.xr.position.x,lane.minX+0.55,lane.maxX-0.55);
    state.velocity.set(0,0,0);state.lastSafe.copyFrom(state.xr.position);
    status(up&&lane.id==='p3-terraza'?'Llegó correctamente a la terraza.':'Cambio de piso completado.');
  }

  function horizontalBasis(camera){
    let forward;try{forward=camera.getForwardRay?.(1)?.direction?.clone?.();}catch(_){}
    if(!forward){const a=yaw(camera);forward=new B.Vector3(Math.sin(a),0,Math.cos(a));}
    forward.y=0;if(forward.lengthSquared()<0.0001)forward.set(0,0,1);forward.normalize();
    return{forward,right:new B.Vector3(forward.z,0,-forward.x).normalize()};
  }
  function collisionMesh(mesh){
    if(!mesh||!mesh.checkCollisions)return false;
    if(mesh.metadata?.xrUnderStairBlocker)return true;
    if(mesh.metadata?.xrStairSurface||mesh.isVisible===false)return false;
    if(typeof mesh.isEnabled==='function'&&!mesh.isEnabled())return false;
    return !/gran losa|ruta avatar|zona segura VR|rooftop deck|rampa invisible|plataforma (?:inicio|fin)|peldaño|banda escalera/i.test(String(mesh.name||''));
  }
  function blocked(step,ground){
    if(!state.scene?.pickWithRay||!B.Ray||step.lengthSquared()<1e-7)return false;
    const direction=step.clone().normalize(),length=step.length()+0.46;
    for(const height of[0.42,1.18]){
      const hit=state.scene.pickWithRay(new B.Ray(new B.Vector3(state.xr.position.x,ground+height,state.xr.position.z),direction,length),collisionMesh,false);
      if(hit?.hit&&hit.distance<=length)return true;
    }
    return false;
  }

  function move(dt){
    const left=axes('left');
    const lane=state.transition?LANES.find(l=>l.id===state.transition.id):null;
    state.run=runControl();
    if(lane){
      const dir=state.transition.direction==='up'?-1:1;
      const manualAlong=clamp(-left.y*dir,-1,1);
      const assisted=Math.abs(left.y)<0.18?AUTO_ESCALATOR_SPEED:Math.max(1.6,currentSpeed()*Math.max(0.35,Math.abs(manualAlong)));
      const dz=dir*assisted*dt;
      state.xr.position.z=clamp(state.xr.position.z+dz,Math.min(lane.zLow,lane.zHigh)-1.5,Math.max(lane.zLow,lane.zHigh)+1.5);
      state.xr.position.x=lerp(state.xr.position.x,(lane.minX+lane.maxX)/2,clamp(dt*3.2,0,1));
      return;
    }
    const basis=horizontalBasis(state.xr);
    const desired=basis.right.scale(left.x).add(basis.forward.scale(-left.y));
    const magnitude=Math.min(1,Math.hypot(left.x,left.y));
    if(desired.lengthSquared()>1)desired.normalize();
    desired.scaleInPlace(currentSpeed()*(0.72+0.28*magnitude));
    const response=1-Math.exp(-(desired.lengthSquared()>0.0001?23:27)*dt);
    state.velocity=B.Vector3.Lerp(state.velocity,desired,response);state.velocity.y=0;
    if(state.velocity.lengthSquared()<0.0004)state.velocity.set(0,0,0);
    let step=state.velocity.scale(dt),max=currentSpeed()*0.05;if(step.length()>max)step=step.normalize().scale(max);
    if(step.lengthSquared()<1e-8)return;
    if(!blocked(step,state.ground)){
      state.xr.position.x=clamp(state.xr.position.x+step.x,WORLD.minX,WORLD.maxX);
      state.xr.position.z=clamp(state.xr.position.z+step.z,WORLD.minZ,WORLD.maxZ);
      return;
    }
    for(const part of[new B.Vector3(step.x,0,0),new B.Vector3(0,0,step.z)])if(part.lengthSquared()>1e-8&&!blocked(part,state.ground)){
      state.xr.position.x=clamp(state.xr.position.x+part.x,WORLD.minX,WORLD.maxX);
      state.xr.position.z=clamp(state.xr.position.z+part.z,WORLD.minZ,WORLD.maxZ);
    }
  }

  function updateJump(dt,surface){
    const right=axes('right');
    const pressed=jumpControl()||(!state.transition&&right.y<-0.78);
    if(pressed&&!state.jumpPressed&&!state.jumping&&!state.transition&&surface?.type!=='stair'){
      state.jumping=true;state.jumpVelocity=4.45;state.jumpOffset=0;status('Brinco VR activado.');
    }
    state.jumpPressed=pressed;
    if(state.transition&&state.jumping){state.jumping=false;state.jumpVelocity=0;state.jumpOffset=0;}
    if(!state.jumping)return;
    state.jumpVelocity-=12.5*dt;state.jumpOffset+=state.jumpVelocity*dt;
    if(state.jumpOffset<=0){state.jumpOffset=0;state.jumpVelocity=0;state.jumping=false;}
  }

  function manualVerticalRecovery(dt){
    const right=axes('right');
    if(state.transition)return;
    const cameraY=Number(state.xr.position.y);
    const between=FLOORS.every(f=>Math.abs(cameraY-f)>0.42);
    if(!between||Math.abs(right.y)<0.62){state.verticalLatch=false;return;}
    const delta=-right.y*3.2*dt;
    state.xr.position.y=clamp(state.xr.position.y+delta,LEVEL.one,LEVEL.roof);
    state.appliedGround=state.xr.position.y;state.ground=state.xr.position.y;
    const snap=FLOORS.find(f=>Math.abs(state.xr.position.y-f)<0.22);
    if(snap!==undefined){state.floor=snap;state.ground=snap;state.appliedGround=snap;state.xr.position.y=snap;state.lastSafe.copyFrom(state.xr.position);status(`Nivel recuperado: ${snap.toFixed(1)} m.`);}
  }

  function updateGround(dt){
    const surface=surfaceAt();
    let ground=state.floor;
    if(surface?.type==='stair'){
      ground=surface.ground;
      if(state.transition?.direction==='up'&&surface.t>=0.965){finishTransition(surface.lane,surface.lane.high);return;}
      if(state.transition?.direction==='down'&&surface.t<=0.035){finishTransition(surface.lane,surface.lane.low);return;}
    }else if(surface?.type==='ramp')ground=surface.ground;
    updateJump(dt,surface);state.ground=ground;applyGround(ground+state.jumpOffset);
  }

  function turn(dt){
    const right=axes('right');
    if(Math.abs(right.y)>0.6)return;
    if(state.turnMode==='smooth'){
      state.turnLatch=false;if(Math.abs(right.x)<0.16)return;setYaw(state.xr,yaw(state.xr)+right.x*1.9*dt);return;
    }
    if(Math.abs(right.x)<0.35){state.turnLatch=false;return;}
    if(state.turnLatch||Math.abs(right.x)<0.72)return;
    state.turnLatch=true;setYaw(state.xr,yaw(state.xr)+(right.x>0?Math.PI/6:-Math.PI/6));
  }

  function rollbackPosition(){
    const pressed=rollbackControl();
    if(pressed&&!state.rollbackPressed&&state.previousSafe){
      const current=state.xr.position.clone();state.xr.position.copyFrom(state.previousSafe);state.previousSafe=current;
      state.floor=nearestFloor(state.xr.position.y);state.ground=state.floor;state.appliedGround=state.floor;state.xr.position.y=state.floor;
      state.transition=null;state.velocity.set(0,0,0);state.lastSafe.copyFrom(state.xr.position);status('Rollback de posición aplicado.');
    }
    state.rollbackPressed=pressed;
  }

  function teleportTo(key,source='button'){
    const target=AREAS[key];if(!target||!state.xr)return false;
    state.previousSafe=state.lastSafe?.clone?.()||state.xr.position.clone();
    state.floor=target.floor;state.ground=target.floor;state.appliedGround=target.floor;state.transition=null;
    state.jumping=false;state.jumpOffset=0;state.jumpVelocity=0;state.velocity?.set?.(0,0,0);
    state.xr.position.set(target.x,target.floor,target.z);setYaw(state.xr,target.yaw);
    state.lastSafe.copyFrom(state.xr.position);
    if(state.desktop?.position){state.desktop.position.set(target.x,target.floor+1.72,target.z);setYaw(state.desktop,target.yaw);}
    const label=key==='rooftop'?'Terraza':key;status(`${label}: navegación inmersiva completada desde ${source}.`);
    window.dispatchEvent(new CustomEvent('ucan:xr-area-changed',{detail:{key,floor:target.floor,position:{x:target.x,y:target.floor,z:target.z}}}));
    return true;
  }

  function patchNavigation(){
    if(state.navigationPatched)return;
    const attempt=()=>{
      const api=window.__UCAN_API__;
      if(!api){setTimeout(attempt,120);return;}
      if(!api.__v277OriginalGoToArea)api.__v277OriginalGoToArea=api.goToArea;
      api.goToArea=key=>state.inXR?teleportTo(key,'API'):api.__v277OriginalGoToArea?.(key);
      api.goTo=api.goToArea;
      state.navigationPatched=true;
    };
    attempt();
    document.addEventListener('click',event=>{
      if(!state.inXR)return;
      const button=event.target?.closest?.('[data-go],#destinationGo');if(!button)return;
      const key=button.id==='destinationGo'?document.getElementById('destinationSelect')?.value:button.dataset.go;
      if(!key||!AREAS[key])return;
      event.preventDefault();event.stopImmediatePropagation();teleportTo(key,'botón');
    },true);
  }

  function createBlockers(scene){
    const material=new B.StandardMaterial('bloqueo invisible bajo escaleras V277',scene);material.alpha=0.001;material.disableLighting=true;material.backFaceCulling=false;
    const blockers=[];
    for(const lane of LANES){
      const segments=lane.id==='p3-terraza'?18:14,run=Math.abs(lane.zLow-lane.zHigh),depth=run/segments+0.34,width=Math.max(1.4,lane.maxX-lane.minX-0.5);
      for(let i=1;i<segments-1;i++){
        const t=(i+0.5)/segments,surface=lerp(lane.low,lane.high,t),bottom=lane.low-0.08,top=surface-0.3,height=top-bottom;
        if(height<0.5)continue;
        const mesh=B.MeshBuilder.CreateBox(`bloqueo bajo escalera ${lane.id} ${i}`,{width,height,depth},scene);
        mesh.position.set((lane.minX+lane.maxX)/2,bottom+height/2,lerp(lane.zLow,lane.zHigh,t));mesh.material=material;
        mesh.visibility=0.001;mesh.isVisible=true;mesh.isPickable=true;mesh.checkCollisions=true;mesh.alwaysSelectAsActiveMesh=true;
        mesh.metadata={xrUnderStairBlocker:true,stairId:lane.id,segment:i};blockers.push(mesh);
      }
    }
    state.blockers=blockers;
    window.__UCAN_UNDER_STAIR_BLOCKERS__={version:VERSION,active:blockers.length>0,count:blockers.length,stairs:LANES.length,terraceProtected:true};
  }

  function fixRails(scene){
    const meshes=(scene.meshes||[]).filter(mesh=>/baranda cristal|cristal lateral escalera|cristal escalera|baranda.*escalera|baranda hueco escalera terraza/i.test(String(mesh?.name||'')));
    if(!meshes.length)return;
    const material=new B.StandardMaterial('cristal barandas XR V277',scene);material.diffuseColor=B.Color3.FromHexString('#9bdde8');material.emissiveColor=B.Color3.FromHexString('#173f46').scale(0.28);material.specularColor=new B.Color3(0.18,0.24,0.26);material.alpha=0.28;material.backFaceCulling=false;material.needDepthPrePass=false;material.disableDepthWrite=true;material.separateCullingPass=true;if(B.Material?.MATERIAL_ALPHABLEND!=null)material.transparencyMode=B.Material.MATERIAL_ALPHABLEND;
    meshes.forEach((mesh,index)=>{mesh.material=material;mesh.renderingGroupId=2;mesh.alphaIndex=200+index;mesh.isVisible=true;mesh.visibility=1;mesh.alwaysSelectAsActiveMesh=true;});state.railMaterial=material;
  }

  function disableBuiltIns(helper){
    const manager=helper?.baseExperience?.featuresManager;if(!manager)return;
    for(const name of[B.WebXRFeatureName?.MOVEMENT,B.WebXRFeatureName?.TELEPORTATION].filter(Boolean))try{manager.disableFeature(name);}catch(_){}
  }
  function stairCollisionFix(scene){
    for(const mesh of scene.meshes||[])if(/peldaño|banda escalera|rampa invisible|plataforma (?:inicio|fin)|escalon central anfiteatro|pasillo lateral escalera anfiteatro/i.test(String(mesh?.name||''))){mesh.metadata={...(mesh.metadata||{}),xrStairSurface:true};mesh.checkCollisions=false;mesh.isPickable=true;}
  }

  function initialPose(camera){
    const desktopFloor=nearestFloor(Number(state.desktop?.position?.y||1.72)-1.72);
    state.floor=desktopFloor;state.ground=desktopFloor;state.appliedGround=desktopFloor;state.transition=null;
    camera.position.x=Number(state.desktop?.position?.x||0);camera.position.y=desktopFloor;camera.position.z=Number(state.desktop?.position?.z||42);setYaw(camera,yaw(state.desktop));
    state.poseReady=true;state.lastSafe.copyFrom(camera.position);
  }
  function safety(){
    const p=state.xr.position,valid=finite(p.x)&&finite(p.y)&&finite(p.z)&&p.x>=WORLD.minX-3&&p.x<=WORLD.maxX+3&&p.z>=WORLD.minZ-3&&p.z<=WORLD.maxZ+3&&p.y>=LEVEL.one-1.2&&p.y<=LEVEL.roof+4.8;
    if(!valid){p.copyFrom(state.lastSafe||new B.Vector3(0,state.floor,42));state.velocity.set(0,0,0);state.transition=null;state.floor=nearestFloor(p.y);state.ground=state.floor;state.appliedGround=state.floor;p.y=state.floor;}else if(!state.transition&&!state.jumping)state.lastSafe.copyFrom(p);
  }
  function syncDesktop(){
    if(!state.desktop?.position)return;state.desktop.position.x=state.xr.position.x;state.desktop.position.z=state.xr.position.z;state.desktop.position.y=state.floor+1.72;
  }
  function update(){
    if(!state.inXR||!state.poseReady)return;
    const dt=clamp((state.scene.getEngine().getDeltaTime()||16)/1000,0.001,0.033);
    move(dt);turn(dt);updateGround(dt);manualVerticalRecovery(dt);rollbackPosition();safety();syncDesktop();
  }

  function controlsUI(){
    const grid=document.querySelector('.control-grid');if(!grid||document.getElementById('ucanVrRecoveryBtn'))return;
    const recovery=document.createElement('button');recovery.id='ucanVrRecoveryBtn';recovery.className='secondary';recovery.textContent='Rollback posición';recovery.onclick=()=>{if(state.previousSafe){const current=state.xr.position.clone();state.xr.position.copyFrom(state.previousSafe);state.previousSafe=current;state.floor=nearestFloor(state.xr.position.y);state.ground=state.floor;state.appliedGround=state.floor;state.xr.position.y=state.floor;state.transition=null;state.lastSafe.copyFrom(state.xr.position);status('Rollback de posición aplicado.');}};
    grid.appendChild(recovery);
  }

  function install(scene,helper){
    if(!helper||helper.__ucanV277)return helper;helper.__ucanV277=true;
    state.scene=scene;state.helper=helper;state.xr=helper.baseExperience.camera;state.desktop=scene.activeCamera;state.velocity=new B.Vector3(0,0,0);state.lastSafe=new B.Vector3(0,0,42);
    createBlockers(scene);stairCollisionFix(scene);fixRails(scene);disableBuiltIns(helper);patchNavigation();controlsUI();
    state.xr.applyGravity=false;state.xr.checkCollisions=false;if(state.xr.cameraDirection)state.xr.cameraDirection.set(0,0,0);
    helper.baseExperience.onInitialXRPoseSetObservable.add(initialPose);
    helper.baseExperience.onStateChangedObservable.add(x=>{
      state.inXR=x===B.WebXRState.IN_XR;
      if(state.inXR){disableBuiltIns(helper);if(!state.poseReady)initialPose(state.xr);state.velocity.set(0,0,0);status('V277: botones XR activos, escaleras automáticas, joystick derecho arriba para brincar y abajo para recuperar un nivel.');}
      else if(x===B.WebXRState.NOT_IN_XR){state.poseReady=false;state.transition=null;state.run=false;state.jumping=false;state.jumpOffset=0;}
    });
    scene.onBeforeRenderObservable.add(update);
    window.__UCAN_XR_HELPER__=helper;
    window.__UCAN_QUEST_XR_AUDIT__={
      version:VERSION,build:BUILD,installed:true,directImmersiveNavigation:true,terraceButtonFixed:true,automaticEscalators:true,
      joystickJump:true,joystickVerticalRecovery:true,positionRollback:true,underStairBlockers:true,runEnabled:true,
      teleportTo,rollback:()=>state.previousSafe&&document.getElementById('ucanVrRecoveryBtn')?.click(),
      getState:()=>({inXR:state.inXR,poseReady:state.poseReady,floor:state.floor,ground:state.ground,cameraY:state.xr?.position?.y,transition:state.transition?{...state.transition}:null,running:state.run,jumping:state.jumping,speed:currentSpeed(),blockers:state.blockers.length})
    };
    return helper;
  }

  const original=B.Scene.prototype.createDefaultXRExperienceAsync;
  if(original.__ucanV277Patched)return;
  async function patched(options={}){
    const safe={...options,disableTeleportation:true,optionalFeatures:options.optionalFeatures??true,uiOptions:{...(options.uiOptions||{}),sessionMode:'immersive-vr',referenceSpaceType:'local-floor'}};
    delete safe.outputCanvasOptions;delete safe.ignoreNativeCameraTransformation;
    const helper=await original.call(this,safe);return install(this,helper);
  }
  patched.__ucanV277Patched=true;patched.__ucanOriginal=original;B.Scene.prototype.createDefaultXRExperienceAsync=patched;
  window.__UCAN_QUEST_XR_BOOT__={version:VERSION,build:BUILD,patched:true,terraceButtonFixed:true,automaticEscalators:true,joystickJump:true,joystickVerticalRecovery:true,positionRollback:true};
  console.info('[UCAN V277] Navegación XR, terraza, escaleras, salto y recuperación preparados.');
})();