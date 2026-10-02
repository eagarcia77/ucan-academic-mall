(() => {
  'use strict';
  const VERSION='V330';
  const BUILD='V330-20261002-XR-IMMERSIVE-STABILITY-R39';
  const state={installed:false,frames:0,heightRepairs:0,visualRepairs:0,rigRepairs:0,lastIssue:null,lastRepairAt:0};
  const finite=v=>Number.isFinite(Number(v));
  const authority=()=>window.__UCAN_XR_FINAL_AUTHORITY_V328__||null;
  const helper=()=>window.__UCAN_XR_HELPER__||null;
  const scene=()=>window.__UCAN_API__?.getScene?.()||null;
  const desktop=()=>window.__UCAN_API__?.getCamera?.()||null;

  function repairVisuals(){
    const s=scene(); if(!s)return;
    let changed=0;
    for(const [key,value] of [['lightsEnabled',true],['texturesEnabled',true],['shadowsEnabled',true],['particlesEnabled',true]]){
      if(s[key]===false){s[key]=value;changed++;}
    }
    const image=s.imageProcessingConfiguration;
    if(image&&(!finite(image.exposure)||image.exposure<0.35)){image.exposure=0.82;changed++;}
    if(image&&(!finite(image.contrast)||image.contrast<0.5)){image.contrast=1.18;changed++;}
    for(const material of s.materials||[]){
      if(!material||material.alpha>=0.999||material.alpha==null)continue;
      if(material.needDepthPrePass===true){material.needDepthPrePass=false;changed++;}
      if(material.disableDepthWrite!==true){material.disableDepthWrite=true;changed++;}
      if(window.BABYLON?.Material?.MATERIAL_ALPHABLEND!=null&&material.transparencyMode!==window.BABYLON.Material.MATERIAL_ALPHABLEND){
        material.transparencyMode=window.BABYLON.Material.MATERIAL_ALPHABLEND;changed++;
      }
    }
    if(changed)state.visualRepairs+=changed;
  }

  function repairRig(){
    const h=helper(), d=desktop(); if(!h||!d)return;
    const xr=h.baseExperience?.camera; if(!xr)return;
    let changed=0;
    const cameras=[xr,...(xr.rigCameras||[])];
    for(const camera of cameras){
      if(!camera)continue;
      if(d.layerMask!=null&&camera.layerMask!==d.layerMask){camera.layerMask=d.layerMask;changed++;}
      const desiredMin=Math.max(0.04,Math.min(Number(d.minZ||0.06),0.12));
      if(!finite(camera.minZ)||Math.abs(camera.minZ-desiredMin)>0.02){camera.minZ=desiredMin;changed++;}
      const desiredMax=Math.max(Number(d.maxZ||0),1800);
      if(!finite(camera.maxZ)||camera.maxZ<desiredMax){camera.maxZ=desiredMax;changed++;}
    }
    if(changed)state.rigRepairs+=changed;
  }

  function repairHeight(){
    const a=authority(); if(!a?.installed||!a.inXR)return;
    const st=a.getState?.()||a;
    if(st.activeRide||st.jumping)return;
    const floor=Number(st.stableFloor), y=Number(st.world?.y);
    if(!finite(floor)||!finite(y))return;
    const eye=y-floor;
    // Valid seated/standing Quest eye range. Outside this range means the rig
    // or a legacy observer displaced the user vertically.
    if(eye>=0.75&&eye<=2.35)return;
    const now=performance.now();
    if(now-state.lastRepairAt<1200)return;
    state.lastRepairAt=now;
    state.lastIssue={type:'eye-height',eye,floor,y,at:new Date().toISOString()};
    a.forceFloor?.(floor);
    a.recalibrate?.();
    state.heightRepairs++;
  }

  function tick(){
    const a=authority(); if(!a?.installed)return;
    state.frames++;
    if(a.inXR){
      repairRig();
      repairVisuals();
      repairHeight();
    }
    window.__UCAN_XR_STABILITY_V330__={
      version:VERSION,build:BUILD,installed:true,
      finalAuthorityRevision:a.revision||a.getState?.().revision||'R39',
      poseCalibratedAfterInXR:true,stereoVisualParityGuard:true,
      transparentMaterialQuestFix:true,betweenFloorRecovery:true,
      getState:()=>({...state,authority:a.getState?.()||null})
    };
  }

  function install(){
    if(state.installed)return true;
    const s=scene(); if(!s||!window.BABYLON)return false;
    state.installed=true;
    s.onBeforeRenderObservable.add(()=>{if((state.frames%15)===0)tick();else state.frames++;});
    repairVisuals();
    window.setInterval(()=>{try{tick();}catch(error){state.lastIssue={type:'guard',message:String(error?.message||error)}}},750);
    console.info('[UCAN V330] Guard de estabilidad XR inmersiva instalado.');
    tick();
    return true;
  }
  let attempts=0;
  const timer=setInterval(()=>{attempts++;if(install()||attempts>600)clearInterval(timer);},100);
})();