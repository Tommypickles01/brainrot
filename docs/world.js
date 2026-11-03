import * as THREE from './vendor/three.module.js';
import {MAP,TILE,objects} from './core.mjs';
const V=(x,y,z)=>new THREE.Vector3(x,y,z);
export class World {
 constructor(canvas,state,rendererFactory){
  this.canvas=canvas;this.state=state;this.scene=new THREE.Scene();this.scene.background=new THREE.Color(0x171c0e);this.scene.fog=new THREE.FogExp2(0x171c0e,.028);
  this.renderer=rendererFactory?rendererFactory(canvas):new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.18;this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  this.camera=new THREE.PerspectiveCamera(64,1,.07,80);this.camera.rotation.order='YXZ';this.scene.add(this.camera);this.interactables=new Map();this.lamps=[];this.time=0;
  this.materials={wall:new THREE.MeshStandardMaterial({map:this.texture('wall'),roughness:.98}),floor:new THREE.MeshStandardMaterial({map:this.texture('floor'),roughness:1}),ceiling:new THREE.MeshStandardMaterial({map:this.texture('ceiling'),roughness:1}),trim:new THREE.MeshStandardMaterial({color:0x414631,roughness:.9}),metal:new THREE.MeshStandardMaterial({color:0x303a30,metalness:.42,roughness:.63}),black:new THREE.MeshStandardMaterial({color:0x090e0a,roughness:.75}),paper:new THREE.MeshStandardMaterial({color:0xc8c3a3,roughness:1}),light:new THREE.MeshBasicMaterial({color:0xd9edac}),acid:new THREE.MeshBasicMaterial({color:0xc4fd50}),pink:new THREE.MeshBasicMaterial({color:0xe977bd})};
  const ambient=new THREE.HemisphereLight(0xd4dbb0,0x303126,1.15);this.scene.add(ambient);this.ambient=ambient;
  this.flashlight=new THREE.SpotLight(0xe4edc3,25,21,.46,.66,1.4);this.flashlight.position.set(.12,-.12,0);this.flashlight.target.position.set(0,0,-6);this.camera.add(this.flashlight,this.flashlight.target);this.flashlight.castShadow=true;this.flashlight.shadow.mapSize.set(1024,1024);this.flashlight.shadow.bias=-.0004;this.flashlight.shadow.normalBias=.04;
  this.buildRooms();this.buildObjects();this.buildEntity();this.resize();
 }
 texture(kind){
  const c=document.createElement('canvas');c.width=c.height=256;const ctx=c.getContext('2d'),d=ctx.createImageData(256,256);let seed=1999;const rand=()=>{seed=(seed*16807)%2147483647;return(seed-1)/2147483646;};
  for(let y=0;y<256;y++)for(let x=0;x<256;x++){const i=(y*256+x)*4,n=(rand()-.5)*(kind==='floor'?37:14);let r,g,b;
   if(kind==='wall'){const stripe=x%32<2?-12:0,stain=Math.sin(x*.07)*Math.sin(y*.027)*5;r=151+n+stripe+stain;g=144+n+stripe+stain;b=94+n+stripe;}
   else if(kind==='floor'){r=79+n;g=78+n;b=51+n;}
   else{const seam=x<3||y<3?-22:0;r=148+n+seam;g=150+n+seam;b=126+n+seam;}
   d.data[i]=r;d.data[i+1]=g;d.data[i+2]=b;d.data[i+3]=255;
  }ctx.putImageData(d,0,0);
  if(kind==='wall'){ctx.strokeStyle='#4b5a2930';ctx.lineWidth=1;for(let y=14;y<256;y+=32)for(let x=16;x<256;x+=32){ctx.beginPath();ctx.moveTo(x,y-8);ctx.quadraticCurveTo(x+14,y,x,y+9);ctx.quadraticCurveTo(x-14,y,x,y-8);ctx.stroke();ctx.beginPath();ctx.moveTo(x-4,y);ctx.lineTo(x+4,y);ctx.stroke();}const grime=ctx.createLinearGradient(0,0,0,256);grime.addColorStop(0,'#151a1538');grime.addColorStop(.3,'transparent');grime.addColorStop(.8,'transparent');grime.addColorStop(1,'#1a231a4a');ctx.fillStyle=grime;ctx.fillRect(0,0,256,256);}
  const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;tex.wrapS=tex.wrapT=THREE.RepeatWrapping;tex.anisotropy=4;return tex;
 }
 box(w,h,d,mat,x=0,y=0,z=0,parent=this.scene){const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;}
 text(text,width=1.7,height=.32,color='#d7dfba',background='#222b1e'){
  const c=document.createElement('canvas');c.width=768;c.height=Math.round(768*height/width);const ctx=c.getContext('2d');ctx.fillStyle=background;ctx.fillRect(0,0,c.width,c.height);ctx.fillStyle=color;ctx.textAlign='center';ctx.textBaseline='middle';ctx.font=`bold ${Math.min(c.height*.49,70)}px monospace`;ctx.fillText(text,c.width/2,c.height/2,c.width-35);ctx.strokeStyle=color+'55';ctx.lineWidth=3;ctx.strokeRect(8,8,c.width-16,c.height-16);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return new THREE.Mesh(new THREE.PlaneGeometry(width,height),new THREE.MeshBasicMaterial({map:t,side:THREE.DoubleSide}));
 }
 sign(text,x,z,yaw,width=2,color='#d4dfb4',height=.32,y=2.35){const s=this.text(text,width,height,color);s.position.set(x,y,z);s.rotation.y=yaw;this.scene.add(s);return s;}
 buildRooms(){
  const floors=[],walls=[],ceilings=[],trims=[],fixtures=[];
  for(let z=0;z<MAP.length;z++)for(let x=0;x<MAP[0].length;x++){
   if(MAP[z][x]!=='0')continue;const wx=(x+.5)*TILE,wz=(z+.5)*TILE;floors.push([wx,-.08,wz]);ceilings.push([wx,3.44,wz]);
   for(const [dx,dz] of [[-1,0],[1,0],[0,-1],[0,1]])if(MAP[z+dz]?.[x+dx]!=='0'){walls.push({x:wx+dx*1.5,z:wz+dz*1.5,angle:dx?Math.PI/2:0});trims.push({x:wx+dx*1.48,z:wz+dz*1.48,angle:dx?Math.PI/2:0});}
   if((x+z)%3===0)fixtures.push([wx,3.36,wz]);
  }
  const matrix=new THREE.Matrix4(),dummy=new THREE.Object3D();
  const instance=(g,m,list,transform)=>{const inst=new THREE.InstancedMesh(g,m,list.length);inst.receiveShadow=true;inst.castShadow=true;list.forEach((p,i)=>{dummy.position.set(0,0,0);dummy.rotation.set(0,0,0);dummy.scale.set(1,1,1);transform(dummy,p);dummy.updateMatrix();inst.setMatrixAt(i,dummy.matrix);});this.scene.add(inst);return inst;};
  instance(new THREE.BoxGeometry(TILE,.15,TILE),this.materials.floor,floors,(d,p)=>d.position.set(...p));
  instance(new THREE.BoxGeometry(TILE,.12,TILE),this.materials.ceiling,ceilings,(d,p)=>d.position.set(...p));
  instance(new THREE.BoxGeometry(TILE,3.4,.15),this.materials.wall,walls,(d,p)=>{d.position.set(p.x,1.7,p.z);d.rotation.y=p.angle;});
  instance(new THREE.BoxGeometry(TILE,.16,.055),this.materials.trim,trims,(d,p)=>{d.position.set(p.x,.08,p.z);d.rotation.y=p.angle;});
  instance(new THREE.BoxGeometry(TILE,.045,.05),this.materials.trim,trims,(d,p)=>{d.position.set(p.x,3.27,p.z);d.rotation.y=p.angle;});
  instance(new THREE.BoxGeometry(1.46,.07,.58),this.materials.metal,fixtures,(d,p)=>d.position.set(...p));
  this.lightPanels=instance(new THREE.BoxGeometry(1.25,.025,.39),this.materials.light,fixtures,(d,p)=>d.position.set(p[0],p[1]-.055,p[2]));this.lightPanels.castShadow=false;
  for(const [x,z]of [[4.5,4.5],[16.5,7.5],[4.5,16.5],[22.5,19.5],[37.5,13.5],[19.5,28.5],[40.5,31.5],[46.5,40.5]]){const light=new THREE.PointLight(0xd7dca3,13,13,1.5);light.position.set(x,3,z);this.scene.add(light);this.lamps.push(light);}
  this.sign('MAINTENANCE →',7.2,3.1,0,2.3);this.sign('SERVICE / 01',3.13,14.2,Math.PI/2,1.7);this.sign('RADIO ↓',18.5,15.1,0,1.6,'#c4fd50');this.sign('ARCHIVE →',29.7,15.1,0,1.8);this.sign('SOUTH ACCESS ↓',40.88,21.2,-Math.PI/2,1.8);this.sign('EXIT',3.1,39.1,Math.PI/2,1.15,'#ff6861');this.sign('000',47.89,38.7,-Math.PI/2,1.1,'#e977bd');
  // Stray furniture and service details make the corridors feel occupied, then abandoned.
  for(const [x,z,a]of [[17,9,0],[31.2,10.1,.1],[29,30,1.5]]){const chair=new THREE.Group();chair.position.set(x,0,z);chair.rotation.y=a;this.scene.add(chair);this.box(.57,.09,.55,this.materials.metal,0,.52,0,chair);this.box(.57,.6,.09,this.materials.metal,0,.85,-.25,chair);for(const xx of[-.23,.23])for(const zz of[-.22,.22])this.box(.035,.51,.035,this.materials.black,xx,.25,zz,chair);}
  this.sign('DON’T FOLLOW THE RED SIGNS.',15,30.89,Math.PI,2.7,'#b8ba8c',.32,1.6);
 }
 buildObjects(){
  for(const item of objects(this.state)){
   const group=new THREE.Group();group.position.set(item.x,0,item.z);group.rotation.y=item.yaw;this.scene.add(group);this.interactables.set(item.id,group);
   const m=this.materials;
   if(item.id==='fuse'){
    this.box(.74,.92,.21,m.metal,0,1.4,0,group);this.box(.58,.7,.05,m.black,0,1.4,.13,group);const fuse=new THREE.Mesh(new THREE.CylinderGeometry(.065,.065,.34,16),new THREE.MeshStandardMaterial({color:0xc9dfaa,metalness:.6,roughness:.28}));fuse.position.set(0,1.4,.23);fuse.rotation.z=Math.PI/2;group.add(fuse);group.userData.fuse=fuse;for(const x of[-.17,.17])this.box(.08,.15,.13,m.paper,x,1.4,.23,group);const label=this.text('12V // RECOVER',.72,.17,'#c4fd50');label.position.set(0,1.95,.12);group.add(label);this.box(.06,.06,.05,m.acid,.25,1.65,.15,group);
   }else if(item.id==='breaker'){
    this.box(.98,1.35,.24,m.metal,0,1.4,0,group);this.box(.76,1.1,.04,m.black,0,1.4,.15,group);for(let i=0;i<3;i++){this.box(.38,.07,.08,m.paper,0,1.75-i*.24,.2,group);this.box(.08,.13,.1,m.metal,-.17,1.69-i*.24,.25,group);}group.userData.led=this.box(.09,.09,.04,m.pink,.26,1.85,.2,group);const sign=this.text('SERVICE / 01',.9,.18);sign.position.set(0,2.19,.1);group.add(sign);
   }else if(item.id==='radio'){
    this.box(1.2,.7,.55,m.metal,0,.92,0,group);this.box(1.08,.52,.035,m.black,0,.94,.3,group);const screen=this.text('88.0 MHz',.72,.22,'#c4fd50','#1a2a10');screen.position.set(-.1,1.05,.33);group.add(screen);for(let i=0;i<9;i++)this.box(.045,.17,.025,m.trim,-.45+i*.08,.79,.34,group);const knob=new THREE.Mesh(new THREE.CylinderGeometry(.11,.11,.07,24),m.paper);knob.rotation.x=Math.PI/2;knob.position.set(.44,1.05,.35);group.add(knob);this.box(.018,.85,.018,m.paper,.44,1.68,0,group);this.box(1.6,.08,.86,m.metal,0,.52,0,group);for(const x of[-.66,.66])this.box(.06,.52,.6,m.black,x,.25,0,group);const label=this.text('RECEIVER / 02',1.3,.2);label.position.set(0,2,.05);group.add(label);
   }else if(item.id==='disk'){
    this.box(1.6,.09,.6,m.metal,0,1.1,0,group);for(const x of[-.6,.6])this.box(.04,1.1,.44,m.black,x,.55,0,group);const disk=new THREE.Group();disk.position.set(0,1.3,.05);disk.rotation.x=-.3;this.box(.4,.42,.04,m.black,0,0,0,disk);this.box(.28,.12,.05,m.paper,0,.13,.008,disk);this.box(.27,.18,.05,m.pink,0,-.08,.013,disk);group.add(disk);group.userData.disk=disk;const sign=this.text('ARCHIVE / RECOVERED MEDIA',1.7,.18);sign.position.set(0,1.9,0);group.add(sign);
   }else if(item.id==='observer'){
    this.box(1.42,1.1,.45,m.metal,0,1.45,0,group);this.box(1.24,.93,.025,m.black,0,1.45,.24,group);const texture=new THREE.TextureLoader().load('assets/brainrot-still.png');texture.colorSpace=THREE.SRGBColorSpace;const screen=new THREE.Mesh(new THREE.PlaneGeometry(1.14,.84),new THREE.MeshBasicMaterial({map:texture}));screen.position.set(0,1.45,.26);group.add(screen);const sig=this.text('CAM 000 // TOMORROW',1.4,.16,'#c4fd50');sig.position.set(0,.79,.24);group.add(sig);this.box(.07,.04,.04,m.acid,.58,.98,.27,group);
   }else if(item.id==='note'){
    this.box(.57,.72,.025,m.paper,0,1.52,0,group);const note=this.text('THE MUSIC CHANGED.',.52,.17,'#303821','#c8c3a3');note.position.set(0,1.58,.02);group.add(note);const tape=new THREE.Mesh(new THREE.PlaneGeometry(.22,.06),new THREE.MeshBasicMaterial({color:0x8e9265}));tape.position.set(0,1.9,.02);group.add(tape);
   }else{
    const real=item.id==='door';this.box(1.9,2.98,.14,m.metal,0,1.49,0,group);const slab=this.box(1.65,2.79,.12,m.black,0,1.4,.13,group);group.userData.door=slab;this.box(.045,2.8,.045,real?m.pink:m.acid,-.84,1.4,.22,group);this.box(.045,2.8,.045,real?m.pink:m.acid,.84,1.4,.22,group);const title=this.text(real?'000':'EXIT',1.15,.3,real?'#e977bd':'#ff6861');title.position.set(0,2.2,.21);group.add(title);this.box(.12,.4,.08,m.paper,.57,1.25,.25,group);if(real){const keys=this.text('• • •',.36,.3,'#b6c89b','#111c0c');keys.position.set(.43,1.75,.21);group.add(keys);}else this.box(1.2,.07,.1,m.paper,0,1.2,.26,group);
   }
   const glow=new THREE.PointLight(item.id==='door'?0xe977bd:0xb6d778,1.3,3.6,1.6);glow.position.set(0,1.8,.6);group.add(glow);
  }
 }
 buildEntity(){const black=new THREE.MeshBasicMaterial({color:0x020402});this.entity=new THREE.Group();const head=new THREE.Mesh(new THREE.SphereGeometry(.18,14,10),black);head.position.set(0,2.35,0);head.scale.set(.8,1.25,.8);this.entity.add(head);this.box(.35,.92,.22,black,0,1.7,0,this.entity);for(const side of[-1,1]){this.box(.085,1.25,.09,black,.15*side,.64,0,this.entity);const arm=this.box(.065,1.3,.07,black,.29*side,1.32,0,this.entity);arm.rotation.z=-.07*side;}for(const x of[-.06,.06])this.box(.025,.018,.025,this.materials.acid,x,2.35,.15,this.entity);this.entity.visible=false;this.scene.add(this.entity);}
 entityAt(x,z,time){this.entity.position.set(x,0,z);this.entity.lookAt(this.state.player.x,0,this.state.player.z);this.entity.visible=true;this.entityUntil=time+1.8;}
 resize(){const w=this.canvas.clientWidth,h=this.canvas.clientHeight;this.renderer.setSize(w,h,false);this.camera.aspect=w/h;this.camera.fov=w<h?76:64;this.camera.updateProjectionMatrix();}
 render(player,time,opts={}){
  this.time=time;const bob=opts.moving&&!opts.lowMotion?Math.sin(time*9)*.022:0;this.camera.position.set(player.x,1.64+bob,player.z);this.camera.rotation.y=Math.PI+player.yaw;this.camera.rotation.x=player.pitch||0;
  this.flashlight.intensity=opts.dark?4:25;this.ambient.intensity=opts.dark?.12:(this.state.power?1.35:1.05);this.materials.light.color.setHex(opts.dark?0x29301a:0xd9edac);
  this.lamps.forEach((l,i)=>{l.intensity=opts.dark?.15:(this.state.power?17:12)*(1+(opts.lowMotion?0:Math.sin(time*.31+i)*.045));});
  const f=this.interactables.get('fuse');if(f)f.userData.fuse.visible=!this.state.fuse;const d=this.interactables.get('disk');if(d)d.userData.disk.visible=!this.state.disk;const breaker=this.interactables.get('breaker');if(breaker)breaker.userData.led.material=this.state.power?this.materials.acid:this.materials.pink;
  if(this.entityUntil&&time>this.entityUntil)this.entity.visible=false;
  if(opts.escape){const door=this.interactables.get('door');door.userData.door.position.x=Math.min(1.75,opts.escape*.7);}
  this.renderer.render(this.scene,this.camera);
 }
}
