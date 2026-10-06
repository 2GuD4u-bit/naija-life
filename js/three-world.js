let THREE=null;

const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const color=(v,alt='#b78f68')=>{try{return new THREE.Color(v||alt)}catch{return new THREE.Color(alt)}};

export async function createCity3D(G,diagnostic=()=>{}){
 diagnostic('three-world-initializing',{module:import.meta.url});
 diagnostic('three-import-start',{module:'./vendor/three.module.js'});
 THREE=await import('./vendor/three.module.js?v=20261006-three-renderer-r2');
 diagnostic('three-import-ready',{revision:THREE.REVISION});
 const source=document.getElementById('world');
 if(!source||!source.parentNode)throw new Error('The game world canvas is missing or is detached from the page.');
 const probe=document.createElement('canvas'),webgl2=probe.getContext('webgl2'),webgl1=webgl2?null:(probe.getContext('webgl')||probe.getContext('experimental-webgl'));
 if(!webgl2&&!webgl1)throw new Error('This browser did not provide a WebGL 2 or WebGL 1 context.');
 diagnostic('webgl-capability-ready',{webgl2:!!webgl2,webgl1:!!webgl1});
 const canvas=document.createElement('canvas');canvas.className='world-webgl-canvas';canvas.setAttribute('aria-hidden','true');
 source.parentNode.insertBefore(canvas,source.nextSibling);
 diagnostic('canvas-inserted',{connected:canvas.isConnected});
 let renderer;
 try{diagnostic('renderer-create-start',{revision:THREE.REVISION});renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:true,powerPreference:'high-performance'});diagnostic('renderer-created',{context:renderer.getContext().constructor?.name||'WebGL'});}catch(error){canvas.remove();error.naija3dStage='WebGL renderer creation';throw error}
 renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5));renderer.setSize(innerWidth,innerHeight,false);
 renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;
 diagnostic('scene-create-start');const scene=new THREE.Scene();scene.background=new THREE.Color('#a8c7ad');diagnostic('scene-created');
 scene.fog=new THREE.Fog('#a8c7ad',800,3300);
 scene.add(new THREE.HemisphereLight('#e4f2ff','#75664e',2.15));
 const sun=new THREE.DirectionalLight('#fff0d2',3.2);sun.position.set(-500,900,350);scene.add(sun);
 const camera=new THREE.OrthographicCamera(-10,10,10,-10,.1,9000);diagnostic('camera-created');
 camera.up.set(0,1,0);
 const materialCache=new Map(),geometryCache=new Map(),planeCache=new Map(),labelCache=new Map(),textures=[],customMaterials=[],sharedGeometry=new WeakSet(),chunks=new Map(),chunkSize=G.world.mapMeta.chunkSize||800;
 const mats={
  road:mat('#3c4852',.94),roadEdge:mat('#cbbb9d',.85),line:mat('#e2ca7d',.78),
  grass:mat('#9fbd8d',1),park:mat('#8aaf7e',1),concrete:mat('#c8c2b2',.95),
  soil:mat('#ae946b',1),trunk:mat('#72513a',1),leaf:mat('#277850',1),leaf2:mat('#328658',1),
  glass:mat('#83c5d5',.28,.12),roof:mat('#76533f',1),dark:mat('#242a30',.86),
  white:mat('#e8e2d4',.82),metal:mat('#59616a',.72)
 };
 function mat(hex,rough=.82,metalness=0){const k=hex+rough+metalness;if(!materialCache.has(k))materialCache.set(k,new THREE.MeshStandardMaterial({color:hex,roughness:rough,metalness}));return materialCache.get(k)}
 function grainTexture(seed){const c=document.createElement('canvas');c.width=c.height=128;const q=c.getContext('2d'),r=seeded(seed);q.fillStyle='#deded8';q.fillRect(0,0,128,128);for(let i=0;i<3000;i++){const v=Math.floor(112+r()*64);q.fillStyle=`rgba(${v},${v},${v},${.04+r()*.12})`;q.fillRect(r()*128,r()*128,1+r()*2,1+r()*2)}const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(1,1);t.anisotropy=renderer.capabilities.getMaxAnisotropy();textures.push(t);return t}
 mats.road.map=grainTexture(31);mats.road.needsUpdate=true;mats.concrete.map=grainTexture(61);mats.concrete.needsUpdate=true;mats.soil.map=grainTexture(91);mats.soil.needsUpdate=true;
 function boxGeometry(x,y,z){const k=x+':'+y+':'+z;if(!geometryCache.has(k)){const geometry=new THREE.BoxGeometry(x,y,z);geometryCache.set(k,geometry);sharedGeometry.add(geometry)}return geometryCache.get(k)}
 const wheelGeometry=new THREE.CylinderGeometry(.38,.38,.2,10),personBodyGeometry=new THREE.CapsuleGeometry(.34,.65,3,6),personHeadGeometry=new THREE.SphereGeometry(.27,8,6);sharedGeometry.add(wheelGeometry);sharedGeometry.add(personBodyGeometry);sharedGeometry.add(personHeadGeometry);
 function box(parent,x,y,z,w,h,d,m){const o=new THREE.Mesh(boxGeometry(w,h,d),m);o.position.set(x,y+h/2,z);o.castShadow=false;o.receiveShadow=true;parent.add(o);return o}
 function flat(parent,x,y,z,w,d,m){return box(parent,x,y,z,w,.22,d,m)}
 function rect(parent,x,z,w,d,m){const k=w+':'+d;if(!planeCache.has(k)){const geometry=new THREE.PlaneGeometry(w,d);planeCache.set(k,geometry);sharedGeometry.add(geometry)}const o=new THREE.Mesh(planeCache.get(k),m);o.rotation.x=-Math.PI/2;o.position.set(x,terrainY(x,z)+.16,z);parent.add(o);return o}
 function seeded(seed){let n=(seed|0)+0x6d2b79f5;return()=>{n=Math.imul(n^(n>>>15),n|1);n^=n+Math.imul(n^(n>>>7),n|61);return((n^(n>>>14))>>>0)/4294967296}}
 function label(text,bg='#f8f8f4',fg='#172333',size=18){const k=[text,bg,fg,size].join('|');if(!labelCache.has(k)){const c=document.createElement('canvas');c.width=512;c.height=96;const q=c.getContext('2d');q.fillStyle=bg;q.beginPath();q.roundRect(6,8,500,80,38);q.fill();q.font=`700 ${size}px system-ui, sans-serif`;q.fillStyle=fg;q.textAlign='center';q.textBaseline='middle';q.fillText(text.slice(0,42),256,48,468);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;labelCache.set(k,t)}const s=new THREE.Sprite(new THREE.SpriteMaterial({map:labelCache.get(k),transparent:true,depthTest:false}));s.scale.set(Math.min(92,Math.max(32,text.length*1.4)),17,1);s.renderOrder=5;return s}
 function terrainY(x,z){return G.world.heightAt?G.world.heightAt(x,z):0}
 function buildingModel(b,lod){const g=new THREE.Group(),w=Math.max(12,b.w||36),d=Math.max(12,b.h||30),floorsByType={market:1,restaurant:2,mall:2,office:3,bank:3,government:3,hospital:3,hotel:4,apartment:4,university:3,police:2,mosque:1,church:2,gym:2,mechanic:1,club:2,waterfront:1,bus:1,railway:2,airport:2},floorsTarget=floorsByType[b.type]||2,heightByAsset={'fuel-station':8,'bus-terminal':9,'railway-station':11,airport:16,'national-mosque':22,'national-church':24,'shopping-mall':15,'central-bank':25},baseHeight=heightByAsset[b.asset]||Math.max(5.2,Math.min(32,floorsTarget*3.8)),height=lod===0?baseHeight:lod===1?Math.max(5,Math.min(24,baseHeight*.78)):Math.max(4.5,Math.min(16,baseHeight*.52));
  const base=color(b.color),glass=mat('#8cc6d1',.26,.06),trim=mat('#e2d6bb',.72),accent=mat(b.type==='government'||b.type==='bank'?'#bda264':b.type==='hospital'?'#f0eee5':'#b27750',.75);
  flat(g,0,0,0,w+9,d+9,trim);box(g,0,.2,0,w,height,d,base);
  const floors=lod===0?floorsTarget:Math.max(1,Math.round(height/4.3)),floorH=height/floors;
  if(lod<2){
   for(let f=0;f<floors;f++){
    const yy=.3+f*floorH;
    box(g,0,yy,0,w+.5,.36,d+.5,trim);
    for(let side of [-1,1])for(let xx=-w/2+3;xx<w/2-2;xx+=Math.max(5,w/8))box(g,xx,yy+.75,side*(d/2+.15),Math.min(3.8,w/9),Math.min(2.6,floorH*.5),.18,glass);
    for(let side of [-1,1])for(let zz=-d/2+3;zz<d/2-2;zz+=Math.max(5,d/7))box(g,side*(w/2+.15),yy+.75,zz,.18,Math.min(2.6,floorH*.5),Math.min(3.8,d/8),glass);
   }
   box(g,0,height+.2,0,w+1,.5,d+1,trim);
   // Full-size entry doors, a small landing, and category-specific street frontage.
   box(g,0,.25,-d/2-.26,Math.min(2.2,w*.14),2.35,.42,mat('#35444a'));
   for(const side of [-1,1])box(g,side*Math.min(1.45,w*.085),.3,-d/2-.31,.16,2.5,.18,trim);
   flat(g,0,.12,-d/2-1.25,Math.min(w*.46,14),2.1,mat('#d1c4a8'));
   if(['market','restaurant','club','hotel'].includes(b.type)){
    const awning=mat(b.type==='restaurant'?'#b66043':'#b78a45');box(g,0,3.05,-d/2-1.1,Math.min(w*.82,24),.3,3.4,awning);
    for(let x=-Math.min(w*.38,10);x<=Math.min(w*.38,10);x+=2.8)box(g,x,2.83,-d/2-1.1,.12,.16,3.35,trim);
   }
   if(['office','bank','government','hospital','university'].includes(b.type)){
    const count=Math.max(2,Math.min(6,Math.floor(w/16)));for(let i=0;i<count;i++){const x=-w*.38+i*(w*.76/(count-1));box(g,x,.28,-d/2-1.45,.65,Math.min(5.4,height*.62),.65,trim)}
    box(g,0,Math.min(5.8,height*.62),-d/2-1.45,w*.82,.42,2.9,accent);
   }
   if(b.type==='bank'||b.type==='government'||b.asset==='central-bank'){
    for(let xx=-w*.32;xx<w*.34;xx+=w*.32)box(g,xx,.3,-d/2-1.3,1.5,height*.82,1.2,trim);
    box(g,0,height+1.1,-d*.48,w*.7,1.1,.6,accent);
   }
   if(b.asset==='national-mosque'){
    const dome=new THREE.Mesh(new THREE.SphereGeometry(Math.min(w,d)*.18,12,8,0,Math.PI*2,0,Math.PI/2),mat('#d5b254',.52,.12));dome.position.set(0,height+1,0);g.add(dome);
    for(const xx of [-w*.3,w*.3]){box(g,xx,.2,-d*.42,2,height+Math.min(w,d)*.2,2,trim);box(g,xx,height+2,-d*.42,3,1,3,accent)}
   }
   if(b.type==='hospital'){box(g,0,height*.57,-d/2-1.5,Math.min(14,w*.35),3,.5,mat('#f4f2ec'));box(g,0,height*.57,-d/2-1.78,1.1,2.3,.12,mat('#c84745'));box(g,0,height*.57,-d/2-1.8,3.2,.8,.12,mat('#c84745'))}
   if(b.asset==='fuel-station'){
    box(g,0,height*.52,0,w*.72,1.2,d*.62,mat('#f1ede4'));
    for(const x of [-w*.26,w*.26])for(const z of [-d*.22,d*.22])box(g,x,0,z,1.15,height*.47,1.15,trim);
    for(const x of [-w*.25,0,w*.25]){box(g,x,.2,-d*.04,2,1.9,2,mat('#e3e1d8'));box(g,x,.2+d*.03,-d*.04,.6,1.2,.45,mat('#bf4c43'))}
   }
   if(b.asset==='bus-terminal'||b.asset==='railway-station'){
    for(let x=-w*.38;x<w*.4;x+=w*.25){box(g,x,.3,-d*.37,1.2,height*.62,1.2,trim);box(g,x,.3,d*.37,1.2,height*.62,1.2,trim)}
    box(g,0,height*.63,0,w+.5,.9,d*.9,roof);
    for(let z=-d*.18;z<d*.2;z+=5)box(g,0,.3,z,w*.72,.32,.3,mat('#d8d7ce'));
   }
   if(b.asset==='airport'){
    box(g,0,height*.45,d*.18,w*.82,1.3,d*.18,trim);
    box(g,0,height*.6,d*.18,w*.75,Math.max(2,height*.18),d*.17,glass);
    box(g,w*.4,height*.8,-d*.24,8,10,8,mat('#bcc2bf'));
    box(g,w*.4,height*.95,-d*.24,10,1,10,glass);
   }
  }else{box(g,0,height+.35,0,w+2,.7,d+2,trim)}
  let roof=b.type==='mosque'||b.asset==='national-mosque'?mat('#4d6470',.55):b.type==='church'||b.asset==='national-church'?mat('#4f5964',.75):['market','restaurant','club'].includes(b.type)?mat('#96583f',.76):mat('#52606a',.72);
  box(g,0,height,0,w+2,.45,d+2,roof);
  if(b.type==='church'||b.asset==='national-church'){
   const sp=new THREE.Mesh(new THREE.ConeGeometry(Math.min(w,d)*.42,Math.min(w,d)*.32,4),accent);sp.position.set(0,height+Math.min(w,d)*.16,0);sp.rotation.y=Math.PI/4;g.add(sp);
   for(const x of [-w*.32,w*.32]){box(g,x,height*.72,-d*.28,Math.max(2,w*.055),height*.64,Math.max(2,d*.08),base);const steeple=new THREE.Mesh(new THREE.ConeGeometry(3.1,7,4),roof);steeple.position.set(x,height+height*.32,-d*.28);steeple.rotation.y=Math.PI/4;g.add(steeple)}
  }
  const sign=label(b.name);sign.position.set(0,height+Math.min(28,height*.48)+14,-d/2-1);g.add(sign);
  if(b.asset==='airport'){
   const aircraft=new THREE.Group();aircraft.position.set(w*.62,0,d*.12);box(aircraft,0,4,0,15,1.3,2,mat('#e6e3d8'));box(aircraft,1,4,0,5,1.1,7,mat('#d8d9d6'));box(aircraft,0,4,-5,3,.6,10,mat('#f4f2eb'));box(aircraft,-6,4,0,2,.7,4,mat('#f4f2eb'));g.add(aircraft);
  }
  return g;
 }
 function carModel(parent,x,z,tint,kind='sedan',large=false,local=false){const g=new THREE.Group();g.position.set(x,local?0:terrainY(x,z),z);const bus=kind==='bus'||kind==='minibus',w=bus?2.5:kind==='suv'?2.05:1.9,l=bus?7:kind==='suv'?4.8:4.4,h=bus?2.75:kind==='suv'?1.9:1.45,paint=mat(tint||'#263544',.35,.38);box(g,0,.12,0,l*.91,h*.62,w,paint);box(g,-l*.055,.12+h*.49,0,l*.46,h*.43,w*.86,mat('#8ec2ce',.23,.08));box(g,l*.37,.18,0,l*.16,.2,w*.92,mat('#faf0d3',.35,.25));for(const xx of [-l*.32,l*.32])for(const zz of [-w*.55,w*.55]){const wheel=new THREE.Mesh(wheelGeometry,mats.dark);wheel.rotation.z=Math.PI/2;wheel.position.set(xx,.35,zz);g.add(wheel)}parent.add(g);return g}
 function treeBatch(group,cx,cz,seed,count=24){const rand=seeded(seed),trunkG=new THREE.CylinderGeometry(.45,.6,5,5),leafG=new THREE.ConeGeometry(3.6,7,6),trunks=new THREE.InstancedMesh(trunkG,mats.trunk,count),leaves=new THREE.InstancedMesh(leafG,mats.leaf,count),dummy=new THREE.Object3D();let n=0,tries=0;while(n<count&&tries<count*8){tries++;let x=cx+30+rand()*(chunkSize-60),z=cz+30+rand()*(chunkSize-60);if(G.world.roadX.some(rx=>Math.abs(x-rx)<35)||G.world.roadY.some(ry=>Math.abs(z-ry)<35))continue;if(G.world.buildings.some(b=>x>b.x-24&&x<b.x+b.w+24&&z>b.y-24&&z<b.y+b.h+24))continue;dummy.position.set(x,terrainY(x,z)+2.5,z);dummy.scale.setScalar(.7+rand()*.7);dummy.updateMatrix();trunks.setMatrixAt(n,dummy.matrix);dummy.position.y+=5;dummy.scale.multiplyScalar(1.3);dummy.updateMatrix();leaves.setMatrixAt(n,dummy.matrix);n++}trunks.count=n;leaves.count=n;group.add(trunks,leaves)}
 function terrainStrip(parent,axis,pos,start,end,width,material,lift=.05){const steps=Math.max(1,Math.ceil((end-start)/72)),vertices=[],uvs=[],indices=[];for(let i=0;i<=steps;i++){const t=i/steps,v=start+(end-start)*t;for(const side of [-1,1]){const half=width/2*side,x=axis==='x'?pos+half:v,z=axis==='x'?v:pos+half;vertices.push(x,terrainY(x,z)+lift,z);uvs.push(x/8,z/8)}}for(let i=0;i<steps;i++){const a=i*2,b=a+1,c=a+2,d=a+3;if(axis==='x')indices.push(a,c,b,b,c,d);else indices.push(a,b,c,b,d,c)}const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geo.setIndex(indices);geo.computeVertexNormals();const mesh=new THREE.Mesh(geo,material);mesh.receiveShadow=true;parent.add(mesh);return mesh}
 function pathSurface(parent,a,b,width,material,lift=.12){const dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz),steps=Math.max(1,Math.ceil(len/64)),nx=dz/len,nz=-dx/len,vertices=[],uvs=[],indices=[];for(let i=0;i<=steps;i++){const t=i/steps,x=a[0]+dx*t,z=a[1]+dz*t;for(const side of [-1,1]){const px=x+nx*width*.5*side,pz=z+nz*width*.5*side;vertices.push(px,terrainY(px,pz)+lift,pz);uvs.push(px/8,pz/8)}}for(let i=0;i<steps;i++){const k=i*2;indices.push(k,k+2,k+1,k+1,k+2,k+3)}const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geo.setIndex(indices);geo.computeVertexNormals();const mesh=new THREE.Mesh(geo,material);mesh.receiveShadow=true;parent.add(mesh);return mesh}
 function roadWidth(axis,index){return axis==='x'?(index%5===0?30:index%2===0?20:13):(index%4===0?30:index%2===0?20:13)}
 function drawRoads(g,cx,cz){const minX=cx,maxX=cx+chunkSize,minZ=cz,maxZ=cz+chunkSize,marks=Math.ceil(chunkSize/30),dummy=new THREE.Object3D(),poles=[],heads=[];
  const addLine=(mesh,axis,pos,along)=>{const x=axis==='x'?pos:along,z=axis==='x'?along:pos;dummy.position.set(x,terrainY(x,z)+.25,z);dummy.updateMatrix();mesh.setMatrixAt(mesh.count++,dummy.matrix)};
  for(let i=0;i<(G.world.roadX||[]).length;i++){const x=G.world.roadX[i],width=roadWidth('x',i);if(x<minX-22||x>maxX+22)continue;terrainStrip(g,'x',x,cz,cz+chunkSize,width+5,mat('#bbb49f'),.04);terrainStrip(g,'x',x,cz,cz+chunkSize,width,mat('#3c4852',.94),.12);for(const side of [-1,1]){terrainStrip(g,'x',x+side*(width/2+1.1),cz,cz+chunkSize,.38,mat('#a7a092'),.16);terrainStrip(g,'x',x+side*(width/2+3.05),cz,cz+chunkSize,3.1,mat('#c8c2b2',.95),.18)}
   const center=new THREE.InstancedMesh(boxGeometry(.3,.12,11),mats.line,marks),lane=width>=20?new THREE.InstancedMesh(boxGeometry(.16,.08,7),mat('#e5e3d8'),marks*2):null;center.count=0;if(lane)lane.count=0;for(let z=cz+15;z<maxZ;z+=30){addLine(center,'x',x,z);if(lane){addLine(lane,'x',x-width*.23,z+4);addLine(lane,'x',x+width*.23,z+4)}}g.add(center);if(lane)g.add(lane);
   for(let z=cz+112;z<maxZ;z+=224){const side=(Math.floor(z/224)%2?1:-1),lampX=x+side*(width/2+4.5);dummy.position.set(lampX,terrainY(lampX,z)+3,z);dummy.updateMatrix();poles.push(dummy.matrix.clone());dummy.position.set(lampX-side*1.45,terrainY(lampX,z)+6,z);dummy.updateMatrix();heads.push(dummy.matrix.clone())}}
  for(let i=0;i<(G.world.roadY||[]).length;i++){const z=G.world.roadY[i],width=roadWidth('y',i);if(z<minZ-22||z>maxZ+22)continue;terrainStrip(g,'y',z,cx,cx+chunkSize,width+5,mat('#bbb49f'),.04);terrainStrip(g,'y',z,cx,cx+chunkSize,width,mat('#3c4852',.94),.12);for(const side of [-1,1]){terrainStrip(g,'y',z+side*(width/2+1.1),cx,cx+chunkSize,.38,mat('#a7a092'),.16);terrainStrip(g,'y',z+side*(width/2+3.05),cx,cx+chunkSize,3.1,mat('#c8c2b2',.95),.18)}
   const center=new THREE.InstancedMesh(boxGeometry(11,.12,.3),mats.line,marks),lane=width>=20?new THREE.InstancedMesh(boxGeometry(7,.08,.16),mat('#e5e3d8'),marks*2):null;center.count=0;if(lane)lane.count=0;for(let x=cx+15;x<maxX;x+=30){addLine(center,'y',z,x);if(lane){addLine(lane,'y',z+width*.23,x+4);addLine(lane,'y',z-width*.23,x+4)}}g.add(center);if(lane)g.add(lane);
   for(let x=cx+112;x<maxX;x+=224){const side=(Math.floor(x/224)%2?1:-1),lampZ=z+side*(width/2+4.5);dummy.position.set(x,terrainY(x,lampZ)+3,lampZ);dummy.updateMatrix();poles.push(dummy.matrix.clone());dummy.position.set(x,terrainY(x,lampZ)+6,lampZ-side*1.45);dummy.updateMatrix();heads.push(dummy.matrix.clone())}}
  const zebraX=new Map(),zebraY=new Map();for(let i=0;i<(G.world.roadX||[]).length;i++){const x=G.world.roadX[i],wx=roadWidth('x',i);if(x<minX||x>maxX)continue;for(let j=0;j<(G.world.roadY||[]).length;j++){const z=G.world.roadY[j],wz=roadWidth('y',j);if(z<minZ||z>maxZ)continue;const add=(map,key,px,pz)=>{if(!map.has(key))map.set(key,[]);dummy.position.set(px,terrainY(px,pz)+.21,pz);dummy.updateMatrix();map.get(key).push(dummy.matrix.clone())};for(const sign of [-1,1])for(let k=0;k<5;k++){add(zebraX,wx,x,z+sign*(wz/2+1.1+k*1.25));add(zebraY,wz,x+sign*(wx/2+1.1+k*1.25),z)}}}
  for(const[width,matrices]of zebraX){const mesh=new THREE.InstancedMesh(boxGeometry(Math.max(3,width-1),.08,.48),mat('#e5e3d8'),matrices.length);matrices.forEach((m,i)=>mesh.setMatrixAt(i,m));g.add(mesh)}for(const[width,matrices]of zebraY){const mesh=new THREE.InstancedMesh(boxGeometry(.48,.08,Math.max(3,width-1)),mat('#e5e3d8'),matrices.length);matrices.forEach((m,i)=>mesh.setMatrixAt(i,m));g.add(mesh)}
  if(poles.length){const poleMat=mat('#4e5655',.7,.35),lampMat=mat('#ffe0a4',.34,.15);lampMat.emissive=new THREE.Color('#8b6025');lampMat.emissiveIntensity=.42;const pm=new THREE.InstancedMesh(boxGeometry(.18,6,.18),poleMat,poles.length),hm=new THREE.InstancedMesh(boxGeometry(1.4,.22,.55),lampMat,heads.length);poles.forEach((m,i)=>pm.setMatrixAt(i,m));heads.forEach((m,i)=>hm.setMatrixAt(i,m));g.add(pm,hm)}
  const pathDashes=[];for(const path of G.world.roadPaths||[]){for(let i=1;i<path.points.length;i++){const a=path.points[i-1],b=path.points[i],len=Math.hypot(b[0]-a[0],b[1]-a[1]),steps=Math.max(1,Math.ceil(len/220)),nx=(b[1]-a[1])/len,nz=-(b[0]-a[0])/len;for(let j=0;j<steps;j++){const t0=j/steps,t1=(j+1)/steps,mid=(t0+t1)/2,mx=a[0]+(b[0]-a[0])*mid,mz=a[1]+(b[1]-a[1])*mid;if(mx<minX-25||mx>maxX+25||mz<minZ-25||mz>maxZ+25)continue;const p0=[a[0]+(b[0]-a[0])*t0,a[1]+(b[1]-a[1])*t0],p1=[a[0]+(b[0]-a[0])*t1,a[1]+(b[1]-a[1])*t1];pathSurface(g,p0,p1,path.width+5,mat('#bbb49f'),.04);pathSurface(g,p0,p1,path.width,mat('#3c4852',.94),.12);for(let along=15;along<len/steps;along+=30){const q=(t0*len+along)/len,x=a[0]+(b[0]-a[0])*q,z=a[1]+(b[1]-a[1])*q;dummy.position.set(x,terrainY(x,z)+.25,z);dummy.rotation.y=-Math.atan2(b[1]-a[1],b[0]-a[0]);dummy.updateMatrix();pathDashes.push(dummy.matrix.clone())}}}}
  if(pathDashes.length){const mesh=new THREE.InstancedMesh(boxGeometry(11,.12,.32),mats.line,pathDashes.length);pathDashes.forEach((m,i)=>mesh.setMatrixAt(i,m));g.add(mesh)}
 }
 function makeHouse(h){const g=new THREE.Group(),w=h.w,d=h.h,base=mat(h.style==='garden-estate'?'#d3bd98':'#c6b18e'),wall=mat(h.style==='garden-estate'?'#e2d6c4':'#d6c4a7'),roof=mat(h.style==='garden-estate'?'#975d44':'#755044'),window=mat('#7faebb',.24,.08);flat(g,0,0,0,w+7,d+8,mats.concrete);box(g,0,.25,0,w,3.4,d,wall);
  const v=[-w/2,3.55,-d/2,w/2,3.55,-d/2,0,6.6,-d/2,-w/2,3.55,d/2,w/2,3.55,d/2,0,6.6,d/2],geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(v,3));geo.setIndex([0,1,2,3,5,4,0,3,4,0,4,1,1,4,5,1,5,2,2,5,3,2,3,0]);geo.computeVertexNormals();g.add(new THREE.Mesh(geo,roof));
  for(const side of [-1,1])for(const x of [-w*.32,w*.32])box(g,x,1.15,side*(d/2+.12),Math.min(4,w*.22),1.35,.18,window);
  for(const x of [-w*.42,w*.42])box(g,x,1.15,-d/2-.12,Math.min(3.4,w*.18),1.35,.18,window);
  box(g,0,.25,-d/2-.25,Math.max(2.2,w*.12),2.25,.38,mat('#604b3c'));flat(g,0,.12,-d/2-2,Math.min(w*.56,15),3.8,mat('#cfc6b6'));
  box(g,0,.2,d/2+1.3,w+4,.42,.35,base);box(g,-w/2-1,.2,0,.35,.42,d+3,base);box(g,w/2+1,.2,0,.35,.42,d+3,base);
  for(const x of [-w*.42,w*.42]){box(g,x,1.3,d/2+1.3,.25,2.2,.25,base);box(g,x,1.5,d/2+2.7,2.1,.12,2.7,roof)}
  return g}
 function addHomes(group,homes){if(!homes.length)return;const bodies=new THREE.InstancedMesh(boxGeometry(23.5,3.4,18.5),mat('#ffffff'),homes.length),roofs=new THREE.InstancedMesh(boxGeometry(24.5,.5,19.5),mat('#ffffff'),homes.length),items=[],dummy=new THREE.Object3D();bodies.castShadow=false;roofs.castShadow=false;
  homes.forEach((h,i)=>{const x=h.x+h.w/2,z=h.y+h.h/2,ground=terrainY(x,z);dummy.position.set(x,ground+1.95,z);dummy.scale.set(h.w/23.5,1,h.h/18.5);dummy.updateMatrix();bodies.setMatrixAt(i,dummy.matrix);dummy.position.y=ground+3.9;dummy.updateMatrix();roofs.setMatrixAt(i,dummy.matrix);bodies.setColorAt(i,color(h.style==='garden-estate'?'#e3d5bd':'#d3bea0'));roofs.setColorAt(i,color(h.style==='garden-estate'?'#905642':'#8b5140'));items.push({h,x,z,ground,detail:null,parent:group,near:false,index:i})});group.add(bodies,roofs);group.userData.homeLOD={bodies,roofs,items};}
 function dummyHome(item,bodies,roofs){const d=new THREE.Object3D(),scale=item.near?0:1;d.position.set(item.x,item.ground+1.95,item.z);d.scale.set(item.h.w/23.5*scale,scale,item.h.h/18.5*scale);d.updateMatrix();bodies.setMatrixAt(item.index,d.matrix);d.position.y=item.ground+3.9;d.updateMatrix();roofs.setMatrixAt(item.index,d.matrix)}
 function constructionSite(group,b){const lotW=188,lotD=152,site=new THREE.Group();site.position.set(b.x+b.w/2,terrainY(b.x,b.y),b.y+b.h/2);flat(site,0,.1,0,lotW,lotD,mat('#b58e5e'));flat(site,0,.32,0,lotW-12,lotD-12,mat('#c3a06a'));
  const fence=mat('#175968');for(const z of [-lotD/2+4,lotD/2-4])for(let x=-lotW/2+4;x<=lotW/2-4;x+=8){if(z>0&&Math.abs(x)<18)continue;box(site,x,.35,z,.65,2.4,.65,fence)}
  for(const x of [-lotW/2+4,lotW/2-4])for(let z=-lotD/2+4;z<=lotD/2-4;z+=8)box(site,x,.35,z,.65,2.4,.65,fence);
  for(const z of [-lotD/2+4,lotD/2-4]){const gap=z>0?18:0,start=-lotW/2+7,end=lotW/2-7;for(const x=start;x<end;x+=8){if(z>0&&x>=-gap&&x<=gap)continue;box(site,x+4,1,z,8,.18,.28,mat('#3c7881'));box(site,x+4,1.8,z,8,.16,.28,mat('#568a89'))}}
  for(const x of [-lotW/2+4,lotW/2-4])for(const z of [-lotD/2+8,0,lotD/2-8]){box(site,x,2.8,z,1,3,1,mat('#c7b087'));const lamp=new THREE.PointLight('#ffe2a7',18,20);lamp.position.set(x,6,z);site.add(lamp)}
  const bw=78,bd=58,floor=4.1;flat(site,0,.55,0,bw+7,bd+7,mat('#777a74'));
  for(let level=0;level<5;level++){
   const y=.8+level*floor;flat(site,0,y,0,bw,bd,mat(level===4?'#858981':'#969a92'));
   for(const x of [-bw/2+2,bw/2-2])for(const z of [-bd/2+2,bd/2-2])box(site,x,y,z,1.15,floor,.95,mat('#b2b2a8'));
   for(const x of [-bw/2+2,0,bw/2-2])for(const z of [-bd/2+2,bd/2-2])box(site,x,y,z,.95,floor,.95,mat('#aaa99f'));
   if(level===1||level===2){box(site,-bw*.29,y+1,-bd/2, bw*.37,2,1.1,mat('#768780'));box(site,bw*.3,y+1,bd*.18,bw*.3,2,1.1,mat('#667b82'))}
  }
  const scaffold=mat('#b36636');for(const z of [-bd/2-3,bd/2+3])for(let x=-bw/2-4;x<=bw/2+4;x+=7){box(site,x,.8,z,.3,18,.3,scaffold);for(let y=4;y<18;y+=4)box(site,x,y,z,6,.22,.22,scaffold)}
  for(let y=4;y<20;y+=4)for(let x=-bw/2-4;x<bw/2+4;x+=14)box(site,x+7,y,-bd/2-3,13,.18,.18,scaffold);
  for(const x of [-bw*.32,-bw*.04,bw*.3])for(let i=0;i<3;i++){box(site,x+i*.75,20,bd*.24,.16,3,.16,mat('#776c59'));box(site,x-.5,22,bd*.24,1.3,.16,.16,mat('#776c59'))}
  // A 50 m tower crane with lattice jib, hoist cable, operator cab and hook.
  const craneX=-lotW*.31,craneZ=-lotD*.18,crane=mat('#d2a12e');for(const x of [-1.3,1.3])for(const z of [-1.3,1.3])box(site,craneX+x,.4,craneZ+z,.28,48,.28,crane);
  for(let y=3;y<48;y+=4){for(const z of [-1.3,1.3]){const brace=box(site,craneX,y,z,2.1,.2,.2,crane);brace.rotation.z=.63;const other=box(site,craneX,y+1.7,z,2.1,.2,.2,crane);other.rotation.z=-.63}}
  box(site,craneX,48,craneZ,5,1,4,mat('#8a692f'));box(site,craneX,49,craneZ,6,1.1,5,mat('#9bb4b7'));
  for(const x of [-43,43])box(site,craneX+x,50,craneZ,1,1,1,crane);for(let x=-42;x<44;x+=7){box(site,craneX+x,51,craneZ,7,.4,.36,crane);const diagonal=box(site,craneX+x+3.5,51,craneZ,7,.22,.22,crane);diagonal.rotation.z=x%14?-.5:.5}
  box(site,craneX-27,50,craneZ,18,1,2.5,crane);box(site,craneX-27,51,craneZ,1,.4,3,crane);
  const cable=box(site,craneX+20,29,craneZ,.12,21,.12,mat('#343a39'));box(site,craneX+20,18,craneZ,.5,1.5,.5,mat('#232829'));
  // Rebar cage, site hoist, concrete mixer and stacked materials.
  for(let i=0;i<9;i++)box(site,-26+i*6,.9,bd*.37,4,1.5,3,mat(i%2?'#9a704c':'#bd9568'));
  for(const x of [-35,35])for(const z of [-20,0,20]){box(site,x,.8,z,1,7,1,mat('#6d5140'));box(site,x,4.5,z,3,.35,3,mat('#b48a57'))}
  carModel(site,-61,.0,'#c24d3f','bus');const tag=label('BUILDING SITE · UNDER CONSTRUCTION','#f4ead8','#37362f',15);tag.scale.set(58,11,1);tag.position.set(0,6,lotD/2+5);site.add(tag);group.add(site);return site;
 }
 function estateEntrance(group,b){const g=new THREE.Group(),w=42,d=22;g.position.set(b.x+b.w/2,terrainY(b.x,b.y),b.y+b.h/2);flat(g,0,.1,0,w,d,mats.concrete);box(g,-13,.2,0,4,6,5,mat('#b7a07a'));box(g,13,.2,0,4,6,5,mat('#b7a07a'));box(g,0,6,0,30,1,5,mat('#eee8d9'));box(g,0,6,-1,24,2,.6,mat('#263541'));const sign=label(b.name.toUpperCase(),'#202832','#f7edcf',16);sign.scale.set(29,6,1);sign.position.set(0,8,-3);g.add(sign);box(g,0,.3,8,2,2.5,2,mat('#d1c3a8'));const arm=box(g,0,2,3,13,.35,.45,mat('#f0ead9'));arm.rotation.y=.12;g.add(arm);group.add(g)}
 function parkAsset(group,b){const g=new THREE.Group(),w=b.w+85,d=b.h+75;g.position.set(b.x+b.w/2,terrainY(b.x,b.y),b.y+b.h/2);flat(g,0,.1,0,w,d,mat('#7fa976'));flat(g,0,.26,0,w-16,d-16,mat('#a9bf8f'));for(let x=-w*.36;x<w*.4;x+=w*.24)rect(g,x,0,4,d*.76,mat('#d3c7a6'));const water=new THREE.Mesh(new THREE.CylinderGeometry(7,7,.5,18),mat('#5caec1',.22));water.position.set(0,.6,0);g.add(water);const fountain=new THREE.Mesh(new THREE.CylinderGeometry(1.2,1.2,3,10),mat('#d3d1c6'));fountain.position.set(0,2,0);g.add(fountain);const labelMesh=label(b.name);labelMesh.position.set(0,14,-d*.48);g.add(labelMesh);group.add(g)}
 function rockFormation(group,b){const cx=b.x+b.w/2,cz=b.y+b.h/2,random=seeded(5400),segments=12,levels=[0,27,92,177,258,315],radii=[148,142,119,91,53,15],vertices=[],indices=[],geometry=new THREE.BufferGeometry();for(let k=0;k<levels.length;k++){for(let i=0;i<segments;i++){const a=i/segments*Math.PI*2,jitter=.84+random()*.32,x=cx+Math.cos(a)*radii[k]*jitter,z=cz+Math.sin(a)*radii[k]*.76*jitter;vertices.push(x,terrainY(x,z)+levels[k],z)}}for(let k=0;k<levels.length-1;k++)for(let i=0;i<segments;i++){const a=k*segments+i,b0=k*segments+(i+1)%segments,c=(k+1)*segments+i,d=(k+1)*segments+(i+1)%segments;indices.push(a,c,b0,b0,c,d)}geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setIndex(indices);geometry.computeVertexNormals();const tones=[mat('#514f48',.98),mat('#615d54',.96),mat('#716b5f',.95),mat('#4c514c',.98),mat('#837969',.94)];for(let k=0;k<levels.length-1;k++)geometry.addGroup(k*segments*6,segments*6,k%tones.length);group.add(new THREE.Mesh(geometry,tones));
  const boulderGeo=new THREE.DodecahedronGeometry(12,0),boulders=new THREE.InstancedMesh(boulderGeo,tones[0],18),dummy=new THREE.Object3D();for(let i=0;i<18;i++){const a=random()*Math.PI*2,r=95+random()*70,x=cx+Math.cos(a)*r,z=cz+Math.sin(a)*r*.76;dummy.position.set(x,terrainY(x,z)+7+random()*6,z);dummy.rotation.set(random()*.25,random()*6.28,random()*.25);dummy.scale.set(.8+random()*1.4,.75+random()*1.6,.7+random()*1.3);dummy.updateMatrix();boulders.setMatrixAt(i,dummy.matrix)}group.add(boulders);
  const path=rect(group,cx,cz+139,b.w*.72,4,mat('#c2a980'));path.rotation.y=-.18;const plaque=label('ASO ROCK  ·  ABUJA','#303432','#f5eddd',20);plaque.scale.set(45,9,1);plaque.position.set(cx,terrainY(cx,cz)+91,cz-b.h*.44);group.add(plaque)}
 function showroomModel(){const g=new THREE.Group(),w=G.world.carDealership.showroom.w,d=G.world.carDealership.showroom.d,h=13.2,charcoal=mat('#22272b',.34,.34),black=mat('#171b1f',.36,.28),glass=new THREE.MeshStandardMaterial({color:'#c1e3e7',roughness:.18,metalness:.06,transparent:true,opacity:.4,depthWrite:false}),stone=mat('#c5baa6',.82),metal=mat('#50575b',.46,.52);customMaterials.push(glass);
  flat(g,0,.05,0,w+8,d+8,stone);box(g,0,.35,d/2-1,w,h-1.2,2.6,charcoal);box(g,-w/2+1,.3,0,2,h,d,charcoal);box(g,w/2-1,.3,0,2,h,d,charcoal);
  for(let floor=0;floor<2;floor++){const y=.65+floor*5.4;box(g,0,y,-d/2+.24,w-4,4.3,.48,glass);box(g,0,y+4.42,-d/2+.15,w+1,.46,.64,metal);for(let x=-w/2+4;x<w/2-2;x+=7.4)box(g,x,y,-d/2-.15,.38,4.45,.4,black);box(g,0,y+2.1,-d/2-.18,w-3,.22,.26,metal)}
  for(let x of [-w/2+2,w/2-2])box(g,x,.35,-d/2-1.1,1,10.2,1.05,stone);
  box(g,0,11.1,-d/2,w+4,.5,d+2,charcoal);box(g,0,12.7,0,w+5,.55,d+3,black);box(g,0,13.25,0,w+1,.35,d+1,metal);
  box(g,0,.35,-d/2-.75,8,2.5,.3,glass);box(g,0,.35,-d/2-2,28,.42,8,charcoal);for(const x of [-13,-6,6,13])box(g,x,.45,-d/2-2,.24,3.6,.24,metal);
  const reception=box(g,0,.55,d*.15,w*.28,.85,2.1,stone);reception.material=mat('#d0c6b3');
  for(let x=-w*.31;x<w*.34;x+=w*.31){const car=carModel(g,x,-d*.16,x<0?'#151a20':x>0?'#b8bec0':'#a83b34',x===0?'sport':'suv',false,true);car.rotation.y=x===0?.2:-.12}
  const sign=label('ABUJACAR  ·  CAR DEALERSHIP','#171b20','#fff5df',28);sign.scale.set(61,11,1);sign.position.set(0,10.1,-d/2-.7);g.add(sign);
  return g}
 function dealership(group,b){const root=new THREE.Group(),lot=G.world.carDealership.lot;root.position.set(lot.x+lot.w/2,terrainY(lot.x+lot.w/2,lot.y+lot.h/2),lot.y+lot.h/2);root.rotation.y=Number(b.rotation)||0;root.scale.setScalar(Number(b.scale)||1);
  flat(root,0,.1,0,lot.w,lot.h,mat('#42494d'));flat(root,0,.34,0,lot.w-8,lot.h-8,mat('#686967'));flat(root,0,.38,lot.h/2+10,lot.w-12,25,mat('#777a76'));
  const fence=mat('#202a2e',.58,.36),post=mat('#a99d86');for(let i=0;i<4;i++){const side=i<2?'z':'x',sgn=i%2?1:-1,alongX=side==='z',length=alongX?lot.w:lot.h;for(let p=-length/2+4;p<length/2-4;p+=7){const fx=alongX?p:sgn*(lot.w/2-3),fz=alongX?sgn*(lot.h/2-3):p;if(alongX&&sgn<0&&Math.abs(fx)<lot.gateWidth/2+2)continue;box(root,fx,.4,fz,.55,2.4,.55,fence);if(p+7>=length/2-4)break}const railCount=Math.ceil(length/5);for(let j=0;j<railCount;j++){const p=-length/2+2+j*5,fx=alongX?p:sgn*(lot.w/2-3),fz=alongX?sgn*(lot.h/2-3):p;if(alongX&&sgn<0&&Math.abs(fx)<lot.gateWidth/2+2)continue;box(root,fx,1.1,fz,alongX?5:.18,.16,alongX?.18:5,fence);box(root,fx,2,fz,alongX?5:.16,.14,alongX?.16:5,fence)} }
  const showroom=G.world.carDealership.showroom,model=showroomModel();model.position.set(showroom.x-lot.x-lot.w/2,.42,showroom.y-lot.y-lot.h/2);root.add(model);
  const sb=G.world.carDealership.workshop,sx=sb.x-lot.x-lot.w/2,sz=sb.y-lot.y-lot.h/2;box(root,sx,.4,sz,24,8,38,mat('#373e41'));box(root,sx,.5,sz-19.4,18,5,1.1,mat('#697276'));for(const x of [sx-7,sx+7])box(root,x,.45,sz-20.2,.35,5.6,.35,post);const workSign=label('SERVICE BAY','#263239','#efe9db',15);workSign.scale.set(20,4,1);workSign.position.set(sx,7,sz-20.7);root.add(workSign);
  const boothX=-lot.w/2+10,boothZ=-lot.h/2+13;box(root,boothX,.4,boothZ,8,3.2,7,mat('#d2c6b1'));box(root,boothX,.9,boothZ-3.58,5.6,1.5,.18,mat('#8ec2ce',.23,.08));box(root,0,.7,-lot.h/2+3,14,.42,1,mat('#f0dfad'));box(root,0,2.2,-lot.h/2+4.2,16,.2,.2,mat('#242a2b'));
  const cars=G.world.carDealership.cars||[];cars.forEach((c,i)=>{const px=c.x-lot.x-lot.w/2,pz=c.y-lot.y-lot.h/2;carModel(root,px,pz,c.color,c.kind,false,true);if(!c.interior){const yellow=mat('#e5b347');for(const side of [-1,1])box(root,px+side*4.6,.39,pz, .12,.045,8,yellow);if(i<2)box(root,px,.39,pz+4,.12,.045,8,yellow)}});
  for(const x of [-48,0,48]){const z=lot.h*.19;for(const dx of [-16,16])box(root,x+dx,.36,z,.24,.06,38,mat('#565e61'));for(const dz of [-14,14])box(root,x,.36,z+dz,30,.06,.24,mat('#565e61'));box(root,x,.4,z+31,25,.08,10,mat('#68645b'));for(const dx of [-16,16])for(const dz of [-13,13])box(root,x+dx,.38,z+dz,.2,5.9,.2,mat('#50575b',.46,.52));box(root,x,6.5,z,35,.5,31,mat('#737a7b',.48,.3));box(root,x,6.08,z,35,.16,31,mat('#484f53',.62,.35))}
  for(const x of [-lot.w/2+17,lot.w/2-17]){for(const z of [-lot.h/2+12,lot.h/2-12]){box(root,x,.3,z,2.5,5,2.5,mat('#283238'));const lamp=new THREE.PointLight('#ffd38a',22,42);lamp.position.set(x,7,z);root.add(lamp)}}
  for(let i=0;i<10;i++){const x=-lot.w/2+14+i*27,z=i%2?-lot.h/2+12:lot.h/2-12;box(root,x,.32,z,.7,7,.7,mats.trunk);for(let arm=0;arm<5;arm++){const leaf=new THREE.Mesh(new THREE.ConeGeometry(1.15,7,5),mats.leaf2);leaf.position.set(x+Math.cos(arm*Math.PI*2/5)*3,7.6+Math.sin(arm*Math.PI*2/5)*1.2,z+Math.sin(arm*Math.PI*2/5)*3);leaf.rotation.z=.8;leaf.rotation.x=.5;root.add(leaf)}}
  root.userData.type='dealer';group.add(root);return root;
 }
 function architecturalAsset(parent,b){const lod=new THREE.LOD();lod.addLevel(buildingModel(b,0),0);lod.addLevel(buildingModel(b,1),500);lod.addLevel(buildingModel(b,2),1350);lod.position.set(b.x+b.w/2,terrainY(b.x,b.y),b.y+b.h/2);lod.rotation.y=Number(b.rotation)||0;lod.scale.setScalar(Number(b.scale)||1);parent.add(lod);parent.userData.buildingLods.push(lod);return lod}
 diagnostic('procedural-world-build-start',{buildings:G.world.buildings?.length||0,chunkSize});
 G.world.assetBuilders=G.world.assetBuilders||Object.create(null);
 G.world.registerAssetBuilder=function(name,builder){if(typeof name!=='string'||!name||typeof builder!=='function')throw new TypeError('Asset builders need a name and a builder function.');G.world.assetBuilders[name]=builder;return builder};
 G.world.registerAssetBuilder('architecture',architecturalAsset);
 G.world.registerAssetBuilder('dealership',dealership);
 G.world.registerAssetBuilder('construction-site',constructionSite);
 G.world.registerAssetBuilder('estate-gate',estateEntrance);
 G.world.registerAssetBuilder('park',parkAsset);
 G.world.registerAssetBuilder('landmark-rock-formation',rockFormation);
 for(const name of ['civic-bank','mosque','church','retail-complex','transport-terminal','airport-terminal'])G.world.registerAssetBuilder(name,architecturalAsset);
 function terrainChunk(g,cx,cz){const side=9,step=chunkSize/side,vertices=[],indices=[];for(let j=0;j<=side;j++)for(let i=0;i<=side;i++){const x=cx+i*step,z=cz+j*step;vertices.push(x,terrainY(x,z),z)}for(let j=0;j<side;j++)for(let i=0;i<side;i++){const a=j*(side+1)+i,b=a+1,c=a+side+1,d=c+1;indices.push(a,c,b,b,c,d)}const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geo.setIndex(indices);geo.computeVertexNormals();const mesh=new THREE.Mesh(geo,mats.grass);mesh.receiveShadow=true;g.add(mesh)}
 function makeChunk(cx,cz){const key=`${cx/chunkSize}:${cz/chunkSize}`,g=new THREE.Group();g.userData.key=key;g.userData.buildingLods=[];
  terrainChunk(g,cx,cz);
  // Abuja's planned districts use distinct green-space tones and keep future parcels legible.
  for(const district of G.world.districts||[]){const r=district.bounds;if(r.x>=cx+chunkSize||r.x+r.w<=cx||r.y>=cz+chunkSize||r.y+r.h<=cz)continue;if(district.style.includes('estate')||district.style.includes('residential')){const ix=Math.max(cx,r.x),iz=Math.max(cz,r.y),ax=Math.min(cx+chunkSize,r.x+r.w),az=Math.min(cz+chunkSize,r.y+r.h);rect(g,(ix+ax)/2,(iz+az)/2,ax-ix,az-iz,mat(district.style==='low-rise-estate'?'#a8c495':'#9dbb8e'))}}
  for(const p of G.world.futurePlots||[]){if(p.x>cx+chunkSize||p.x+p.w<cx||p.y>cz+chunkSize||p.y+p.h<cz)continue;rect(g,p.x+p.w/2,p.y+p.h/2,p.w,p.h,mats.soil);for(let x=p.x+20;x<p.x+p.w;x+=24){flat(g,x,terrainY(x,p.y)+.3,p.y,1,p.h,mat('#bd9c66'))}}
  drawRoads(g,cx,cz);
  if(cx<8900&&cx+chunkSize>7400&&cz<6530&&cz+chunkSize>6290){const left=Math.max(cx,7400),right=Math.min(cx+chunkSize,8900);rect(g,(left+right)/2,6405,right-left,84,mat('#424c53'));for(let x=left+15;x<right;x+=48)flat(g,x,terrainY(x,6405)+.2,6405,20,.45,mats.white)}
  for(const estate of G.world.residentialEstates||[]){if(estate.x>cx+chunkSize||estate.x+estate.w<cx||estate.y>cz+chunkSize||estate.y+estate.h<cz)continue;rect(g,estate.x+estate.w/2,estate.y+estate.h/2,estate.w,estate.h,mat('#a2bd92'));const roads=[estate.x+estate.w*.5,estate.x+estate.w*.25,estate.x+estate.w*.75];for(const x of roads)rect(g,x,estate.y+estate.h/2,7,estate.h,mat('#637077'));}
  for(const lake of G.world.lakes||[]){if(lake.x>cx+chunkSize||lake.x+lake.w<cx||lake.y>cz+chunkSize||lake.y+lake.h<cz)continue;const water=mat('#58a9c7',.22,.08),edge=mat('#cbbd9b',.9);rect(g,lake.x+lake.w/2,lake.y+lake.h/2,lake.w,lake.h,water);rect(g,lake.x+lake.w/2,lake.y-4,lake.w+8,8,edge);rect(g,lake.x+lake.w/2,lake.y+lake.h+4,lake.w+8,8,edge);rect(g,lake.x-4,lake.y+lake.h/2,8,lake.h+8,edge);rect(g,lake.x+lake.w+4,lake.y+lake.h/2,8,lake.h+8,edge)}
  for(const b of G.world.buildings||[]){if(b.x>cx+chunkSize||b.x+b.w<cx||b.y>cz+chunkSize||b.y+b.h<cz)continue;const builderName=G.world.assetManifest?.[b.asset]?.builder,builder=G.world.assetBuilders?.[builderName]||G.world.assetBuilders?.[b.asset]||G.world.assetBuilders?.architecture;if(builder){builder(g,b,{THREE,mat,box,flat,rect,label,terrainY,buildingModel});continue}architecturalAsset(g,b)}
  const homes=(G.world.houseLots||[]).filter(home=>home.x<cx+chunkSize&&home.x+home.w>cx&&home.y<cz+chunkSize&&home.y+home.h>cz);addHomes(g,homes);
  treeBatch(g,cx,cz,(cx*31+cz*17)|0,Math.max(8,Math.floor(chunkSize/22)));
  scene.add(g);chunks.set(key,g);return g;
 }
 function discardChunk(key){const g=chunks.get(key);if(!g)return;scene.remove(g);g.traverse(o=>{if(o.geometry&&!sharedGeometry.has(o.geometry))o.geometry.dispose();if(o.isSprite&&o.material)o.material.dispose()});chunks.delete(key)}
 function refreshLocation(location,previous){for(const item of [previous,location]){if(!item)continue;const bounds=item.assetBounds||item,x0=Math.max(0,Math.floor(bounds.x/chunkSize)*chunkSize),y0=Math.max(0,Math.floor(bounds.y/chunkSize)*chunkSize),x1=Math.min(G.W,Math.floor((bounds.x+(bounds.w||1))/chunkSize)*chunkSize),y1=Math.min(G.H,Math.floor((bounds.y+(bounds.h||1))/chunkSize)*chunkSize);for(let x=x0;x<=x1;x+=chunkSize)for(let y=y0;y<=y1;y+=chunkSize)discardChunk(String(x/chunkSize)+':'+String(y/chunkSize))}}
 const people=new Map(),vehicles=new Map(),playerFigure=person();scene.add(playerFigure);
 function person(){const g=new THREE.Group();const skin=mat('#70462f'),shirt=mat('#198a67'),pants=mat('#17243a');const torso=new THREE.Mesh(personBodyGeometry,shirt);torso.position.y=1.05;g.add(torso);const head=new THREE.Mesh(personHeadGeometry,skin);head.position.y=1.8;g.add(head);box(g,-.22,.04,0,.28,.12,.32,pants);box(g,.22,.04,0,.28,.12,.32,pants);return g}
 function syncActors(){const actors=G.world.npcs||[],activeIds=new Set(actors.map(n=>n.id));for(const n of actors){let o=people.get(n.id);if(!o){o=person();scene.add(o);people.set(n.id,o)}o.position.set(n.x,terrainY(n.x,n.y),n.y);o.visible=true}
  for(const [id,o]of people)if(!activeIds.has(id)){scene.remove(o);people.delete(id)}
  for(const c of G.world.cars||[]){if(!c.id&&!c.owned&&!c.taxi&&!c.bus)continue;const id=c.id||c.name||'player-car';let o=vehicles.get(id);if(!o){o=carModel(scene,c.x,c.y,c.color,c.kind);vehicles.set(id,o)}o.position.set(c.x,terrainY(c.x,c.y),c.y)}
 }
 let visible=true,lastSync=0,firstRendered=false;
 function resize(){renderer.setSize(innerWidth,innerHeight,false);camera.left=-innerWidth/2;camera.right=innerWidth/2;camera.top=innerHeight/2;camera.bottom=-innerHeight/2;camera.updateProjectionMatrix()}
 addEventListener('resize',resize);resize();
 function render(){if(!visible)return;const s=G.state;if(!s)return;const scale=(G.view.scale||1)*1.047;
  const panX=G.view.panX||0,panY=G.view.panY||0;
  const targetX=clamp(s.x-(panX/.74+panY/.38)/(2*(G.view.scale||1)),0,G.W),targetZ=clamp(s.y-(panY/.38-panX/.74)/(2*(G.view.scale||1)),0,G.H);
  const viewHeight=innerHeight/scale;camera.left=-innerWidth/(2*scale);camera.right=innerWidth/(2*scale);camera.top=viewHeight/2;camera.bottom=-viewHeight/2;
  const elev=Math.asin(.514),horizontal=Math.max(viewHeight,innerWidth/scale)*1.25;
  camera.position.set(targetX+Math.cos(Math.PI/4)*horizontal,terrainY(targetX,targetZ)+Math.tan(elev)*horizontal,targetZ+Math.sin(Math.PI/4)*horizontal);
  camera.lookAt(targetX,terrainY(targetX,targetZ),targetZ);camera.updateProjectionMatrix();camera.updateMatrixWorld();
  const r=Math.max(chunkSize*1.75,(innerWidth/(1.48*scale)+innerHeight/(.76*scale))/2+chunkSize*.5),minX=Math.max(0,Math.floor((targetX-r)/chunkSize)*chunkSize),maxX=Math.min(G.W,Math.ceil((targetX+r)/chunkSize)*chunkSize),minZ=Math.max(0,Math.floor((targetZ-r)/chunkSize)*chunkSize),maxZ=Math.min(G.H,Math.ceil((targetZ+r)/chunkSize)*chunkSize),needed=new Set();
  for(let x=minX;x<maxX;x+=chunkSize)for(let z=minZ;z<maxZ;z+=chunkSize)needed.add(String(x/chunkSize)+':'+String(z/chunkSize));
  const queued=[...needed].filter(k=>!chunks.has(k)).sort((a,b)=>{const[ax,az]=a.split(':').map(Number),[bx,bz]=b.split(':').map(Number);return Math.hypot((ax+.5)*chunkSize-targetX,(az+.5)*chunkSize-targetZ)-Math.hypot((bx+.5)*chunkSize-targetX,(bz+.5)*chunkSize-targetZ)});
  for(const key of queued.slice(0,3)){const[x,z]=key.split(':').map(Number);makeChunk(x*chunkSize,z*chunkSize)}
  for(const key of chunks.keys())if(!needed.has(key))discardChunk(key);
  const lodCamera={position:new THREE.Vector3(targetX,terrainY(targetX,targetZ),targetZ)};
  for(const g of chunks.values()){for(const lod of g.userData.buildingLods||[])lod.update(lodCamera);const homes=g.userData.homeLOD;if(!homes)continue;let changed=false;for(const item of homes.items){const near=Math.hypot(item.x-targetX,item.z-targetZ)<260;if(near===item.near)continue;item.near=near;if(near){const detail=makeHouse(item.h);detail.position.set(item.x,item.ground,item.z);item.parent.add(detail);item.detail=detail}else if(item.detail){item.parent.remove(item.detail);item.detail.traverse(o=>{if(o.geometry&&!sharedGeometry.has(o.geometry))o.geometry.dispose()});item.detail=null}dummyHome(item,homes.bodies,homes.roofs);changed=true}if(changed){homes.bodies.instanceMatrix.needsUpdate=true;homes.roofs.instanceMatrix.needsUpdate=true}}
  if(performance.now()-lastSync>400){syncActors();lastSync=performance.now()}
  const player=s.vehicle?vehicles.get(s.vehicle.id||s.vehicle.name):null;
  if(player){player.position.set(s.x,terrainY(s.x,s.y),s.y);player.rotation.y=-(s.angle||0);player.visible=true;playerFigure.visible=false}else{playerFigure.position.set(s.x,terrainY(s.x,s.y),s.y);playerFigure.rotation.y=-(s.angle||0);playerFigure.visible=true}
  renderer.render(scene,camera);if(!firstRendered){firstRendered=true;diagnostic('first-render-complete',{drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,chunks:chunks.size})}
 }
 const api={ready:true,renderer,scene,camera,chunks,get stats(){return{chunks:chunks.size,buildings:G.world.buildings.length,houseLots:G.world.houseLots.length,drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles}},render,refreshLocation,setVisible(v){visible=!!v;canvas.style.display=v?'block':'none'},dispose(){removeEventListener('resize',resize);for(const key of chunks.keys())discardChunk(key);renderer.dispose();materialCache.forEach(m=>m.dispose());customMaterials.forEach(m=>m.dispose());labelCache.forEach(t=>t.dispose());textures.forEach(t=>t.dispose());canvas.remove()}};
 G.world.threeWorld=api;
 diagnostic('three-world-initialization-complete',{canvasConnected:canvas.isConnected,rendererRevision:THREE.REVISION});
 return api;
}
