'use strict';
const fs=require('fs');
const vm=require('vm');
class Observable{constructor(){this.handlers=[];}add(fn){this.handlers.push(fn);return fn;}notify(value){for(const fn of this.handlers)fn(value);}}
class Vector3{constructor(x=0,y=0,z=0){this.x=x;this.y=y;this.z=z;}asArray(){return [this.x,this.y,this.z];}}
const frameObs=new Observable();
const scene={meshes:[],activeCamera:{position:new Vector3(0,1.7,42)},onBeforeRenderObservable:frameObs,getEngine:()=>({getDeltaTime:()=>16})};
let capturedOptions=null;
const helper={
  __ucanQuestLocomotionInstalled:false,
  input:{},
  baseExperience:{
    camera:{position:new Vector3(0,0,42),cameraDirection:new Vector3(),speed:0,ellipsoid:null,ellipsoidOffset:null},
    featuresManager:{disableFeature(){},enableFeature(name,version,options){this.enabled={name,version,options};return {name,options};}},
    onStateChangedObservable:new Observable()
  }
};
class Scene{constructor(){this.meshes=[];this.activeCamera={position:new Vector3(0,1.7,42)};this.onBeforeRenderObservable=frameObs;}getEngine(){return {getDeltaTime:()=>16};}}
Scene.prototype.createDefaultXRExperienceAsync=async function(options){capturedOptions=options;return helper;};
const context={
  console,
  performance:{now:()=>1000},
  window:null,
  document:{getElementById:()=>null},
  BABYLON:{Scene,Vector3,WebXRState:{IN_XR:2,NOT_IN_XR:0},WebXRFeatureName:{TELEPORTATION:'teleport',MOVEMENT:'move'},WebXRControllerComponent:{THUMBSTICK_TYPE:'thumbstick',TOUCHPAD_TYPE:'touchpad'}}
};
context.window=context;
vm.createContext(context);
vm.runInContext(fs.readFileSync('public/js/ucan_v268_quest_locomotion.js','utf8'),context);
(async()=>{
  const instance=new context.BABYLON.Scene();
  const result=await instance.createDefaultXRExperienceAsync({disableTeleportation:false});
  if(result!==helper)throw new Error('No devolvió el helper XR.');
  if(capturedOptions.disableTeleportation!==true)throw new Error('No desactivó teleportación conflictiva.');
  if(!helper.baseExperience.featuresManager.enabled)throw new Error('No activó locomoción.');
  helper.baseExperience.onStateChangedObservable.notify(context.BABYLON.WebXRState.IN_XR);
  helper.baseExperience.camera.position.x=-20;
  helper.baseExperience.camera.position.z=21;
  helper.baseExperience.camera.position.y=0;
  frameObs.notify();
  if(helper.baseExperience.camera.position.y<=0)throw new Error('No ajustó la altura de la escalera.');
  const audit=context.window.__UCAN_QUEST_XR_AUDIT__;
  if(!audit?.standardQuestMapping||!audit?.smoothStairHeight)throw new Error('Auditoría XR incompleta.');
  console.log(JSON.stringify({passed:true,capturedOptions,audit:{installed:audit.installed,leftStick:audit.leftStick,rightStick:audit.rightStick,movementFeatureEnabled:audit.movementFeatureEnabled},stairY:helper.baseExperience.camera.position.y},null,2));
})().catch(error=>{console.error(error);process.exit(1);});
