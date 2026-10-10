let THREE=null;

const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const color=(v,alt='#b78f68')=>{try{return new THREE.Color(v||alt)}catch{return new THREE.Color(alt)}};

export async function createCity3D(G,diagnostic=()=>{}){
 diagnostic('three-world-initializing',{module:import.meta.url});
 diagnostic('three-import-start',{module:'./vendor/three.module.js'});
 THREE=await import('./vendor/three.module.js?v=20261006-three-renderer-r4');
 diagnostic('three-import-ready',{revision:THREE.REVISION});
 diagnostic('asset-loader-import-start',{loader:'Three.js r162 GLTFLoader'});
 const [{GLTFLoader},{mergeGeometries}]=await Promise.all([
  import('./vendor/GLTFLoader.js?v=three-r162-gltf'),
  import('./vendor/BufferGeometryUtils.js?v=three-r162-gltf')
 ]);
 diagnostic('asset-loader-import-ready',{revision:THREE.REVISION});
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
 renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.02;
 diagnostic('scene-create-start');const scene=new THREE.Scene();scene.background=new THREE.Color('#9eb7c7');diagnostic('scene-created');
 scene.fog=new THREE.Fog('#9eb7c7',2100,6900);
 const ambientLight=new THREE.HemisphereLight('#e4edf4','#625746',1.55);scene.add(ambientLight);
 const sun=new THREE.DirectionalLight('#ffe5c0',2.35);sun.position.set(-500,900,350);scene.add(sun);
 const camera=new THREE.OrthographicCamera(-10,10,10,-10,.1,9000);diagnostic('camera-created');
 camera.up.set(0,1,0);
 const materialCache=new Map(),geometryCache=new Map(),planeCache=new Map(),labelCache=new Map(),textures=[],customMaterials=[],sharedGeometry=new WeakSet(),chunks=new Map(),chunkSize=G.world.mapMeta.chunkSize||800;
 let cc0FacadePbr=null,realShrubGeometry=null,realShrubMaterial=null,premiumVehiclePromise=null;
 try{
  const textureLoader=new THREE.TextureLoader(),gltfLoader=new GLTFLoader();
  const [facadeColor,facadeNormal,facadeArm,shrubAsset]=await Promise.all([
   textureLoader.loadAsync(new URL('../assets/3d/polyhaven/concrete_tile_facade/diff.jpg',import.meta.url).href),
   textureLoader.loadAsync(new URL('../assets/3d/polyhaven/concrete_tile_facade/nor_gl.jpg',import.meta.url).href),
   textureLoader.loadAsync(new URL('../assets/3d/polyhaven/concrete_tile_facade/arm.jpg',import.meta.url).href),
   gltfLoader.loadAsync(new URL('../assets/3d/polyhaven/shrub_sorrel_01/shrub_sorrel_01_1k.gltf',import.meta.url).href)
  ]);
  facadeColor.colorSpace=THREE.SRGBColorSpace;
  for(const texture of [facadeColor,facadeNormal,facadeArm]){texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.repeat.set(2,2);texture.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());textures.push(texture)}
  shrubAsset.scene.updateMatrixWorld(true);
  const foliage=[];shrubAsset.scene.traverse(object=>{if(object.isMesh){const geometry=object.geometry.clone().applyMatrix4(object.matrixWorld);foliage.push(geometry);realShrubMaterial=object.material}});
  if(foliage.length&&realShrubMaterial){
   realShrubGeometry=mergeGeometries(foliage,false);for(const geometry of foliage)geometry.dispose();
   realShrubGeometry.computeBoundingBox();const bounds=realShrubGeometry.boundingBox,height=Math.max(.001,bounds.max.y-bounds.min.y),shrubScale=2.8/height;
   realShrubGeometry.translate(-(bounds.min.x+bounds.max.x)/2,-bounds.min.y,-(bounds.min.z+bounds.max.z)/2);realShrubGeometry.scale(shrubScale,shrubScale,shrubScale);realShrubGeometry.computeBoundingBox();sharedGeometry.add(realShrubGeometry);
   realShrubMaterial=realShrubMaterial.clone();realShrubMaterial.side=THREE.DoubleSide;customMaterials.push(realShrubMaterial);
  }
  cc0FacadePbr={map:facadeColor,normalMap:facadeNormal,roughnessMap:facadeArm};
  diagnostic('production-cc0-assets-ready',{facade:'Poly Haven concrete_tile_facade 1K PBR',model:'Poly Haven shrub_sorrel_01 GLTF',modelParts:foliage.length,modelInstances:'instanced'});
 }catch(error){diagnostic('production-cc0-assets-failed',{message:error?.message||String(error)});}
 const mats={
  road:mat('#3c4852',.94),roadEdge:mat('#cbbb9d',.85),line:mat('#e2ca7d',.78),
  grass:mat('#9fbd8d',1),park:mat('#8aaf7e',1),concrete:mat('#c8c2b2',.95),
  soil:mat('#ae946b',1),trunk:mat('#72513a',1),leaf:mat('#277850',1),leaf2:mat('#328658',1),
  glass:mat('#83c5d5',.28,.12),roof:mat('#76533f',1),dark:mat('#242a30',.86),
  white:mat('#e8e2d4',.82),metal:mat('#59616a',.72),
  windowLit:new THREE.MeshStandardMaterial({color:'#fff0bd',roughness:.24,metalness:.04,emissive:'#f1a946',emissiveIntensity:.95}),
  windowDark:new THREE.MeshStandardMaterial({color:'#7daeba',roughness:.3,metalness:.08}),
  lamp:mat('#ffe0a4',.34,.15)
 };
 const daySky=new THREE.Color('#a9c4d3'),nightSky=new THREE.Color('#101a2c'),dayGrass=new THREE.Color('#788965'),nightGrass=new THREE.Color('#243b38'),dayRoad=new THREE.Color('#3d454b'),nightRoad=new THREE.Color('#202c3a'),dayLeaves=new THREE.Color('#277850'),nightLeaves=new THREE.Color('#174535');
 let lastLightingMinute=-1;function updateLighting(){const s=G.state,h=((Number(s?.hour??19)%24)+24)%24,m=(Number(s?.minute)||0)/60,clock=h+m,minuteStamp=Math.floor(clock*60);if(minuteStamp===lastLightingMinute)return;lastLightingMinute=minuteStamp;const night=clock>=19||clock<5.5,dawn=Math.max(0,1-Math.abs(clock-6.5)/1.4),dusk=Math.max(0,1-Math.abs(clock-18.2)/1.5),darkness=night ? 0.82 : Math.max(dawn,dusk)*.72;scene.background.copy(daySky).lerp(nightSky,darkness);scene.fog.color.copy(scene.background);ambientLight.intensity=1.55-darkness*.5;ambientLight.color.set('#e4edf4').lerp(new THREE.Color('#93a8d0'),darkness*.55);ambientLight.groundColor.set('#625746').lerp(new THREE.Color('#26342f'),darkness);sun.intensity=2.35-darkness*1.55;sun.color.set('#ffe5c0').lerp(new THREE.Color('#a7a3a0'),darkness);mats.grass.color.copy(dayGrass).lerp(new THREE.Color('#344b40'),darkness);mats.park.color.copy(new THREE.Color('#718c66')).lerp(new THREE.Color('#315340'),darkness);mats.road.color.copy(dayRoad).lerp(new THREE.Color('#29343c'),darkness);mats.concrete.color.copy(new THREE.Color('#bcb5a6')).lerp(new THREE.Color('#5d6265'),darkness*.55);mats.leaf.color.copy(dayLeaves).lerp(new THREE.Color('#24553c'),darkness);mats.leaf2.color.set('#328658').lerp(new THREE.Color('#2c6546'),darkness);mats.windowLit.emissiveIntensity=darkness*1.15;mats.windowLit.color.set('#83b6c5').lerp(new THREE.Color('#ffd17b'),darkness);mats.windowDark.color.set('#8cbac7').lerp(new THREE.Color('#385068'),darkness);mats.lamp.emissive=new THREE.Color('#d38b34');mats.lamp.emissiveIntensity=darkness*1.15}
 updateLighting();
 function mat(hex,rough=.82,metalness=0){const k=hex+rough+metalness;if(!materialCache.has(k))materialCache.set(k,new THREE.MeshStandardMaterial({color:hex,roughness:rough,metalness}));return materialCache.get(k)}
 function grainTexture(seed){const c=document.createElement('canvas');c.width=c.height=128;const q=c.getContext('2d'),r=seeded(seed);q.fillStyle='#deded8';q.fillRect(0,0,128,128);for(let i=0;i<3000;i++){const v=Math.floor(112+r()*64);q.fillStyle=`rgba(${v},${v},${v},${.04+r()*.12})`;q.fillRect(r()*128,r()*128,1+r()*2,1+r()*2)}const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(1,1);t.anisotropy=renderer.capabilities.getMaxAnisotropy();textures.push(t);return t}
 // Small, reusable PBR facade tiles add panel joints, mineral variation and relief without
 // multiplying draw calls across the 3,568 instanced city lots.
 function architecturalSurface(seed,kind='stone'){
  const size=512,c=document.createElement('canvas'),r=document.createElement('canvas'),n=document.createElement('canvas');c.width=c.height=r.width=r.height=n.width=n.height=size;
  const ctx=c.getContext('2d'),rough=r.getContext('2d'),normal=n.getContext('2d'),rand=seeded(seed),base=kind==='metal'?[37,43,47]:kind==='paving'?[137,137,128]:kind==='glass'?[57,91,101]:[175,168,151];
  ctx.fillStyle=`rgb(${base.join(',')})`;ctx.fillRect(0,0,size,size);rough.fillStyle='#c4c4c4';rough.fillRect(0,0,size,size);normal.fillStyle='rgb(128,128,255)';normal.fillRect(0,0,size,size);
  for(let i=0;i<4300;i++){const x=rand()*size,y=rand()*size,v=(rand()-.5)*(kind==='metal'?20:27);ctx.fillStyle=`rgba(${v>0?'255':'0'},${v>0?'255':'0'},${v>0?'255':'0'},${Math.abs(v)/210})`;ctx.fillRect(x,y,1+rand()*4,1+rand()*3);}
  const rows=kind==='paving'?36:kind==='metal'?9:8,cols=kind==='paving'?36:kind==='metal'?6:8;ctx.lineWidth=kind==='paving'?1:3;ctx.strokeStyle=kind==='metal'?'rgba(5,8,10,.75)':'rgba(28,31,29,.44)';rough.strokeStyle='#777';normal.strokeStyle='rgb(104,128,247)';
  for(let y=0;y<=rows;y++){const yy=Math.round(y*size/rows);ctx.beginPath();ctx.moveTo(0,yy);ctx.lineTo(size,yy);ctx.stroke();rough.beginPath();rough.moveTo(0,yy);rough.lineTo(size,yy);rough.stroke();normal.beginPath();normal.moveTo(0,yy);normal.lineTo(size,yy);normal.stroke()}
  for(let x=0;x<=cols;x++){const xx=Math.round(x*size/cols);ctx.beginPath();ctx.moveTo(xx,0);ctx.lineTo(xx,size);ctx.stroke();rough.beginPath();rough.moveTo(xx,0);rough.lineTo(xx,size);rough.stroke();normal.beginPath();normal.moveTo(xx,0);normal.lineTo(xx,size);normal.stroke()}
  if(kind==='metal'){for(let y=12;y<size;y+=size/rows)for(let x=12;x<size;x+=size/cols){ctx.fillStyle='rgba(210,190,143,.55)';ctx.beginPath();ctx.arc(x,y,2.2,0,Math.PI*2);ctx.fill()}}
  for(const canvas of [c,r,n]){const q=canvas.getContext('2d');q.imageSmoothingEnabled=true}
  const map=new THREE.CanvasTexture(c),roughnessMap=new THREE.CanvasTexture(r),bumpMap=new THREE.CanvasTexture(n);
  map.colorSpace=THREE.SRGBColorSpace;for(const t of [map,roughnessMap,bumpMap]){t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());textures.push(t)}
  return{map,roughnessMap,bumpMap};
 }
 const cityPbr=architecturalSurface(181,'stone'),dealerMetalPbr=architecturalSurface(291,'metal'),dealerStonePbr=cc0FacadePbr||architecturalSurface(391,'stone'),dealerPavingPbr=architecturalSurface(491,'paving');
 const cityFacadeMaterial=new THREE.MeshStandardMaterial({color:'#fff',...(cc0FacadePbr||cityPbr),roughness:.82,metalness:.06,normalScale:new THREE.Vector2(.32,.32)});
 function applyPbr(material,surface,{roughness=.72,metalness=.14,bumpScale=.035,normalScale=.3}={}){material.map=surface.map;material.roughnessMap=surface.roughnessMap;material.normalMap=surface.normalMap||null;material.normalScale?.set(normalScale,normalScale);material.bumpMap=surface.bumpMap||null;material.roughness=roughness;material.metalness=metalness;material.bumpScale=bumpScale;material.needsUpdate=true;return material}
 mats.road.map=grainTexture(31);mats.road.needsUpdate=true;mats.concrete.map=grainTexture(61);mats.concrete.needsUpdate=true;mats.soil.map=grainTexture(91);mats.soil.needsUpdate=true;
 function boxGeometry(x,y,z){const k=x+':'+y+':'+z;if(!geometryCache.has(k)){const geometry=new THREE.BoxGeometry(x,y,z);geometryCache.set(k,geometry);sharedGeometry.add(geometry)}return geometryCache.get(k)}
 const wheelGeometry=new THREE.CylinderGeometry(.38,.38,.2,10),personBodyGeometry=new THREE.CapsuleGeometry(.34,.65,3,6),personHeadGeometry=new THREE.SphereGeometry(.27,8,6);sharedGeometry.add(wheelGeometry);sharedGeometry.add(personBodyGeometry);sharedGeometry.add(personHeadGeometry);
 function box(parent,x,y,z,w,h,d,m){const o=new THREE.Mesh(boxGeometry(w,h,d),m);o.position.set(x,y+h/2,z);o.castShadow=false;o.receiveShadow=true;parent.add(o);return o}
 function flat(parent,x,y,z,w,d,m){return box(parent,x,y,z,w,.22,d,m)}
 function rect(parent,x,z,w,d,m){const k=w+':'+d;if(!planeCache.has(k)){const geometry=new THREE.PlaneGeometry(w,d);planeCache.set(k,geometry);sharedGeometry.add(geometry)}const o=new THREE.Mesh(planeCache.get(k),m);o.rotation.x=-Math.PI/2;o.position.set(x,terrainY(x,z)+.16,z);parent.add(o);return o}
 function seeded(seed){let n=(seed|0)+0x6d2b79f5;return()=>{n=Math.imul(n^(n>>>15),n|1);n^=n+Math.imul(n^(n>>>7),n|61);return((n^(n>>>14))>>>0)/4294967296}}
 function label(text,bg='#101b2a',fg='#fff7df',size=18){const k=[text,bg,fg,size].join('|');if(!labelCache.has(k)){const c=document.createElement('canvas');c.width=512;c.height=96;const q=c.getContext('2d');q.fillStyle='#d9a62e';q.beginPath();q.roundRect(7,9,498,78,22);q.fill();q.fillStyle=bg;q.beginPath();q.roundRect(10,12,492,72,19);q.fill();q.font=`700 ${size}px system-ui, sans-serif`;q.fillStyle=fg;q.textAlign='center';q.textBaseline='middle';q.fillText(text.slice(0,42),256,48,462);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;labelCache.set(k,t)}const s=new THREE.Sprite(new THREE.SpriteMaterial({map:labelCache.get(k),transparent:true,depthTest:false}));s.scale.set(Math.min(92,Math.max(32,text.length*1.4)),17,1);s.renderOrder=5;return s}
 function terrainY(x,z){return G.world.heightAt?G.world.heightAt(x,z):0}
 function buildingModel(b,lod){const g=new THREE.Group(),w=Math.max(12,b.w||36),d=Math.max(12,b.h||30),floorsByType={market:1,restaurant:2,mall:2,office:3,bank:3,government:3,hospital:3,hotel:4,apartment:4,university:3,police:2,mosque:1,church:2,gym:2,mechanic:1,club:2,waterfront:1,bus:1,railway:2,airport:2},floorsTarget=floorsByType[b.type]||2,heightByAsset={'fuel-station':8,'bus-terminal':9,'railway-station':11,airport:16,'national-mosque':22,'national-church':24,'shopping-mall':15,'central-bank':25},baseHeight=heightByAsset[b.asset]||Math.max(5.2,Math.min(32,floorsTarget*3.8)),height=lod===0?baseHeight:lod===1?Math.max(5,Math.min(24,baseHeight*.78)):Math.max(4.5,Math.min(16,baseHeight*.52));
  const base=mat(b.color||'#b78f68',.82),glass=mat('#8cc6d1',.26,.06),trim=mat('#d3cbb9',.72),accent=mat(b.type==='government'||b.type==='bank'?'#bda264':b.type==='hospital'?'#f0eee5':'#b27750',.75),roof=b.type==='mosque'||b.asset==='national-mosque'?mat('#526272',.55):b.type==='church'||b.asset==='national-church'?mat('#4f5964',.75):['market','restaurant','club'].includes(b.type)?mat('#784b3c',.76):mat('#394650',.72),windowRandom=seeded(String(b.id||b.name||b.x).split('').reduce((n,ch)=>Math.imul(n^ch.charCodeAt(0),16777619),2166136261));
  flat(g,0,0,0,w+9,d+9,trim);box(g,0,.2,0,w,height,d,base);
  const floors=lod===0?floorsTarget:Math.max(1,Math.round(height/4.3)),floorH=height/floors;
  if(lod<2){
   for(let f=0;f<floors;f++){
    const yy=.3+f*floorH;
    box(g,0,yy,0,w+.5,.36,d+.5,trim);
     for(let side of [-1,1])for(let xx=-w/2+3;xx<w/2-2;xx+=Math.max(5,w/8))box(g,xx,yy+.75,side*(d/2+.15),Math.min(3.8,w/9),Math.min(2.6,floorH*.5),.18,windowRandom()>.37?mats.windowLit:mats.windowDark);
     for(let side of [-1,1])for(let zz=-d/2+3;zz<d/2-2;zz+=Math.max(5,d/7))box(g,side*(w/2+.15),yy+.75,zz,.18,Math.min(2.6,floorH*.5),Math.min(3.8,d/8),windowRandom()>.37?mats.windowLit:mats.windowDark);
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
    const gold=mat('#c4a247',.48,.2),domeG=new THREE.SphereGeometry(Math.min(w,d)*.2,16,10,0,Math.PI*2,0,Math.PI/2);const dome=new THREE.Mesh(domeG,gold);dome.position.set(0,height+1,0);g.add(dome);
    for(const xx of [-w*.34,w*.34])for(const zz of [-d*.34,d*.34]){box(g,xx,.2,zz,3.1,height+Math.min(w,d)*.24,3.1,trim);box(g,xx,height+2,zz,4.2,1.2,4.2,gold);const cap=new THREE.Mesh(new THREE.ConeGeometry(2.1,5,8),gold);cap.position.set(xx,height+Math.min(w,d)*.24+4,zz);g.add(cap)}
    for(const side of [-1,1]){const smaller=new THREE.Mesh(new THREE.SphereGeometry(Math.min(w,d)*.09,12,8,0,Math.PI*2,0,Math.PI/2),gold);smaller.position.set(side*w*.26,height+1,-d*.15);g.add(smaller)}
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
 const vehicleBodyCache=new Map();
 function addRealPlantInstances(parent,positions,scale=.3){if(!realShrubGeometry||!realShrubMaterial||!positions.length)return 0;const plants=new THREE.InstancedMesh(realShrubGeometry,realShrubMaterial,positions.length),transform=new THREE.Object3D();plants.name='Poly Haven CC0 sorrel planting';for(let i=0;i<positions.length;i++){const p=positions[i];transform.position.set(p.x,.36,p.z);transform.rotation.y=p.rotation||0;transform.scale.setScalar(p.scale||scale);transform.updateMatrix();plants.setMatrixAt(i,transform.matrix)}plants.instanceMatrix.needsUpdate=true;plants.castShadow=false;plants.receiveShadow=true;parent.add(plants);return positions.length}
 function vehicleBody(kind,l,w,h){if(vehicleBodyCache.has(kind))return vehicleBodyCache.get(kind);const profile=new THREE.Shape();profile.moveTo(-l*.5,.22);profile.lineTo(-l*.5,.62);profile.quadraticCurveTo(-l*.49,.78,-l*.39,.8);profile.lineTo(-l*.23,.82);profile.lineTo(-l*.12,.91);profile.quadraticCurveTo(-l*.04,.97,l*.12,.94);profile.lineTo(l*.28,.85);profile.lineTo(l*.42,.73);profile.quadraticCurveTo(l*.5,.69,l*.5,.55);profile.lineTo(l*.5,.22);profile.lineTo(l*.4,.17);profile.lineTo(-l*.39,.17);profile.closePath();const depth=w*.82,geo=new THREE.ExtrudeGeometry(profile,{depth,steps:1,bevelEnabled:true,bevelSegments:2,bevelSize:.07,bevelThickness:.055,curveSegments:5});geo.translate(0,0,-depth/2);geo.computeVertexNormals();sharedGeometry.add(geo);vehicleBodyCache.set(kind,geo);return geo}
 function carModel(parent,x,z,tint,kind='sedan',large=false,local=false){
  const g=new THREE.Group();g.position.set(x,local?0:terrainY(x,z),z);
  const bus=kind==='bus'||kind==='minibus',suv=kind==='suv',sport=kind==='sport',w=bus?2.65:suv?2.18:1.9,l=bus?7:suv?5.15:sport?4.7:4.45,h=bus?2.8:suv?2.05:sport?1.25:1.48,paint=mat(tint||'#263544',.31,.42),glass=mat('#7195a1',.2,.18),rubber=mat('#20262a',.92),chrome=mat('#a6aca9',.28,.72),lamp=mat('#fff0ba',.22,.1),tail=mat('#bd4138',.35,.1);
  // A shared, bevelled body mesh gives stock cars a curved bonnet, shoulder and wheel-line
  // silhouette while keeping vehicle inventory cheap to draw.
  const shell=new THREE.Mesh(vehicleBody(kind,l,w,h),paint);shell.castShadow=false;shell.position.y=.08;g.add(shell);
  const roofY=.61+h*.48;box(g,-l*.055,roofY-.08,0,l*(bus?.62:suv?.49:.43),.16,w*.78,sport?chrome:paint);
  // Individually framed windshields and side windows catch the showroom lights.
  box(g,l*.17,.78,0,.13,h*.3,w*.69,glass);box(g,-l*.28,.77,0,.12,h*.29,w*.68,glass);
  for(const side of [-1,1]){for(const xx of [-l*.16,l*.035])box(g,xx,.78,side*w*.405,l*.16,h*.28,.08,glass);box(g,-l*.055,.66,side*w*.43,.09,h*.42,.13,mat('#252c30',.4,.35));box(g,-l*.025,.57,side*w*.5,.46,.08,.12,chrome)}
  // Bumpers, grille, registration plate, headlamps and red rear lamps.
  box(g,l*.48,.19,0,.18,.25,w*.94,chrome);box(g,l*.505,.35,0,.08,.26,w*.3,mat('#30373a',.52,.3));box(g,-l*.48,.19,0,.16,.24,w*.94,mat('#555c5f',.52,.4));
  for(const side of [-1,1]){box(g,l*.47,.48,side*w*.32,.08,.2,w*.22,lamp);box(g,-l*.47,.47,side*w*.32,.08,.22,w*.2,tail)}
  // Four detailed wheels with dark tyres, alloy hubs and subtle arches.
  for(const xx of [-l*.32,l*.32])for(const zz of [-w*.52,w*.52]){const tyre=new THREE.Mesh(wheelGeometry,rubber);tyre.rotation.z=Math.PI/2;tyre.position.set(xx,.38,zz);g.add(tyre);const hub=new THREE.Mesh(new THREE.CylinderGeometry(.22,.22,.22,10),chrome);hub.rotation.z=Math.PI/2;hub.position.set(xx,.38,zz*1.04);g.add(hub)}
  if(large)g.scale.setScalar(1.28);
  g.userData.vehicleKind=kind;
  if(suv){for(const side of [-1,1])box(g,-l*.055,roofY+.13,side*w*.34,l*.55,.12,.12,chrome)}
  parent.add(g);return g;
 }
 function treeBatch(group,cx,cz,seed,count=42){
  const rand=seeded(seed),trunkGeo=new THREE.CylinderGeometry(.48,.78,7,7),crownGeo=new THREE.SphereGeometry(1,8,6),palmGeo=new THREE.BufferGeometry();
  palmGeo.setAttribute('position',new THREE.Float32BufferAttribute([0,0,0,.2,.3,0,.45,.32,0,.78,.15,0,1,0,0,.78,-.15,0,.45,-.32,0,.2,-.3,0],3));palmGeo.setIndex([0,1,7,1,2,7,2,6,7,2,3,6,3,5,6,3,4,5]);palmGeo.computeVertexNormals();sharedGeometry.add(trunkGeo,crownGeo);
  const trees=[],roadTrees=[],used=new Set(),collides=(x,z,r=8)=>G.world.buildings.some(b=>x>b.x-r&&x<b.x+b.w+r&&z>b.y-r&&z<b.y+b.h+r)||G.world.houseLots?.some(h=>x>h.x-r&&x<h.x+h.w+r&&z>h.y-r&&z<h.y+h.h+r)||G.world.cityLots?.some(b=>x>b.x-r&&x<b.x+b.w+r&&z>b.y-r&&z<b.y+b.h+r);
  const add=(x,z,palm=false)=>{if(x<cx+18||x>cx+chunkSize-18||z<cz+18||z>cz+chunkSize-18)return;if(used.has(`${Math.round(x/8)}:${Math.round(z/8)}`)||collides(x,z))return;used.add(`${Math.round(x/8)}:${Math.round(z/8)}`);trees.push({x,z,palm,scale:.78+rand()*.6,tone:rand()})};
  // Plant deliberate avenues on the verges, then fill open courtyards and green space.
  for(let i=0;i<G.world.roadX.length;i++){const x=G.world.roadX[i],width=roadWidth('x',i);if(x<cx-24||x>cx+chunkSize+24)continue;for(let z=cz+54;z<cz+chunkSize-30;z+=92){const side=(Math.floor(z/92)%2?1:-1);add(x+side*(width/2+9),z,true);if(width<20)add(x-side*(width/2+9),z+38,false)}}
  for(let i=0;i<G.world.roadY.length;i++){const z=G.world.roadY[i],width=roadWidth('y',i);if(z<cz-24||z>cz+chunkSize+24)continue;for(let x=cx+54;x<cx+chunkSize-30;x+=92){const side=(Math.floor(x/92)%2?1:-1);add(x,z+side*(width/2+9),true);if(width<20)add(x+38,z-side*(width/2+9),false)}}
  let tries=0;while(trees.length<count&&tries<count*12){tries++;add(cx+24+rand()*(chunkSize-48),cz+24+rand()*(chunkSize-48),rand()<.2)}
  if(!trees.length)return;
  const broad=trees.filter(t=>!t.palm),palms=trees.filter(t=>t.palm),trunks=new THREE.InstancedMesh(trunkGeo,mats.trunk,trees.length),crownTop=new THREE.InstancedMesh(crownGeo,mats.leaf,trees.length),crownLow=new THREE.InstancedMesh(crownGeo,mats.leaf2,trees.length),palmLeaves=new THREE.InstancedMesh(palmGeo,mats.leaf2,Math.max(1,palms.length*6)),dummy=new THREE.Object3D();let pi=0;
  trees.forEach((t,i)=>{const y=terrainY(t.x,t.z),s=t.scale;dummy.rotation.set(0,0,0);dummy.position.set(t.x,y+3.5*s,t.z);dummy.scale.set(s,s,s);dummy.updateMatrix();trunks.setMatrixAt(i,dummy.matrix);trunks.setColorAt(i,color(t.tone>.65?'#7f5537':'#674b37'));
   if(t.palm){dummy.position.set(t.x,y+10*s,t.z);dummy.scale.set(1.5*s,1.8*s,1.5*s);dummy.updateMatrix();crownTop.setMatrixAt(i,dummy.matrix);crownTop.setColorAt(i,color('#2e7650'));for(let k=0;k<6;k++){dummy.position.set(t.x,y+11*s,t.z);dummy.rotation.set((rand()-.5)*.25,k*Math.PI/3,(-.2-rand()*.25));dummy.scale.set(9*s,2.1*s,.5*s);dummy.updateMatrix();palmLeaves.setMatrixAt(pi++,dummy.matrix)}}
   else{dummy.position.set(t.x,y+10*s,t.z);dummy.scale.set(6.1*s,6.8*s,6.1*s);dummy.updateMatrix();crownTop.setMatrixAt(i,dummy.matrix);crownTop.setColorAt(i,color(t.tone>.72?'#34764c':t.tone>.38?'#2f8051':'#397f4e'));dummy.position.set(t.x+1.1*s,y+7.5*s,t.z-.4*s);dummy.scale.set(6.5*s,4.1*s,6.2*s);dummy.updateMatrix();crownLow.setMatrixAt(i,dummy.matrix);crownLow.setColorAt(i,color('#32734a'))}
  });trunks.count=trees.length;crownTop.count=trees.length;crownLow.count=broad.length;palmLeaves.count=pi;trunks.castShadow=false;crownTop.castShadow=false;crownLow.castShadow=false;palmLeaves.castShadow=false;group.userData.treeCount=(group.userData.treeCount||0)+trees.length;group.add(trunks,crownTop,crownLow,palmLeaves);
 }
 function terrainStrip(parent,axis,pos,start,end,width,material,lift=.05){const steps=Math.max(1,Math.ceil((end-start)/72)),vertices=[],uvs=[],indices=[];for(let i=0;i<=steps;i++){const t=i/steps,v=start+(end-start)*t;for(const side of [-1,1]){const half=width/2*side,x=axis==='x'?pos+half:v,z=axis==='x'?v:pos+half;vertices.push(x,terrainY(x,z)+lift,z);uvs.push(x/8,z/8)}}for(let i=0;i<steps;i++){const a=i*2,b=a+1,c=a+2,d=a+3;if(axis==='x')indices.push(a,c,b,b,c,d);else indices.push(a,b,c,b,d,c)}const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geo.setIndex(indices);geo.computeVertexNormals();const mesh=new THREE.Mesh(geo,material);mesh.receiveShadow=true;parent.add(mesh);return mesh}
 function pathSurface(parent,a,b,width,material,lift=.12){const dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz),steps=Math.max(1,Math.ceil(len/64)),nx=dz/len,nz=-dx/len,vertices=[],uvs=[],indices=[];for(let i=0;i<=steps;i++){const t=i/steps,x=a[0]+dx*t,z=a[1]+dz*t;for(const side of [-1,1]){const px=x+nx*width*.5*side,pz=z+nz*width*.5*side;vertices.push(px,terrainY(px,pz)+lift,pz);uvs.push(px/8,pz/8)}}for(let i=0;i<steps;i++){const k=i*2;indices.push(k,k+2,k+1,k+1,k+2,k+3)}const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geo.setIndex(indices);geo.computeVertexNormals();const mesh=new THREE.Mesh(geo,material);mesh.receiveShadow=true;parent.add(mesh);return mesh}
 function roadWidth(axis,index){return axis==='x'?(index%5===0?30:index%2===0?20:13):(index%4===0?30:index%2===0?20:13)}
 function addRoadMedians(g,cx,cz){
  const segments=[],add=(axis,pos,start,end,otherRoads)=>{for(let along=start+54;along<end-30;along+=104){const cross=otherRoads.findIndex((p,i)=>Math.abs(along-p)<roadWidth(axis==='x'?'y':'x',i)/2+30);if(cross>=0)continue;segments.push({axis,pos,along})}};
  for(let i=0;i<G.world.roadX.length;i++){const x=G.world.roadX[i];if(roadWidth('x',i)>=28&&x>=cx-15&&x<=cx+chunkSize+15)add('x',x,cz,cz+chunkSize,G.world.roadY)}
  for(let i=0;i<G.world.roadY.length;i++){const y=G.world.roadY[i];if(roadWidth('y',i)>=28&&y>=cz-15&&y<=cz+chunkSize+15)add('y',y,cx,cx+chunkSize,G.world.roadX)}
  if(!segments.length)return;const grass=new THREE.InstancedMesh(boxGeometry(60,.18,2.25),mats.park,segments.length),curbs=new THREE.InstancedMesh(boxGeometry(60,.32,.3),mats.roadEdge,segments.length*2),dummy=new THREE.Object3D();let curbIndex=0;
  for(const s of segments){const x=s.axis==='x'?s.pos:s.along,z=s.axis==='x'?s.along:s.pos,y=terrainY(x,z)+.27;dummy.position.set(x,y,z);dummy.rotation.set(0,s.axis==='x'?Math.PI/2:0,0);dummy.scale.set(1,1,1);dummy.updateMatrix();grass.setMatrixAt(grass.count++,dummy.matrix);for(const side of [-1,1]){dummy.position.set(x+(s.axis==='x'?side*1.28:0),y+.06,z+(s.axis==='y'?side*1.28:0));dummy.updateMatrix();curbs.setMatrixAt(curbIndex++,dummy.matrix)}}
  g.add(grass,curbs);
 }
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
  const pathDashes=[];for(const path of G.world.roadPaths||[]){for(let i=1;i<path.points.length;i++){const a=path.points[i-1],b=path.points[i],len=Math.hypot(b[0]-a[0],b[1]-a[1]),steps=Math.max(1,Math.ceil(len/220)),nx=(b[1]-a[1])/len,nz=-(b[0]-a[0])/len;for(let j=0;j<steps;j++){const t0=j/steps,t1=(j+1)/steps,mid=(t0+t1)/2,mx=a[0]+(b[0]-a[0])*mid,mz=a[1]+(b[1]-a[1])*mid;if(mx<minX-25||mx>maxX+25||mz<minZ-25||mz>maxZ+25)continue;const p0=[a[0]+(b[0]-a[0])*t0,a[1]+(b[1]-a[1])*t0],p1=[a[0]+(b[0]-a[0])*t1,a[1]+(b[1]-a[1])*t1];pathSurface(g,p0,p1,path.width+16,mat('#c8c2b2',.94),.04);pathSurface(g,p0,p1,path.width+7,mat('#bbb49f'),.08);pathSurface(g,p0,p1,path.width,mat('#3c4852',.94),.12);if(path.class==='arterial'||path.class==='expressway')pathSurface(g,p0,p1,2.4,mat('#77966e'),.19);for(let along=15;along<len/steps;along+=30){const q=(t0*len+along)/len,x=a[0]+(b[0]-a[0])*q,z=a[1]+(b[1]-a[1])*q;for(const laneSide of (path.class==='arterial'||path.class==='expressway'?[-1,1]:[0])){const laneX=x+nx*path.width*.24*laneSide,laneZ=z+nz*path.width*.24*laneSide;dummy.position.set(laneX,terrainY(laneX,laneZ)+.25,laneZ);dummy.rotation.y=-Math.atan2(b[1]-a[1],b[0]-a[0]);dummy.updateMatrix();pathDashes.push(dummy.matrix.clone())}}}}}
  if(pathDashes.length){const mesh=new THREE.InstancedMesh(boxGeometry(11,.12,.32),mats.line,pathDashes.length);pathDashes.forEach((m,i)=>mesh.setMatrixAt(i,m));g.add(mesh)}
  addRoadMedians(g,cx,cz);
 }
 function makeHouse(h){
  const g=new THREE.Group(),w=h.w,d=h.h,seed=String(h.id||`${h.x}:${h.y}`).split('').reduce((n,c)=>Math.imul(n^c.charCodeAt(0),16777619),2166136261),rand=seeded(seed),wallColors=['#e2d6c4','#d6c4a7','#e7dfcf','#d2c6b2','#cbb79a'],roofColors=['#975d44','#755044','#626864','#8c573f'],base=mat('#bba98d'),wall=mat(wallColors[Math.floor(rand()*wallColors.length)]),roof=mat(roofColors[Math.floor(rand()*roofColors.length)],.84),window=mat('#7faebb',.24,.08),trim=mat('#e9e2d6',.66,.12),drive=mat('#9c978a');
  flat(g,0,0,0,w+12,d+15,mat(h.style==='garden-estate'?'#89a978':'#9eaf87'));flat(g,0,.18,0,w+7,d+8,mats.concrete);flat(g,0,.2,-d*.5-5,w*.58,11,drive);box(g,0,.25,0,w,3.4,d,wall);box(g,0,3.35,0,w+.8,.25,d+.8,trim);
  const v=[-w/2,3.55,-d/2,w/2,3.55,-d/2,0,3.55+2.9,-d/2,-w/2,3.55,d/2,w/2,3.55,d/2,0,3.55+2.9,d/2],geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(v,3));geo.setIndex([0,1,2,3,5,4,0,3,4,0,4,1,1,4,5,1,5,2,2,5,3,2,3,0]);geo.computeVertexNormals();g.add(new THREE.Mesh(geo,roof));
  const frontGlass=mat('#83b8c4',.26,.12);for(const side of [-1,1])for(const x of [-w*.32,w*.32]){box(g,x,1.35,side*(d/2+.12),Math.min(4.5,w*.22),1.45,.22,window);box(g,x,1.35+((x>0)?0:0),side*(d/2+.25),.22,1.6,.14,trim)}
  for(const x of [-w*.42,w*.42])box(g,x,1.35,-d/2-.12,Math.min(3.5,w*.18),1.45,.2,window);
  box(g,0,.25,-d/2-.25,Math.max(2.2,w*.12),2.25,.38,mat('#604b3c'));flat(g,0,.12,-d/2-2,Math.min(w*.56,15),3.8,mat('#cfc6b6'));for(const x of [-w*.19,w*.19])box(g,x,.28,-d/2-2.7,.42,2.65,.42,trim);box(g,0,2.9,-d/2-2.55,Math.min(12,w*.62),.45,4.2,roof);
  // Each plot reads as its own small compound, with a gated wall, garden beds and a drive.
  const wallH=1.1,edgeZ=d/2+5,frontZ=-d/2-5;box(g,0,.2,edgeZ,w+10,wallH,.55,base);box(g,-w/2-5,.2,0,.55,wallH,d+10,base);box(g,w/2+5,.2,0,.55,wallH,d+10,base);for(const side of [-1,1])box(g,side*(w*.25+1),.2,frontZ,(w-6)/2,wallH,.55,base);for(const x of [-w/2-5,w/2+5])box(g,x,.25,frontZ,1.15,2.4,1.15,trim);
  for(let i=0;i<3;i++){const x=(i-1)*w*.31,z=d*.23,bed=new THREE.Mesh(new THREE.CylinderGeometry(2.1,2.5,.55,7),mat(i===1?'#657c4d':'#6c8151'));bed.position.set(x,.58,z);g.add(bed);const plant=new THREE.Mesh(new THREE.SphereGeometry(2.2,7,5),i%2?mats.leaf2:mats.leaf);plant.position.set(x,2.7,z);plant.scale.set(1,1.15,1);g.add(plant)}
   for(const x of [-w*.42,w*.42]){box(g,x,1.3,d/2+1.3,.25,2.2,.25,base);box(g,x,1.5,d/2+2.7,2.1,.12,2.7,roof)}
   // Small player-scale fittings make the close LOD houses read as occupied homes.
   for(const side of [-1,1]){box(g,side*w*.39,1.25,-d/2-.27,Math.min(4.3,w*.22),1.45,.14,window);box(g,side*w*.39,2.05,-d/2-.28,Math.min(4.7,w*.24),.16,.28,trim);box(g,side*w*.39,2.15,-d*.08,2.6,1.3,1.1,mat('#9ea7a5',.52,.4));box(g,side*w*.39,2.85,-d*.08,2.9,.16,1.3,trim)}
   box(g,0,.36,-d/2-.48,Math.max(2.4,w*.13),2.35,.28,mat('#483c34'));
   // Crisp eaves and gutters give each pitched roof a finished edge.
   for(const side of [-1,1]){box(g,side*(w/2+.42),3.55,0,.22,.28,d+1,trim);box(g,0,3.55,side*(d/2+.42),w+1,.28,.22,trim)}
   return g;
 }
 function houseRoofGeometry(){const g=new THREE.BufferGeometry(),p=[-.5,0,-.5,.5,0,-.5,0,1,-.5,-.5,0,.5,.5,0,.5,0,1,.5];g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setIndex([0,1,2,3,5,4,0,3,4,0,4,1,1,4,5,1,5,2]);g.computeVertexNormals();sharedGeometry.add(g);return g}
 const distantHouseRoof=houseRoofGeometry();
 function addHomes(group,homes){if(!homes.length)return;const bodies=new THREE.InstancedMesh(boxGeometry(23.5,3.4,18.5),mat('#ffffff'),homes.length),roofs=new THREE.InstancedMesh(distantHouseRoof,mat('#ffffff',.83),homes.length),items=[],dummy=new THREE.Object3D();bodies.castShadow=false;roofs.castShadow=false;
  homes.forEach((h,i)=>{const x=h.x+h.w/2,z=h.y+h.h/2,ground=terrainY(x,z);dummy.position.set(x,ground+1.95,z);dummy.scale.set(h.w/23.5,1,h.h/18.5);dummy.updateMatrix();bodies.setMatrixAt(i,dummy.matrix);dummy.position.set(x,ground+3.5,z);dummy.scale.set(h.w+4,1.35,h.h+4);dummy.updateMatrix();roofs.setMatrixAt(i,dummy.matrix);bodies.setColorAt(i,color(h.style==='garden-estate'?'#e3d5bd':'#d3bea0'));roofs.setColorAt(i,color(h.style==='garden-estate'?'#905642':'#8b5140'));items.push({h,x,z,ground,detail:null,parent:group,near:false,index:i})});group.add(bodies,roofs);group.userData.homeLOD={bodies,roofs,items};}
 function dummyHome(item,bodies,roofs){const d=new THREE.Object3D(),scale=item.near?0:1;d.position.set(item.x,item.ground+1.95,item.z);d.scale.set(item.h.w/23.5*scale,scale,item.h.h/18.5*scale);d.updateMatrix();bodies.setMatrixAt(item.index,d.matrix);d.position.set(item.x,item.ground+3.5,item.z);d.scale.set((item.h.w+4)*scale,1.35*scale,(item.h.h+4)*scale);d.updateMatrix();roofs.setMatrixAt(item.index,d.matrix)}
 function buildCityFabric(group,lots,cx,cz){
  if(!lots?.length)return;
  const cube=boxGeometry(1,1,1),floorsOf=b=>clamp(b.floors||2,1,24),windowCapacity=lots.reduce((n,b)=>{const cols=Math.max(2,Math.ceil(b.w/14)),rows=Math.max(2,Math.ceil(b.h/14));return n+floorsOf(b)*2*(cols+rows)},0),bandCapacity=lots.reduce((n,b)=>n+Math.max(0,floorsOf(b)-1)*4,0),balconyCapacity=lots.reduce((n,b)=>n+((b.type==='apartment'||b.type==='villa'||b.type==='house'||floorsOf(b)>=8)?4:0),0);
  const white=mat('#ffffff',.76),curtainCapacity=lots.reduce((n,b)=>{const floors=floorsOf(b);if(floors<7||b.type==='warehouse'||['villa','house','apartment'].includes(b.type))return n;const cols=Math.max(3,Math.ceil(b.w/18)),rows=Math.max(3,Math.ceil(b.h/18));return n+floors*2*(cols+rows)},0),towerGlassMaterial=new THREE.MeshPhysicalMaterial({color:'#a5c8d1',roughness:.24,metalness:.28,clearcoat:.82,clearcoatRoughness:.2,transparent:true,opacity:.72,depthWrite:false}),curtainPanels=new THREE.InstancedMesh(cube,towerGlassMaterial,Math.max(1,curtainCapacity)),pads=new THREE.InstancedMesh(cube,mat('#ffffff',.96),lots.length),bodyLow=new THREE.InstancedMesh(cube,cityFacadeMaterial,lots.length),bodyTower=new THREE.InstancedMesh(cube,cityFacadeMaterial,lots.length),roof=new THREE.InstancedMesh(cube,white,lots.length),roofFeatures=new THREE.InstancedMesh(new THREE.ConeGeometry(.72,.38,4),white,lots.length),parapets=new THREE.InstancedMesh(cube,white,lots.length*4),bands=new THREE.InstancedMesh(cube,white,Math.max(1,bandCapacity)),fins=new THREE.InstancedMesh(cube,white,lots.length*8),windowFrames=new THREE.InstancedMesh(cube,mat('#d6d2c6',.58,.12),windowCapacity),windowsOn=new THREE.InstancedMesh(cube,mats.windowLit,windowCapacity),windowsOff=new THREE.InstancedMesh(cube,mats.windowDark,windowCapacity),balconies=new THREE.InstancedMesh(cube,mat('#a4a49b',.66,.22),Math.max(1,balconyCapacity)),balconyRails=new THREE.InstancedMesh(cube,mat('#47545a',.46,.38),Math.max(1,balconyCapacity)),awnings=new THREE.InstancedMesh(cube,white,lots.length),units=new THREE.InstancedMesh(cube,mat('#a8a397',.86),lots.length*2),dummy=new THREE.Object3D();
  for(const mesh of [pads,bodyLow,bodyTower,roof,roofFeatures,parapets,bands,fins,windowFrames,windowsOn,windowsOff,balconies,balconyRails,awnings,units])mesh.castShadow=false;
  const cityPalettes={residential:['#ddcfb7','#c9b79d','#e7ded0','#d5c6ae','#bba98f'],office:['#aebac0','#7e9299','#c7cbca','#66777f','#d6d4ca'],shop:['#d4c4a8','#bdab8e','#d9d3c5','#c8b497','#9faeb0'],warehouse:['#aaa9a1','#c1baaa','#8e9a99','#bcb7a9'],institution:['#ddd6c7','#c9c1b1','#aaa99e','#e5dfd2']},roofPalette=['#3e484c','#755044','#59666a','#8d7457','#465762'],facadeTrim=['#e8dfcd','#d2c8b5','#a9b7b7','#c3a97e'];
  let curtainIndex=0,frameIndex=0,onIndex=0,offIndex=0,bandIndex=0,finIndex=0,parapetIndex=0,balconyIndex=0,awningIndex=0,unitIndex=0,roofFeatureIndex=0;
  lots.forEach((b,i)=>{
   const rand=seeded(b.seed),x=b.x+b.w/2,z=b.y+b.h/2,ground=terrainY(x,z),floors=floorsOf(b),floorH=3.65,height=floors*floorH,w=b.w,d=b.h,residential=b.type==='villa'||b.type==='house'||b.type==='apartment'||b.style.includes('residential')||b.style.includes('estate'),airport=b.style==='airport-corridor',institution=['government','bank','hospital','university'].includes(b.type)||b.style==='modern-civic',palette=residential?cityPalettes.residential:institution?cityPalettes.institution:b.type==='warehouse'?cityPalettes.warehouse:b.type==='office'||floors>=7?cityPalettes.office:cityPalettes.shop,primary=palette[Math.floor(rand()*palette.length)],upperColor=palette[Math.floor(rand()*palette.length)],roofColor=roofPalette[residential?1:(b.roof||0)%roofPalette.length],trimColor=facadeTrim[Math.floor(rand()*facadeTrim.length)],highrise=floors>=7&&!residential&&b.type!=='warehouse',baseFloors=highrise?3:floors,baseHeight=baseFloors*floorH,upperFloors=floors-baseFloors,towerW=highrise?w*(.72+rand()*.12):w,towerD=highrise?d*(.7+rand()*.16):d,towerX=highrise?(rand()-.5)*w*.13:0,towerZ=highrise?d*.07:0;
   dummy.position.set(x,ground+.1,z);dummy.scale.set(w+14,.2,d+14);dummy.rotation.set(0,0,0);dummy.updateMatrix();pads.setMatrixAt(i,dummy.matrix);pads.setColorAt(i,color(residential?'#828b72':airport?'#777a75':institution?'#958d7b':'#918776'));
   dummy.position.set(x,ground+baseHeight/2,z);dummy.scale.set(w,baseHeight,d);dummy.rotation.set(0,0,0);dummy.updateMatrix();bodyLow.setMatrixAt(i,dummy.matrix);bodyLow.setColorAt(i,color(primary));
   if(highrise){dummy.position.set(x+towerX,ground+baseHeight+(height-baseHeight)/2,z+towerZ);dummy.scale.set(towerW,height-baseHeight,towerD);dummy.updateMatrix();bodyTower.setMatrixAt(i,dummy.matrix);bodyTower.setColorAt(i,color(upperColor))}else{dummy.position.set(0,-10000,0);dummy.scale.set(0,0,0);dummy.updateMatrix();bodyTower.setMatrixAt(i,dummy.matrix);bodyTower.setColorAt(i,color(primary))}
   const roofW=highrise?towerW:w,roofD=highrise?towerD:d,roofX=x+towerX,roofZ=z+towerZ;dummy.position.set(roofX,ground+height+.36,roofZ);dummy.scale.set(roofW+2.6,.72,roofD+2.6);dummy.updateMatrix();roof.setMatrixAt(i,dummy.matrix);roof.setColorAt(i,color(roofColor));
   // Low homes receive varied raised roof caps; commercial blocks get stepped rooftop forms.
   const pitched=residential&&floors<=2&&rand()>.35,roofPavilion=!residential&&!highrise&&floors>=3&&rand()>.62;
   if(pitched||roofPavilion){dummy.position.set(roofX+(rand()-.5)*roofW*.12,ground+height+(pitched?.8:1.25),roofZ);dummy.scale.set(Math.max(12,roofW*.68),pitched?3.2:2.2,Math.max(10,roofD*.7));dummy.rotation.set(0,Math.PI/4,0);dummy.updateMatrix();roofFeatures.setMatrixAt(roofFeatureIndex,dummy.matrix);roofFeatures.setColorAt(roofFeatureIndex++,color(pitched?roofColor:'#59656a'))}
   const parapetH=highrise?1.1:.72;for(const side of [-1,1]){dummy.position.set(roofX,ground+height+parapetH/2,roofZ+side*(roofD/2+1));dummy.scale.set(roofW+2,parapetH,.42);dummy.updateMatrix();parapets.setMatrixAt(parapetIndex++,dummy.matrix);parapets.setColorAt(parapetIndex-1,color(trimColor));dummy.position.set(roofX+side*(roofW/2+1),ground+height+parapetH/2,roofZ);dummy.scale.set(.42,parapetH,roofD+2);dummy.updateMatrix();parapets.setMatrixAt(parapetIndex++,dummy.matrix);parapets.setColorAt(parapetIndex-1,color(trimColor))}
   // Rooftop water tanks and HVAC boxes break up the repeated roof silhouette.
   for(let k=0;k<2;k++){const ux=roofX+(rand()-.5)*roofW*.48,uz=roofZ+(rand()-.5)*roofD*.42;dummy.position.set(ux,ground+height+1.2+k*.35,uz);dummy.scale.set(k===0?Math.min(5,w*.14):Math.min(3.2,w*.1),k===0?2.4:1.35,k===0?Math.min(4,d*.15):Math.min(3,d*.1));dummy.updateMatrix();units.setMatrixAt(unitIndex++,dummy.matrix);units.setColorAt(unitIndex-1,color(k===0?'#9b9b8c':'#768187'))}
   const faces=[];
   for(let f=0;f<floors;f++){
    const upper=highrise&&f>=baseFloors,fw=upper?towerW:w,fd=upper?towerD:d,fx=x+(upper?towerX:0),fz=z+(upper?towerZ:0),fy=ground+f*floorH+1.95,cols=Math.max(2,Math.ceil(fw/14)),rows=Math.max(2,Math.ceil(fd/14)),windowW=Math.min(4.1,(fw-10)/cols*.55),windowD=Math.min(4.1,(fd-10)/rows*.55),windowH=1.7;
    if(upper){const glassCols=Math.max(3,Math.ceil(fw/18)),glassRows=Math.max(3,Math.ceil(fd/18)),bayW=(fw-10)/glassCols,bayD=(fd-10)/glassRows,panelY=ground+f*floorH+floorH*.52,panelH=floorH*.63;for(let c=0;c<glassCols;c++){const px=fx-fw/2+5+(c+.5)*bayW;for(const side of [-1,1]){dummy.position.set(px,panelY,fz+side*(fd/2+.58));dummy.scale.set(bayW*.78,panelH,.24);dummy.updateMatrix();curtainPanels.setMatrixAt(curtainIndex,dummy.matrix);curtainPanels.setColorAt(curtainIndex++,color((c+f)%5===0?'#bad1d4':'#7698a7'))}}for(let c=0;c<glassRows;c++){const pz=fz-fd/2+5+(c+.5)*bayD;for(const side of [-1,1]){dummy.position.set(fx+side*(fw/2+.58),panelY,pz);dummy.scale.set(.24,panelH,bayD*.78);dummy.updateMatrix();curtainPanels.setMatrixAt(curtainIndex,dummy.matrix);curtainPanels.setColorAt(curtainIndex++,color((c+f)%4===0?'#b5c8ca':'#668692'))}}}
    for(let c=0;c<cols;c++){const wx=fx-fw/2+5+(c+.5)*(fw-10)/cols;for(const side of [-1,1])faces.push([wx,fy,fz+side*(fd/2+.23),windowW,windowH,.32,rand()>.31,true])}
    for(let c=0;c<rows;c++){const wz=fz-fd/2+5+(c+.5)*(fd-10)/rows;for(const side of [-1,1])faces.push([fx+side*(fw/2+.23),fy,wz,.32,windowH,windowD,rand()>.31,false])}
    if(f>0){const by=ground+f*floorH;for(const side of [-1,1]){dummy.position.set(fx,by,fz+side*(fd/2+.33));dummy.scale.set(fw,.2,.36);dummy.updateMatrix();bands.setMatrixAt(bandIndex,dummy.matrix);bands.setColorAt(bandIndex++,color(trimColor));dummy.position.set(fx+side*(fw/2+.33),by,fz);dummy.scale.set(.36,.2,fd);dummy.updateMatrix();bands.setMatrixAt(bandIndex,dummy.matrix);bands.setColorAt(bandIndex++,color(trimColor))}}
    if(residential&&f>0&&balconyIndex<balconyCapacity&&((!highrise&&f<=2)||(highrise&&f%2===0))){const bx=fx+(f%2?-.18:.18)*fw,bz=fz-fd/2-1.45,bw=Math.min(7.5,fw*.34);dummy.position.set(bx,ground+f*floorH+.3,bz);dummy.scale.set(bw,.32,2.8);dummy.updateMatrix();balconies.setMatrixAt(balconyIndex,dummy.matrix);dummy.position.set(bx,ground+f*floorH+1,bz-1.22);dummy.scale.set(bw,.78,.18);dummy.updateMatrix();balconyRails.setMatrixAt(balconyIndex++,dummy.matrix)}
   }
   // Recessed framed glazing, rather than painted-on window squares.
   for(const [wx,wy,wz,ww,wh,wd,lit,frontFace] of faces){const offsetX=frontFace?0:Math.sign(wx-x)*.19,offsetZ=frontFace?Math.sign(wz-z)*.19:0;dummy.position.set(wx,wy,wz);dummy.scale.set(frontFace?ww+.62:.32,wh+.62,frontFace?.32:wd+.62);dummy.updateMatrix();windowFrames.setMatrixAt(frameIndex,dummy.matrix);dummy.position.set(wx+offsetX,wy,wz+offsetZ);dummy.scale.set(frontFace?ww:.13,wh,frontFace?.13:wd);dummy.updateMatrix();if(lit)windowsOn.setMatrixAt(onIndex++,dummy.matrix);else windowsOff.setMatrixAt(offIndex++,dummy.matrix);frameIndex++}
   // Four subtle vertical piers and a deep shop canopy give each block a legible facade.
   const featureW=highrise?towerW:w,featureD=highrise?towerD:d,featureX=x+towerX,featureZ=z+towerZ;for(const sx of [-1,1])for(const sz of [-1,1]){dummy.position.set(featureX+sx*(featureW/2+.2),ground+height/2,featureZ+sz*(featureD/2+.2));dummy.scale.set(.36,height,.36);dummy.updateMatrix();fins.setMatrixAt(finIndex,dummy.matrix);fins.setColorAt(finIndex++,color(trimColor))}for(const sx of [-1,1])for(const sz of [-1,1]){dummy.position.set(featureX+sx*featureW*.25,ground+height/2,featureZ+sz*(featureD/2+.25));dummy.scale.set(.24,height,.26);dummy.updateMatrix();fins.setMatrixAt(finIndex,dummy.matrix);fins.setColorAt(finIndex++,color(trimColor))}
   if(['shop','market','restaurant','retail','club','hotel'].includes(b.type)){dummy.position.set(x,ground+3.65,z-d/2-1.05);dummy.scale.set(Math.min(w*.86,52),.62,2.4);dummy.updateMatrix();awnings.setMatrixAt(awningIndex,dummy.matrix);awnings.setColorAt(awningIndex++,color(['#bc8052','#637f84','#b88d55','#9b6b5d'][Math.floor(rand()*4)]))}
  });
  curtainPanels.count=curtainIndex;curtainPanels.instanceMatrix.needsUpdate=true;if(curtainPanels.instanceColor)curtainPanels.instanceColor.needsUpdate=true;
  for(const mesh of [pads,bodyLow,bodyTower,roof,roofFeatures,parapets,bands,fins,windowFrames,windowsOn,windowsOff,balconies,balconyRails,awnings,units])mesh.instanceMatrix.needsUpdate=true;
  for(const mesh of [pads,bodyLow,bodyTower,roof,roofFeatures,parapets,bands,fins,units,awnings])if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;
  parapets.count=parapetIndex;bands.count=bandIndex;fins.count=finIndex;windowFrames.count=frameIndex;windowsOn.count=onIndex;windowsOff.count=offIndex;balconies.count=balconyIndex;balconyRails.count=balconyIndex;awnings.count=awningIndex;units.count=unitIndex;
  roofFeatures.count=roofFeatureIndex;group.add(pads,bodyLow,bodyTower,roof,roofFeatures,parapets,bands,fins,windowFrames,windowsOff,windowsOn,balconies,balconyRails,awnings,units,curtainPanels);
 }
 function roundaboutAsset(group,r){const x=r.x,z=r.y,ground=terrainY(x,z),radius=r.radius||42,asphalt=new THREE.Mesh(new THREE.CylinderGeometry(radius,radius,.22,28),mats.road);asphalt.position.set(x,ground+.14,z);group.add(asphalt);const island=new THREE.Mesh(new THREE.CylinderGeometry(radius*.56,radius*.56,1.2,24),mats.park);island.position.set(x,ground+.72,z);group.add(island);const curb=new THREE.Mesh(new THREE.TorusGeometry(radius*.58,1.15,5,28),mats.roadEdge);curb.rotation.x=-Math.PI/2;curb.position.set(x,ground+1.36,z);group.add(curb);const lane=new THREE.InstancedMesh(boxGeometry(4,.12,.5),mats.white,20);for(let i=0;i<20;i++){const a=i/20*Math.PI*2;dummyRoundabout.position.set(x+Math.cos(a)*radius*.79,ground+.3,z+Math.sin(a)*radius*.79);dummyRoundabout.rotation.y=-a;dummyRoundabout.updateMatrix();lane.setMatrixAt(i,dummyRoundabout.matrix)}group.add(lane);for(let i=0;i<5;i++){const a=i/5*Math.PI*2,tx=x+Math.cos(a)*radius*.25,tz=z+Math.sin(a)*radius*.25;const shrub=new THREE.Mesh(new THREE.DodecahedronGeometry(2.8,0),mats.leaf2);shrub.position.set(tx,ground+3.5,tz);group.add(shrub)}if(r.monument){const pedestal=new THREE.Mesh(new THREE.CylinderGeometry(4,5,3,8),mats.concrete);pedestal.position.set(x,ground+2.8,z);group.add(pedestal);const spire=new THREE.Mesh(new THREE.ConeGeometry(2.2,12,7),mat('#d8ae4f',.46,.26));spire.position.set(x,ground+10,z);group.add(spire)} }
 const dummyRoundabout=new THREE.Object3D();
 // A raised, lit crossing carries the existing Jabi approach over the lake as a real 3D bridge.
 // Build only the part belonging to this terrain chunk so streaming and culling stay intact.
 function jabiLakeBridge(group,cx,cz){
  const x0=6200,x1=7220,z=1238,halfWidth=17;if(cz!==800||cx+chunkSize<=x0||cx>=x1)return;
  const start=Math.max(x0,cx),end=Math.min(x1,cx+chunkSize),span=end-start,segments=Math.ceil(span/18),deck=new THREE.InstancedMesh(boxGeometry(span/segments,.8,halfWidth*2),mat('#414b50',.83,.16),segments),lane=new THREE.InstancedMesh(boxGeometry(8,.09,.38),mats.line,Math.ceil(span/34)),rails=new THREE.InstancedMesh(boxGeometry(18,.32,.55),mat('#b8b8ad',.5,.55),Math.ceil(span/18)*2),dummy=new THREE.Object3D();let railIndex=0,laneIndex=0;
  const deckY=x=>terrainY(x,z)+8+5*Math.sin(Math.PI*(x-x0)/(x1-x0));
  for(let i=0;i<segments;i++){const x=start+(i+.5)*span/segments;dummy.position.set(x,deckY(x),z);dummy.updateMatrix();deck.setMatrixAt(i,dummy.matrix);for(const side of [-1,1]){dummy.position.set(x,deckY(x)+.45,z+side*(halfWidth-.4));dummy.updateMatrix();rails.setMatrixAt(railIndex++,dummy.matrix)}}
  for(let x=start+10;x<end-4;x+=34){dummy.position.set(x,deckY(x)+.47,z);dummy.updateMatrix();lane.setMatrixAt(laneIndex++,dummy.matrix)}deck.count=segments;rails.count=railIndex;lane.count=laneIndex;group.add(deck,lane,rails);
  const piers=new THREE.InstancedMesh(boxGeometry(7,1,8),mat('#8c908c',.75,.08),Math.ceil(span/110));let pierIndex=0;for(let x=Math.ceil(start/110)*110;x<end;x+=110){const ground=terrainY(x,z),top=deckY(x)-.45,height=Math.max(2,top-ground);dummy.position.set(x,ground+height/2,z);dummy.scale.set(1,height,1);dummy.updateMatrix();piers.setMatrixAt(pierIndex++,dummy.matrix)}piers.count=pierIndex;group.add(piers);
  const lamps=new THREE.InstancedMesh(boxGeometry(.5,7,.5),mat('#535e60',.58,.34),Math.ceil(span/150)*2),heads=new THREE.InstancedMesh(boxGeometry(3,.28,.7),mats.lamp,Math.ceil(span/150)*2);let lampIndex=0;for(let x=Math.ceil(start/150)*150;x<end;x+=150)for(const side of [-1,1]){dummy.position.set(x,deckY(x)+4,z+side*(halfWidth-3));dummy.updateMatrix();lamps.setMatrixAt(lampIndex,dummy.matrix);dummy.position.set(x+2,deckY(x)+7.5,z+side*(halfWidth-3));dummy.updateMatrix();heads.setMatrixAt(lampIndex++,dummy.matrix)}lamps.count=lampIndex;heads.count=lampIndex;group.add(lamps,heads);
 }
 function constructionSite(group,b){const lotW=188,lotD=152,site=new THREE.Group();site.position.set(b.x+b.w/2,terrainY(b.x,b.y),b.y+b.h/2);flat(site,0,.1,0,lotW,lotD,mat('#b58e5e'));flat(site,0,.32,0,lotW-12,lotD-12,mat('#c3a06a'));
  const fence=mat('#175968');for(const z of [-lotD/2+4,lotD/2-4])for(let x=-lotW/2+4;x<=lotW/2-4;x+=8){if(z>0&&Math.abs(x)<18)continue;box(site,x,.35,z,.65,2.4,.65,fence)}
  for(const x of [-lotW/2+4,lotW/2-4])for(let z=-lotD/2+4;z<=lotD/2-4;z+=8)box(site,x,.35,z,.65,2.4,.65,fence);
  for(const z of [-lotD/2+4,lotD/2-4]){const gap=z>0?18:0,start=-lotW/2+7,end=lotW/2-7;for(let x=start;x<end;x+=8){if(z>0&&x>=-gap&&x<=gap)continue;box(site,x+4,1,z,8,.18,.28,mat('#3c7881'));box(site,x+4,1.8,z,8,.16,.28,mat('#568a89'))}}
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
 function loadPremiumVehicle(){
  if(!premiumVehiclePromise)premiumVehiclePromise=new GLTFLoader().loadAsync(new URL('../assets/3d/vehicles/white-four-door-sedan.glb',import.meta.url).href).then(({scene:source})=>{
   source.updateMatrixWorld(true);const batches=new Map(),retained=new Set();
   source.traverse(object=>{if(!object.isMesh)return;const material=Array.isArray(object.material)?object.material[0]:object.material;if(!material)return;const geometry=object.geometry.clone().applyMatrix4(object.matrixWorld),signature=Object.keys(geometry.attributes).sort().map(key=>key+':'+geometry.attributes[key].itemSize).join(','),key=material.uuid+'|'+signature;if(!batches.has(key))batches.set(key,{material,geometries:[]});batches.get(key).geometries.push(geometry);retained.add(material)});
   const model=new THREE.Group();model.name='Innerscene CC0 white four-door sedan';model.userData.license='CC0';let meshCount=0;
   for(const batch of batches.values()){const geometry=batch.geometries.length===1?batch.geometries[0]:mergeGeometries(batch.geometries,false);if(!geometry){for(const item of batch.geometries){const mesh=new THREE.Mesh(item,batch.material);mesh.castShadow=false;model.add(mesh);meshCount++}continue}for(const item of batch.geometries)if(item!==geometry)item.dispose();geometry.computeBoundingBox();geometry.computeBoundingSphere();sharedGeometry.add(geometry);const mesh=new THREE.Mesh(geometry,batch.material);mesh.castShadow=false;mesh.receiveShadow=true;model.add(mesh);meshCount++}
   const bounds=new THREE.Box3().setFromObject(model),center=bounds.getCenter(new THREE.Vector3()),lift=-bounds.min.y+.035;for(const child of model.children){child.geometry.translate(-center.x,lift,-center.z);child.geometry.computeBoundingBox();child.geometry.computeBoundingSphere()}
   for(const material of retained){customMaterials.push(material);for(const value of Object.values(material)){if(value?.isTexture&&!textures.includes(value))textures.push(value)}}
   diagnostic('cc0-hero-vehicle-ready',{asset:'Innerscene white four-door sedan',meshes:meshCount,triangles:meshCount?model.children.reduce((n,o)=>n+(o.geometry.index?.count||o.geometry.attributes.position.count)/3,0):0,license:'CC0'});
   return model
  }).catch(error=>{premiumVehiclePromise=null;diagnostic('cc0-hero-vehicle-failed',{message:error?.message||String(error)});throw error});
  return premiumVehiclePromise
 }
 function showroomModel(){
  const site=G.world.carDealership,show=site.showroom,w=show.w,d=show.d;
  const g=new THREE.Group(),black=applyPbr(new THREE.MeshStandardMaterial({color:'#fff'}),dealerMetalPbr,{roughness:.42,metalness:.5,bumpScale:.018}),charcoal=applyPbr(new THREE.MeshStandardMaterial({color:'#fff'}),dealerMetalPbr,{roughness:.48,metalness:.42,bumpScale:.014}),panel=applyPbr(new THREE.MeshStandardMaterial({color:'#fff'}),dealerMetalPbr,{roughness:.38,metalness:.58,bumpScale:.012}),stone=applyPbr(new THREE.MeshStandardMaterial({color:'#fff'}),dealerStonePbr,{roughness:.78,metalness:.08,bumpScale:.04}),brass=mat('#d5a84d',.35,.56),lit=mat('#f5c46d',.5,.12);
  // Showroom glazing stays readable after dark while retaining tinted reflections in daylight.
  const glass=new THREE.MeshPhysicalMaterial({color:'#b8d8df',roughness:.16,metalness:.16,clearcoat:.92,clearcoatRoughness:.12,transparent:true,opacity:.56,depthWrite:false,emissive:'#ffbf65',emissiveIntensity:.68,side:THREE.DoubleSide});
  const interiorGlow=new THREE.MeshStandardMaterial({color:'#ffe7b3',roughness:.38,emissive:'#ffb84f',emissiveIntensity:3.2});
  customMaterials.push(glass,interiorGlow);flat(g,0,.06,0,w+18,d+18,stone);
  // Connected wings and an elevated central sign tower give the showroom a varied, multi-level silhouette.
  // Keep the showroom volume genuinely open behind the curtain wall: opaque box cores
  // here hid the display inventory and made the glass read as a black box from gameplay.
  for(const x of [-w*.475,w*.475])for(const side of [-1,1]){
   box(g,x,12.2,side*d*.49,1.4,23,1.6,panel);
  }
  // Rear service cores frame the open display floor without blocking cars from the street view.
  for(const x of [-w*.34,w*.34])box(g,x,9.4,d*.34,w*.12,18.4,d*.12,charcoal);
  box(g,-w*.40,18,d*.18,w*.16,11,d*.42,panel);
  box(g,w*.40,20,d*.10,w*.15,14,d*.44,panel);
  box(g,0,27.4,-d*.02,w*.34,8,d*.35,black);
  // Full-height glazing is split into realistic bays, with warm interior volume behind it.
  for(let level=0;level<3;level++){
   const y=1.0+level*7.25;
   for(const side of [-1,1]){
    box(g,0,y,side*d*.505,w*.91,5.75,.34,glass);
    box(g,0,y+5.95,side*d*.51,w*.94,.42,.62,black);
    for(let x=-w*.445;x<=w*.445;x+=w*.071)box(g,x,y,side*d*.525,.55,6.05,.58,panel);
   }
  }
  for(const side of [-1,1]){
   for(const x of [-w*.475,w*.475])box(g,x,.4,side*d*.51,2.8,23,1.7,stone);
   box(g,0,.42,side*d*.545,w*.96,2.5,5.5,black);
   for(const x of [-w*.17,0,w*.17]){box(g,x,.46,side*d*.57,1.5,8.8,1.4,brass);box(g,x,.35,side*d*.59,15,2.4,.7,glass)}
  }
  for(let level=0;level<3;level++){
   const y=1+level*7.25;
   for(const side of [-1,1]){box(g,side*w*.5,y,0,.34,5.75,d*.52,glass);box(g,side*w*.505,y+5.95,0,.62,.42,d*.56,black);for(let z=-d*.25;z<=d*.25;z+=d*.13)box(g,side*w*.525,y,z,.58,6.05,.5,panel)}
  }
  // Visible reception, display dais and lighting continue behind the glass.
  box(g,-w*.12,.5,d*.16,w*.24,1.15,5,stone);
  // A deep porte-cochere and framed glass doors mark the customer entrance.
  box(g,0,9.15,-d*.60,w*.48,.75,17,black);box(g,0,9.57,-d*.60,w*.43,.16,15,brass);
  for(const x of [-w*.205,w*.205]){box(g,x,4.55,-d*.60,1.05,8.6,1.05,stone);box(g,x,9.65,-d*.60,1.4,.22,1.4,interiorGlow)}
  box(g,0,4.05,-d*.55,w*.15,6.9,.34,glass);for(const x of [-w*.075,0,w*.075])box(g,x,4.05,-d*.565,.18,6.7,.5,brass);
  box(g,0,.55,-d*.585,w*.27,.6,9,stone);

  // Glowing ceiling ribbons and floor washes keep showroom inventory legible through glass at night.
  for(const z of [-d*.34,-d*.12,d*.12,d*.34]){box(g,0,19.2,z,w*.82,.22,.8,interiorGlow);box(g,0,.34,z,w*.84,.12,2.4,interiorGlow);box(g,0,8.1,z,w*.78,.18,.65,interiorGlow);}
  for(let row=0;row<2;row++)for(let i=0;i<3;i++){
   const px=(i-1)*w*.19,pz=-d*.25+row*d*.20;
   if(row===0&&i===0){const slot=new THREE.Group();slot.name='CC0 hero vehicle display';slot.position.set(px,0,pz);g.add(slot);const fallback=carModel(slot,0,0,'#e5e1d5','sedan',false,true);loadPremiumVehicle().then(model=>{if(!slot.parent)return;fallback.removeFromParent();const display=model.clone(true);display.scale.setScalar(1.45);slot.add(display)}).catch(()=>{});continue}
   const car=carModel(g,px,pz,['#111820','#e7e1d4','#a9312c','#334954','#776c55','#e3dfd5'][row*3+i],i===2?'sport':i===1?'sedan':'suv',false,true);
   car.rotation.y=(i-1)*.09;car.scale.setScalar(1.6);
   const uplight=new THREE.PointLight('#ffd08a',16,34);uplight.position.set(-w*.31+i*w*.145,7,-d*.18+row*d*.26);g.add(uplight);
  }
  for(const x of [-w*.32,0,w*.32]){const planter=new THREE.Mesh(new THREE.CylinderGeometry(2.3,3.1,1.8,10),mat('#5e584f'));planter.position.set(x,1.2,d*.25);g.add(planter);const plant=new THREE.Mesh(new THREE.ConeGeometry(3.4,8.5,7),mats.leaf);plant.position.set(x,5.8,d*.25);g.add(plant)}
  box(g,0,29.9,-d*.05,w*.45,1.1,d*.4,black);box(g,0,30.7,-d*.05,w*.39,.28,d*.32,brass);
  for(const face of [-1,1]){
   box(g,0,24.4,face*d*.585,w*.46,11,.8,black);
   const sign=label('ABUJACAR','#0f1519','#fff8e4',34);sign.scale.set(82,15,1);sign.position.set(0,25.2,face*(d*.61));g.add(sign);
   const sub=label('CAR DEALERSHIP','#161b20','#f3c258',21);sub.scale.set(58,7,1);sub.position.set(0,18.2,face*(d*.61));g.add(sub);
  }
  const side=label('SALES  ·  BUY  ·  SELL  ·  TRADE-IN  ·  FINANCE','#171c20','#f8e6b6',16);side.scale.set(48,10,1);side.position.set(-w*.435,13.5,-d*.56);g.add(side);
  for(const x of [-w*.36,-w*.12,w*.12,w*.36]){const down=new THREE.PointLight('#ffd78e',32,58);down.position.set(x,25,-d*.42);g.add(down)}
  return g;
 }
 function dealership(group,b){
  const root=new THREE.Group(),site=G.world.carDealership,lot=site.lot,cx=lot.x+lot.w/2,cz=lot.y+lot.h/2;
  root.position.set(cx,terrainY(cx,cz),cz);root.rotation.y=Number(b.rotation)||0;root.scale.setScalar(Number(b.scale)||1);
  const paving=applyPbr(new THREE.MeshStandardMaterial({color:'#fff'}),dealerPavingPbr,{roughness:.9,metalness:.02,bumpScale:.06}),drive=mat('#454b4f'),edge=mat('#d4c8ad'),fence=mat('#1e272b',.58,.42),stone=applyPbr(new THREE.MeshStandardMaterial({color:'#fff'}),dealerStonePbr,{roughness:.78,metalness:.08,bumpScale:.04}),metal=applyPbr(new THREE.MeshStandardMaterial({color:'#fff'}),dealerMetalPbr,{roughness:.48,metalness:.48,bumpScale:.02}),yellow=mat('#e3b84c'),white=mat('#f0eee4'),warm=mat('#f7cb82');
  flat(root,0,.08,0,lot.w+34,lot.h+38,mat('#7a806f'));flat(root,0,.22,0,lot.w,lot.h,paving);
  // The boulevard-facing apron links the forecourt to the existing Idu service road.
  flat(root,0,.3,-lot.h/2-18,lot.w-42,34,drive);flat(root,0,.37,-lot.h/2-35,lot.w-24,4,edge);
  for(let x=-lot.w*.43;x<lot.w*.44;x+=48)flat(root,x,.42,-lot.h/2-18,25,1.1,white);
  // Perimeter fence: open only at the two controlled entry lanes.
  function fenceRun(horizontal,position,start,end){
   for(let p=start;p<=end;p+=10){
    const gate=horizontal&&position<0&&p>-31&&p<31;if(gate)continue;
    const x=horizontal?p:position,z=horizontal?position:p;box(root,x,.32,z,.58,2.8,.58,fence);
    if(Math.abs(p%40)<1)box(root,x,.32,z,3.4,5.4,3.4,stone);
    if(p+10>end)break;
   }
   for(let p=start;p<end;p+=10){
    const gate=horizontal&&position<0&&p>-31&&p<31;if(gate)continue;
    const x=horizontal?p+5:position,z=horizontal?position:p+5;box(root,x,1.22,z,horizontal?9.8:.18,.16,horizontal?.18:9.8,metal);box(root,x,2.14,z,horizontal?9.8:.16,.16,horizontal?.16:9.8,metal);
   }
  }
  fenceRun(true,-lot.h/2,-lot.w/2+5,lot.w/2-5);fenceRun(true,lot.h/2,-lot.w/2+5,lot.w/2-5);fenceRun(false,-lot.w/2,-lot.h/2+5,lot.h/2-5);fenceRun(false,lot.w/2,-lot.h/2+5,lot.h/2-5);
  const showroom=site.showroom,model=showroomModel();model.position.set(showroom.x-cx,.4,showroom.y-cz);root.add(model);
  // Service wing is an independent black-and-glass architectural volume.
  const sb=site.workshop,sx=sb.x-cx,sz=sb.y-cz,serviceGlass=new THREE.MeshStandardMaterial({color:'#9acbd2',roughness:.18,metalness:.1,transparent:true,opacity:.52,emissive:'#e6a456',emissiveIntensity:.18});customMaterials.push(serviceGlass);
  flat(root,sx,.34,sz,sb.w+12,sb.d+12,mat('#6d706b'));box(root,sx,.42,sz,sb.w,13,sb.d,mat('#20282c',.42,.36));box(root,sx,.9,sz-sb.d*.51,sb.w*.84,8,.35,serviceGlass);box(root,sx,13.6,sz,sb.w+8,.85,sb.d+8,mat('#161c20',.42,.35));
  for(let x=sx-sb.w*.37;x<sx+sb.w*.4;x+=sb.w*.18)box(root,x,.5,sz-sb.d*.53,.55,8.8,.6,metal);
  const service=label('ABUJACAR  ·  SERVICE & DETAILING','#182027','#f4d18a',19);service.scale.set(42,6,1);service.position.set(sx,10.5,sz-sb.d*.56);root.add(service);
  // Security booth, IN/OUT lanes, gates and illuminated frontage pylons.
  const gateZ=-lot.h/2+18;
  for(const x of [-34,34]){box(root,x,.42,gateZ,3.2,5.8,3.8,stone);const beacon=new THREE.PointLight('#ffd487',12,24);beacon.position.set(x,7,gateZ);root.add(beacon)}
  box(root,-93,.42,gateZ+12,14,4.6,12,mat('#d4cab8'));box(root,-93,1.2,gateZ+6,10,2.2,.3,serviceGlass);box(root,-93,5.2,gateZ+12,16,.5,13,mat('#252d30'));
  for(const [x,name,dir] of [[-20,'IN  →',-.14],[20,'OUT  ←',.14]]){const marker=label(name,'#172126','#f5c44e',20);marker.scale.set(20,6,1);marker.position.set(x,4.8,gateZ-2);root.add(marker);const arm=box(root,x,2.3,gateZ+7,18,.3,.42,white);arm.rotation.y=dir}
  const pylon=label('ABUJACAR\nSALES  ·  BUY  ·  SELL','#11171b','#fff0c5',20);pylon.scale.set(40,12,1);pylon.position.set(-lot.w*.38,9,-lot.h*.47);root.add(pylon);
  // Marked customer forecourt and front display spaces.
  function bay(x,z,wide=false){const bw=wide?12:9,bd=wide?19:14;for(const dx of [-bw/2,bw/2])box(root,x+dx,.43,z,.18,.05,bd,yellow);box(root,x,.43,z+bd/2,.18,.05,bw,yellow)}
  for(const x of [-100,-60,-20,20,60,100])bay(x,30,true);
  for(const z of [25,60])for(const x of [-142,-118,118,142])bay(x,z,true);
  for(const x of [-142,-118,118,142])bay(x,112,false);
  // Two covered display courts flank the arrival forecourt and shelter the premium stock.
  for(const [i,x] of [[0,-160],[1,160]]){
   const z=47;flat(root,x,.4,z,58,78,mat('#5b5f5d'));for(const dx of [-26,26])for(const dz of [-34,34])box(root,x+dx,.42,z+dz,.72,6.6,.72,metal);
   box(root,x,6.8,z,62,.7,84,mat('#596266',.42,.38));box(root,x,7.25,z,58,.16,80,mat('#a7afb0',.26,.22));
   const canopy=label(i===0?'PREMIUM SUV DISPLAY':'EXECUTIVE COLLECTION','#1b2429','#f3cd75',15);canopy.scale.set(38,5,1);canopy.position.set(x,7.6,z-37);root.add(canopy);
   const down=new THREE.PointLight('#ffd18b',42,58);down.position.set(x,6,z);root.add(down);
  }
  // All inventory uses the shared reusable 3D vehicle geometry.
  (site.cars||[]).forEach((car,i)=>{if(car.interior)return;const px=car.x-cx,pz=car.y-cz,vehicle=carModel(root,px,pz,car.color,car.kind,false,true);vehicle.rotation.y=(i%5===0?Math.PI/2:i%3===0?-.08:.08);vehicle.scale.setScalar(1.55);bay(px,pz,car.kind==='suv')});
  // Planned planting beds, palms, lamps, and low landscape illumination.
  function palm(x,z,scale=1){box(root,x,.35,z,.8,7*scale,.8,mats.trunk);for(let arm=0;arm<6;arm++){const leaf=new THREE.Mesh(new THREE.ConeGeometry(1.25*scale,7*scale,5),mats.leaf2);leaf.position.set(x+Math.cos(arm*Math.PI/3)*3.2*scale,7.8*scale,z+Math.sin(arm*Math.PI/3)*3.2*scale);leaf.rotation.z=.75;leaf.rotation.x=.55;root.add(leaf)}}
  function lamp(x,z){box(root,x,.35,z,.65,8,.65,mat('#263136'));box(root,x,8.3,z,2.5,.45,2.5,mat('#d9d2bd'));const lampGlass=new THREE.MeshStandardMaterial({color:'#fff0c4',emissive:'#ffbc57',emissiveIntensity:2.4});customMaterials.push(lampGlass);box(root,x,8.3,z,2.2,.48,2.2,lampGlass);const light=new THREE.PointLight('#ffd38a',28,62);light.position.set(x,9,z);root.add(light)}
  for(const [x,z] of [[-150,-112],[-90,-112],[90,-112],[150,-112],[-153,123],[-92,123],[92,123],[153,123]])palm(x,z,.9);
  for(const [x,z] of [[-162,-84],[-62,-84],[62,-84],[162,-84],[-162,120],[-62,120],[62,120],[162,120]])lamp(x,z);
  addRealPlantInstances(root,[...[-148,-92,-36,36,92,148].map((x,i)=>({x,z:-lot.h*.47+(i%2)*5,rotation:i*.55,scale:.29+(i%3)*.035})),...[-148,-92,-36,36,92,148].map((x,i)=>({x,z:lot.h*.46-(i%2)*5,rotation:i*.42,scale:.28+(i%2)*.04})),...[-94,-35,35,94].flatMap((z,i)=>[{x:-lot.w*.46,z,rotation:i*.5,scale:.29},{x:lot.w*.46,z,rotation:i*.65,scale:.3}])]);
  for(const [x,z] of [[-154,4],[-154,54],[-78,84],[78,84],[154,54],[154,4]]){const planter=new THREE.Mesh(new THREE.CylinderGeometry(2.2,2.8,.9,10),mat('#6a665b'));planter.position.set(x,.85,z);root.add(planter);const shrub=new THREE.Mesh(new THREE.SphereGeometry(2.7,8,6),mats.leaf);shrub.position.set(x,3,z);root.add(shrub)}
  const welcome=label('ABUJACAR  ·  LUXURY VEHICLES','#111a20','#fff7df',24);welcome.scale.set(62,10,1);welcome.position.set(0,7,-lot.h*.51);root.add(welcome);
  root.userData.type='dealer';root.userData.name='ABUJACAR luxury dealership';group.add(root);return root;
 } function carStand(group,b){const w=Math.max(168,b.w+52),d=Math.max(132,b.h+40),root=new THREE.Group(),ground=terrainY(b.x+b.w/2,b.y+b.h/2);root.position.set(b.x+b.w/2,ground,b.y+b.h/2);flat(root,0,.05,0,w,d,mat('#3e484b'));flat(root,0,.22,0,w-8,d-8,mat('#70716b'));flat(root,0,.38,d*.25,w-16,d*.35,mat('#50585a'));
  const facade=mat('#343b3e',.42,.35),glass=new THREE.MeshStandardMaterial({color:'#a9d4d8',roughness:.2,metalness:.08,transparent:true,opacity:.54}),sign=label(b.name.toUpperCase(),'#171b1e','#f7df9b',24);customMaterials.push(glass);box(root,0,.55,-d*.29,w*.72,13,d*.22,facade);box(root,0,1.4,-d*.405,w*.65,8,.3,glass);for(let x=-w*.34;x<=w*.34;x+=w*.17)box(root,x,1.5,-d*.41,.45,8,.45,mat('#242a2d',.45,.25));box(root,0,13.7,-d*.29,w*.75,.8,d*.24,mat('#202528',.45,.3));sign.scale.set(w*.52,12,1);sign.position.set(0,10.5,-d*.42);root.add(sign);
  for(const [i,x] of [-w*.3,-w*.1,w*.1,w*.3].entries()){const z=d*.03;for(const dx of [-13,13])box(root,x+dx,.38,z,.22,.08,27,mat('#d6b04d'));for(const dz of [-11,11])box(root,x,.38,z+dz,25,.08,.22,mat('#d6b04d'));box(root,x,7.2,z,28,.5,25,mat(i%2?'#535b5e':'#747877',.42,.28));for(const dx of [-13,13])for(const dz of [-11,11])box(root,x+dx,.4,z+dz,.28,6.8,.28,mat('#4c5558',.45,.4));box(root,x,6.9,z,28,.42,25,mat('#647174',.34,.34));}
  const kinds=['suv','sedan','sport','suv','sedan','suv'],paints=['#151a20','#e0ded6','#a53931','#455866','#d0ad6b','#192a37'];kinds.forEach((kind,i)=>{const x=(i%3-1)*w*.27,z=i<3?-d*.02:d*.34;carModel(root,x,z,paints[i],kind,false,true)});
  for(const x of [-w*.45,w*.45])for(const z of [-d*.38,d*.38]){box(root,x,.3,z,1,6,1,mat('#30393b'));const lamp=new THREE.PointLight('#ffd28c',14,34);lamp.position.set(x,7,z);root.add(lamp)}
  box(root,-w*.34,.2,d*.44,2,4,2,mat('#a99d86'));box(root,w*.34,.2,d*.44,2,4,2,mat('#a99d86'));const gate=label('SALES  ·  BUY  ·  SELL  ·  TRADE-IN','#20262a','#f3d88e',16);gate.scale.set(40,8,1);gate.position.set(0,3,d*.47);root.add(gate);group.add(root);return root}
 function restaurantProperty(group,b){const w=Math.max(104,b.w+38),d=Math.max(82,b.h+34),root=new THREE.Group();root.position.set(b.x+b.w/2,terrainY(b.x+b.w/2,b.y+b.h/2),b.y+b.h/2);const club=b.type==='club',wall=club?mat('#29343d',.68,.08):applyPbr(new THREE.MeshStandardMaterial({color:'#fff'}),dealerStonePbr,{roughness:.8,metalness:.04,normalScale:.18}),roof=mat(club?'#25313b':'#393f3e',.48,.2),glass=new THREE.MeshStandardMaterial({color:club?'#a7d5da':'#f4ca7f',roughness:.2,metalness:.04,emissive:'#f4a74a',emissiveIntensity:.34,transparent:true,opacity:.72});customMaterials.push(glass);flat(root,0,.04,0,w,d,mat('#c9b68e'));flat(root,0,.24,-d*.05,w-6,d*.82,mat('#ddd0b9'));box(root,0,.4,-d*.18,w*.76,8,d*.48,wall);box(root,0,4.6,-d*.426,w*.68,4.9,.32,glass);for(let x=-w*.31;x<=w*.31;x+=w*.155)box(root,x,4.6,-d*.44,.42,5.2,.5,mat('#352f2b'));
  box(root,0,9,-d*.17,w*.82,.8,d*.55,roof);for(const x of [-w*.37,w*.37])box(root,x,.4,-d*.17,1,9,1,mat('#c4ad87'));const sign=label(b.name.toUpperCase(),club?'#24303b':'#362a25','#ffe7b1',22);sign.scale.set(Math.min(75,w*.66),11,1);sign.position.set(0,8,-d*.47);root.add(sign);
  const patioZ=d*.29;flat(root,0,.26,patioZ,w*.86,d*.3,mat('#b8996e'));for(let x=-w*.32;x<=w*.32;x+=w*.32){for(let z of [patioZ-d*.08,patioZ+d*.08]){const table=new THREE.Mesh(new THREE.CylinderGeometry(3.3,3.3,.42,10),mat('#574538'));table.position.set(x,1.2,z);root.add(table);box(root,x,.3,z,1.3,1.5,1.3,mat('#59493b'));for(const side of [-1,1])box(root,x+side*4,.25,z,1,.9,1,mat('#675646'))}}
  for(const x of [-w*.42,w*.42]){box(root,x,.3,patioZ,2,3,2,mat('#b89a73'));const tree=new THREE.Mesh(new THREE.ConeGeometry(3.2,8,6),mats.leaf);tree.position.set(x,7,patioZ);root.add(tree)}for(const x of [-w*.37,w*.37]){const lamp=new THREE.PointLight('#ffc979',10,25);lamp.position.set(x,8,-d*.22);root.add(lamp)}group.add(root);return root}
 function fashionFlagship(group,b){const w=Math.max(180,b.w),d=Math.max(116,b.h),root=new THREE.Group();root.position.set(b.x+b.w/2,terrainY(b.x+b.w/2,b.y+b.h/2),b.y+b.h/2);flat(root,0,.04,0,w+36,d+32,mat('#b7aa91'));flat(root,0,.22,0,w+20,d+16,mat('#313538'));const black=mat('#161b20',.38,.32),brass=mat('#c69a48',.4,.5),glass=new THREE.MeshStandardMaterial({color:'#bbdfe2',roughness:.12,metalness:.12,transparent:true,opacity:.42}),inside=mat('#bd9b70',.7,.1);customMaterials.push(glass);box(root,0,.42,0,w,14,d,black);box(root,0,1.5,-d*.503,w*.88,11,.24,glass);for(let x=-w*.44;x<=w*.44;x+=w*.11)box(root,x,1.4,-d*.51,.5,11,.55,brass);box(root,0,14.9,0,w+5,1.1,d+5,black);box(root,0,15.6,0,w-16,.5,d-16,brass);box(root,0,14.25,-d*.53,w*.96,.36,.8,brass);
  const name=label('DEVOLT MOULD  ·  ABUJA','#12171c','#f3c46c',30);name.scale.set(w*.6,13,1);name.position.set(0,12.3,-d*.54);root.add(name);flat(root,0,.48,d*.33,w*.62,d*.25,inside);for(let row=0;row<2;row++)for(let col=0;col<5;col++){const x=(col-2)*w*.095,z=d*.25+row*d*.12;box(root,x,.5,z,2.5,4.5,1.4,brass);box(root,x,.7,z,4.7,.26,2.8,mat(['#a14138','#347b73','#d29b36','#293e64','#dfd1b5'][(col+row)%5]));box(root,x,.45,z+3,4,.6,1.2,inside)}for(let i=0;i<4;i++){const light=new THREE.PointLight('#ffcf88',13,36);light.position.set((i-1.5)*w*.23,11,-d*.22);root.add(light)}for(const x of [-w*.34,w*.34]){box(root,x,.34,-d*.55,1.5,5,1.5,mat('#c3ad87'));const planter=new THREE.Mesh(new THREE.CylinderGeometry(2,2.6,1.5,8),mat('#55534b'));planter.position.set(x,1.2,-d*.62);root.add(planter);const plant=new THREE.Mesh(new THREE.ConeGeometry(2.5,7,6),mats.leaf);plant.position.set(x,5.4,-d*.62);root.add(plant)}group.add(root);return root}
 function airportTerminal(group,b){const w=Math.max(620,b.w+120),d=Math.max(420,b.h+100),root=new THREE.Group();root.position.set(b.x+b.w/2,terrainY(b.x+b.w/2,b.y+b.h/2),b.y+b.h/2);flat(root,0,.04,0,w,d,mat('#555d61'));flat(root,0,.2,0,w-12,d-12,mat('#687276'));const terminalW=w*.67,terminalD=d*.3,glass=new THREE.MeshStandardMaterial({color:'#a7d4dc',roughness:.16,metalness:.08,transparent:true,opacity:.6,emissive:'#ffc979',emissiveIntensity:.24}),concrete=applyPbr(new THREE.MeshStandardMaterial({color:'#fff'}),dealerStonePbr,{roughness:.76,metalness:.06,normalScale:.2}),roof=mat('#53616a',.48,.4);customMaterials.push(glass);box(root,0,.45,-d*.22,terminalW,17,terminalD,concrete);box(root,0,2,-d*.22,terminalW-12,11,1,glass);for(let x=-terminalW*.46;x<terminalW*.5;x+=17)box(root,x,1.5,-d*.235,.6,12,1.2,mat('#435158',.38,.35));box(root,0,17.7,-d*.22,terminalW+16,1.1,terminalD+10,roof);const front=label('NNAMDI AZIKIWE  ·  INTERNATIONAL AIRPORT','#27333a','#f7e3aa',26);front.scale.set(112,15,1);front.position.set(0,15,-d*.39);root.add(front);
  box(root,terminalW*.42,.4,-d*.34,30,35,28,mat('#a99e8a'));box(root,terminalW*.42,34,-d*.34,34,2,32,mat('#525e64'));for(const y of [13,23,33]){box(root,terminalW*.42,y,-d*.34,31,.65,29,mat('#727c7e'))}const runway=mat('#333b40'),stripe=mat('#ece9dc');flat(root,0,.28,d*.16,w*.93,48,runway);for(let x=-w*.43;x<w*.44;x+=36)flat(root,x,.42,d*.16,18,1.1,stripe);for(const x of [-w*.39,w*.39])for(const z of [d*.16-22,d*.16+22]){const lamp=new THREE.PointLight('#ffcc79',7,35);lamp.position.set(x,3,z);root.add(lamp)}
  function plane(x,z,scale,paint){const p=new THREE.Group();p.position.set(x,.5,z);p.scale.setScalar(scale);const body=new THREE.Mesh(new THREE.CylinderGeometry(2.15,2.15,32,10),mat(paint,.36,.35));body.rotation.z=Math.PI/2;p.add(body);box(p,-1,0,0,13,.42,27,mat('#b5c1c5',.42,.48));box(p,-14,0,0,6,.3,9,mat('#cad0d0',.4,.48));box(p,-13,2.5,0,5,5,1.4,mat(paint,.35,.35));for(const xw of [-9,10])for(const zw of [-2.2,2.2]){const wheel=new THREE.Mesh(wheelGeometry,mats.dark);wheel.rotation.z=Math.PI/2;wheel.position.set(xw,-1.2,zw);p.add(wheel)}root.add(p)}plane(-w*.3,d*.16,.8,'#e7e6df');plane(w*.27,d*.16,.92,'#315f86');for(const x of [-w*.4,w*.4])for(const z of [-d*.4,d*.43]){const palm=new THREE.Mesh(new THREE.CylinderGeometry(.6,.9,8,6),mats.trunk);palm.position.set(x,4,z);root.add(palm);const crown=new THREE.Mesh(new THREE.ConeGeometry(3.2,7,6),mats.leaf);crown.position.set(x,10,z);root.add(crown)}group.add(root);return root}
 function nationalMosque(group,b){const w=b.w+72,d=b.h+72,root=new THREE.Group();root.position.set(b.x+b.w/2,terrainY(b.x+b.w/2,b.y+b.h/2),b.y+b.h/2);flat(root,0,.05,0,w,d,mat('#aeb99c'));flat(root,0,.22,0,w-22,d-22,mat('#d4c8ad'));const stone=applyPbr(new THREE.MeshStandardMaterial({color:'#fff'}),dealerStonePbr,{roughness:.78,metalness:.04,normalScale:.16}),shadow=mat('#87949a',.48,.34),gold=mat('#d8ae58',.36,.5),glass=new THREE.MeshStandardMaterial({color:'#90b8c4',roughness:.2,metalness:.15,transparent:true,opacity:.62});customMaterials.push(glass);box(root,0,.35,0,w*.58,18,d*.43,stone);box(root,0,3,-d*.22,w*.5,11,.28,glass);for(let x=-w*.23;x<=w*.24;x+=w*.12)box(root,x,.4,-d*.225,.8,11,.8,shadow);box(root,0,18,0,w*.62,1.2,d*.47,shadow);const dome=new THREE.Mesh(new THREE.SphereGeometry(w*.15,20,12,0,Math.PI*2,0,Math.PI/2),gold);dome.position.set(0,19,0);root.add(dome);const finial=new THREE.Mesh(new THREE.ConeGeometry(2.5,9,8),gold);finial.position.set(0,19+w*.15+4.5,0);root.add(finial);for(const x of [-w*.28,w*.28])for(const z of [-d*.27,d*.27]){const shaft=new THREE.Mesh(new THREE.CylinderGeometry(2.4,3.4,48,8),stone);shaft.position.set(x,24,z);root.add(shaft);for(const y of [10,25,39]){const balcony=new THREE.Mesh(new THREE.CylinderGeometry(4.8,4.8,1.3,8),gold);balcony.position.set(x,y,z);root.add(balcony)}const spire=new THREE.Mesh(new THREE.ConeGeometry(2.5,11,8),gold);spire.position.set(x,53.5,z);root.add(spire)}const sign=label('ABUJA NATIONAL MOSQUE','#25323a','#f7e4b6',22);sign.scale.set(72,12,1);sign.position.set(0,25,-d*.49);root.add(sign);group.add(root);return root}
 function retailComplex(group,b){
  const w=Math.max(245,b.w+54),d=Math.max(176,b.h+48),root=new THREE.Group();root.position.set(b.x+b.w/2,terrainY(b.x+b.w/2,b.y+b.h/2),b.y+b.h/2);
  const lawn=mat('#8faf7d'),paving=mat('#bdb7a6'),stone=applyPbr(new THREE.MeshStandardMaterial({color:'#fff'}),dealerStonePbr,{roughness:.74,metalness:.05,normalScale:.18}),dark=mat('#303a40',.45,.24),metal=mat('#59666a',.38,.48),glass=new THREE.MeshStandardMaterial({color:'#9acbd3',roughness:.19,metalness:.13,transparent:true,opacity:.64}),lit=new THREE.MeshStandardMaterial({color:'#f4dca5',roughness:.24,metalness:.04,emissive:'#dc923b',emissiveIntensity:.36});customMaterials.push(glass,lit);
  flat(root,0,.04,0,w+130,d+116,lawn);flat(root,0,.22,0,w+76,d+68,paving);flat(root,0,.3,d*.34,w+84,d*.23,mat('#505658'));flat(root,0,.38,-d*.26,w+52,d*.25,mat('#d8d2c1'));
  // Broad two-storey retail wings wrap a recessed, glazed central atrium.
  box(root,-w*.26,.42,-d*.08,w*.46,17,d*.62,stone);box(root,w*.26,.42,-d*.08,w*.46,17,d*.62,stone);box(root,0,.42,d*.1,w*.22,17,d*.36,stone);box(root,0,2.4,-d*.39,w*.46,12,.48,glass);box(root,0,2.4,-d*.394,w*.43,10,.2,lit);
  for(const wing of [-1,1])for(let level=0;level<2;level++){const y=.9+level*7.1;box(root,wing*w*.26,y,-d*.4,w*.42,5.8,.46,glass);for(let x=wing*w*.46;x<wing*w*.06;x+=-wing*19)box(root,x,.4,-d*.415,.8,16,.85,metal);box(root,wing*w*.26,y+6.15,-d*.4,w*.46,.48,.8,dark)}
  for(const x of [-w*.49,w*.49])for(const z of [-d*.36,d*.2])box(root,x,.45,z,2,17,2,metal);
  box(root,0,18,-d*.08,w+14,1.4,d+12,dark);box(root,0,18.9,-d*.08,w-26,.45,d-24,metal);box(root,0,12,-d*.5,w*.48,.72,10,dark);for(const x of [-w*.21,0,w*.21])box(root,x,.5,-d*.51,1.1,9,.9,metal);
  const fascia=label('JABI LAKE MALL  ·  SHOPPING  ·  DINING','#202a31','#f4e1b2',25);fascia.scale.set(92,13,1);fascia.position.set(0,15.3,-d*.51);root.add(fascia);
  // Outdoor parking, marked bays, short-stay drop-off and human-scale planting.
  for(let row=0;row<2;row++)for(let col=0;col<8;col++){const x=(col-3.5)*21,z=d*.34+(row-.5)*28;flat(root,x,.42,z,12,.28,mat('#ece8dc'));if((col+row)%3===0)carModel(root,x,z-4,['#d2d0c8','#293641','#b94b3f','#65716f'][((col+row)%4)],col%2?'sedan':'suv',false,true)}
  for(let i=0;i<7;i++){const x=(i-3)*34,z=d*.47;box(root,x,.38,z,1.2,7,1.2,mats.trunk);const crown=new THREE.Mesh(new THREE.SphereGeometry(5.4,8,6),i%2?mats.leaf:mats.leaf2);crown.position.set(x,10,z);crown.scale.set(1,1.08,1);root.add(crown);const bed=new THREE.Mesh(new THREE.CylinderGeometry(4.2,4.8,.55,8),mat('#546846'));bed.position.set(x,.64,z);root.add(bed)}
  for(const x of [-w*.4,-w*.2,w*.2,w*.4]){const lamp=new THREE.PointLight('#ffd99b',10,38);lamp.position.set(x,12,-d*.49);root.add(lamp)}
  const entrance=label('MAIN ENTRANCE  →','#303a40','#f3d38b',16);entrance.scale.set(40,6,1);entrance.position.set(0,4.5,-d*.55);root.add(entrance);group.add(root);return root;
 }
 function railwayStation(group,b){
  const w=Math.max(250,b.w+64),d=Math.max(170,b.h+54),root=new THREE.Group();root.position.set(b.x+b.w/2,terrainY(b.x+b.w/2,b.y+b.h/2),b.y+b.h/2);
  const concrete=mat('#d4d1c7',.7,.08),steel=mat('#45565e',.44,.46),glass=new THREE.MeshStandardMaterial({color:'#9acbd4',roughness:.17,metalness:.14,transparent:true,opacity:.65}),platform=mat('#c3baa6'),track=mat('#343c40',.94),rail=mat('#747b7b',.35,.75);customMaterials.push(glass);
  flat(root,0,.04,0,w+60,d+92,mat('#a4b38d'));flat(root,0,.2,0,w+34,d+70,concrete);box(root,0,.38,-d*.3,w*.78,13,d*.34,concrete);box(root,0,2,-d*.475,w*.7,9,.32,glass);for(let x=-w*.34;x<=w*.34;x+=w*.17)box(root,x,1.8,-d*.49,.55,9,.8,steel);box(root,0,13.8,-d*.3,w*.82,1.2,d*.38,steel);box(root,0,14.5,-d*.3,w*.68,.45,d*.29,mat('#82949b',.42,.42));
  const stationSign=label('IDU RAILWAY STATION','#27343b','#f4e4bf',24);stationSign.scale.set(86,12,1);stationSign.position.set(0,12,-d*.49);root.add(stationSign);
  for(let trackIndex=0;trackIndex<2;trackIndex++){const z=d*.14+trackIndex*43;flat(root,0,.24,z,w*.94,23,track);flat(root,0,.48,z-15,w*.88,8,platform);flat(root,0,.48,z+15,w*.88,8,platform);box(root,0,5.7,z-15,w*.78,.55,18,steel);box(root,0,5.7,z+15,w*.78,.55,18,steel);for(const x of [-w*.39,w*.39]){box(root,x,3,z-15,.8,5,.8,steel);box(root,x,3,z+15,.8,5,.8,steel)}
   for(const side of [-1,1]){box(root,0,.66,z+side*9,w*.9,.22,.55,rail);box(root,0,.66,z+side*21,w*.9,.22,.55,rail)}
   for(let x=-w*.41;x<w*.4;x+=18)flat(root,x,.38,z,8,.55,mat('#776b58'));
   // A two-car Abuja commuter train: shared simple forms, tinted windows and clear doors.
   for(let car=0;car<2;car++){const x=(car-.5)*w*.42;box(root,x,1.35,z,Math.min(86,w*.37),3.5,10,mat(car?'#e7e4da':'#d8dedc'));box(root,x,2.15,z-5.15,Math.min(77,w*.34),1.45,.18,glass);box(root,x,2.15,z+5.15,Math.min(77,w*.34),1.45,.18,glass);for(let win=-3;win<=3;win++)box(root,x+win*10,2.15,z-5.32,6,1.35,.1,mat('#6f9ca7',.26,.18));box(root,x,1.4,z-5.28,2.2,2.3,.12,mat('#617780'));for(const dx of [-w*.14,w*.14])for(const dz of [-4.2,4.2]){const wheel=new THREE.Mesh(wheelGeometry,mats.dark);wheel.rotation.z=Math.PI/2;wheel.position.set(x+dx,.42,z+dz);root.add(wheel)}}
  }
  for(const x of [-w*.44,w*.44]){const tree=new THREE.Mesh(new THREE.CylinderGeometry(1,1.3,8,7),mats.trunk);tree.position.set(x,4,-d*.42);root.add(tree);const crown=new THREE.Mesh(new THREE.SphereGeometry(5.5,8,6),mats.leaf);crown.position.set(x,10,-d*.42);root.add(crown)}
  for(const x of [-w*.32,0,w*.32]){const light=new THREE.PointLight('#ffe2ac',8,42);light.position.set(x,9,-d*.2);root.add(light)}group.add(root);return root;
 }
 function nationalChurch(group,b){
  const w=Math.max(260,b.w+118),d=Math.max(220,b.h+112),root=new THREE.Group();root.position.set(b.x+b.w/2,terrainY(b.x+b.w/2,b.y+b.h/2),b.y+b.h/2);const grass=mat('#8cad7d'),paving=mat('#d0cab9'),stone=mat('#e8e1d3',.66,.08),roof=mat('#5c6770',.48,.34),glass=new THREE.MeshStandardMaterial({color:'#9dcbd3',roughness:.18,metalness:.1,transparent:true,opacity:.62});customMaterials.push(glass);flat(root,0,.04,0,w+56,d+56,grass);flat(root,0,.2,0,w+28,d+28,paving);flat(root,0,.27,d*.32,w*.74,d*.2,mat('#595f61'));
  box(root,0,.45,-d*.03,w*.52,25,d*.58,stone);box(root,0,4,-d*.335,w*.44,15,.45,glass);box(root,0,25.8,-d*.03,w*.57,1.4,d*.63,roof);const roofShape=new THREE.Mesh(new THREE.ConeGeometry(w*.31,22,4),roof);roofShape.position.set(0,37,-d*.02);roofShape.rotation.y=Math.PI/4;root.add(roofShape);
  for(const x of [-w*.31,w*.31]){box(root,x,.45,-d*.1,w*.12,39,d*.18,stone);box(root,x,39.6,-d*.1,w*.15,2.3,d*.22,roof);const spire=new THREE.Mesh(new THREE.ConeGeometry(4.2,17,4),mat('#c8a35c',.4,.35));spire.position.set(x,50,-d*.1);spire.rotation.y=Math.PI/4;root.add(spire);const crossV=new THREE.Mesh(boxGeometry(.8,9,.8),mat('#c8a35c',.4,.35));crossV.position.set(x,58,-d*.1);root.add(crossV);box(root,x,60,-d*.1,5,.8,.8,mat('#c8a35c',.4,.35))}
  for(let row=0;row<2;row++)for(let col=0;col<6;col++){const x=(col-2.5)*22,z=d*.33+(row-.5)*25;flat(root,x,.34,z,13,.24,mat('#efebe0'));if((col+row)%3===0)carModel(root,x,z-4,['#d0d1cd','#293845','#8d4f42'][col%3],col%2?'sedan':'suv',false,true)}for(const x of [-w*.39,-w*.18,w*.18,w*.39]){const trunk=new THREE.Mesh(new THREE.CylinderGeometry(.7,1,9,7),mats.trunk);trunk.position.set(x,4.5,d*.4);root.add(trunk);const crown=new THREE.Mesh(new THREE.SphereGeometry(6,9,7),mats.leaf);crown.position.set(x,11,d*.4);crown.scale.set(1,1.3,1);root.add(crown);const light=new THREE.PointLight('#ffdd9b',7,34);light.position.set(x,10,-d*.25);root.add(light)}const sign=label('NATIONAL CHRISTIAN CENTRE','#28333b','#f4e5bf',22);sign.scale.set(82,11,1);sign.position.set(0,16,-d*.51);root.add(sign);group.add(root);return root;
 } function architecturalAsset(parent,b){const lod=new THREE.LOD();lod.addLevel(buildingModel(b,0),0);lod.addLevel(buildingModel(b,1),500);lod.addLevel(buildingModel(b,2),1350);lod.position.set(b.x+b.w/2,terrainY(b.x,b.y),b.y+b.h/2);lod.rotation.y=Number(b.rotation)||0;lod.scale.setScalar(Number(b.scale)||1);parent.add(lod);parent.userData.buildingLods.push(lod);return lod}
 diagnostic('procedural-world-build-start',{buildings:G.world.buildings?.length||0,chunkSize});
 G.world.assetBuilders=G.world.assetBuilders||Object.create(null);
 G.world.registerAssetBuilder=function(name,builder){if(typeof name!=='string'||!name||typeof builder!=='function')throw new TypeError('Asset builders need a name and a builder function.');G.world.assetBuilders[name]=builder;return builder};
 G.world.registerAssetBuilder('architecture',architecturalAsset);
 G.world.registerAssetBuilder('dealership',dealership);
 G.world.registerAssetBuilder('car-stand',carStand);
 G.world.registerAssetBuilder('restaurant-property',restaurantProperty);
 G.world.registerAssetBuilder('fashion-flagship',fashionFlagship);
 G.world.registerAssetBuilder('airport-terminal',airportTerminal);
 G.world.registerAssetBuilder('mosque',nationalMosque);
 G.world.registerAssetBuilder('construction-site',constructionSite);
 G.world.registerAssetBuilder('estate-gate',estateEntrance);
 G.world.registerAssetBuilder('park',parkAsset);
 G.world.registerAssetBuilder('landmark-rock-formation',rockFormation);
 G.world.registerAssetBuilder('civic-bank',architecturalAsset);
 G.world.registerAssetBuilder('national-church',nationalChurch);
 G.world.registerAssetBuilder('retail-complex',retailComplex);
 G.world.registerAssetBuilder('transport-terminal',railwayStation);
 function estateCompound(group,estate){
  const root=new THREE.Group(),cx=estate.x+estate.w/2,cz=estate.y+estate.h/2,ground=terrainY(cx,cz);
  root.position.set(cx,ground,cz);
  const lawn=mat(estate.style==='garden-estate'?'#9ebd88':'#aac495'),lane=mat('#59646a',.92),wall=mat('#d6d0c2',.72),gate=mat('#28353a',.48,.34),hedge=mat('#597b52');
  flat(root,0,.035,0,estate.w+24,estate.h+24,lawn);
  // The compound wall leaves a drive opening at the named estate gate.
  for(const side of [-1,1]){box(root,side*(estate.w/2+7),.65,0,.65,1.3,estate.h+14,wall);box(root,0,.65,side*(estate.h/2+7),estate.w+14,1.3,.65,wall)}
  const gateX=estate.gate?estate.gate.x-cx:0,gateZ=estate.gate?estate.gate.y-cz:-estate.h/2;
  box(root,gateX-13,1.25,gateZ,1.5,3,1.5,wall);box(root,gateX+13,1.25,gateZ,1.5,3,1.5,wall);box(root,gateX,1.1,gateZ,22,2.2,.48,gate);
  // Shared internal street and smaller cross streets make each estate physically readable from above.
  flat(root,0,.14,0,10,estate.h-32,lane);for(const z of [-estate.h*.27,estate.h*.12,estate.h*.43])flat(root,0,.16,z,estate.w-34,7,lane);
  for(const z of [-estate.h*.27,estate.h*.12,estate.h*.43])for(let x=-estate.w*.42;x<estate.w*.43;x+=24)flat(root,x,.23,z,9,.35,mats.line);
  for(const x of [-estate.w*.34,estate.w*.34])for(const z of [-estate.h*.34,0,estate.h*.34]){const bed=new THREE.Mesh(new THREE.CylinderGeometry(3.1,3.8,.55,8),hedge);bed.position.set(x,.42,z);root.add(bed);const crown=new THREE.Mesh(new THREE.SphereGeometry(4.8,8,6),mats.leaf);crown.position.set(x,5.2,z);crown.scale.set(1,1.18,1);root.add(crown)}
  for(const z of [-estate.h*.3,estate.h*.05,estate.h*.38])for(const x of [-estate.w*.43,estate.w*.43]){box(root,x,3.1,z,.32,6,.32,mat('#566267',.55,.45));const lamp=new THREE.PointLight('#ffd68a',3.4,22);lamp.position.set(x,6.1,z);root.add(lamp)}
  const sign=label(estate.name.toUpperCase(),'#243139','#f3e3bb',14);sign.scale.set(Math.min(50,estate.w*.28),6,1);sign.position.set(gateX,4.3,gateZ-1.1);root.add(sign);group.add(root);return root;
 }
 function jabiWaterfront(group,lake){
  const root=new THREE.Group(),cx=lake.x+lake.w/2,cz=lake.y+lake.h/2,ground=terrainY(cx,cz),waterMat=new THREE.MeshStandardMaterial({color:'#4d9fc4',roughness:.18,metalness:.2,transparent:true,opacity:.9,emissive:'#174d6c',emissiveIntensity:.14}),shore=mat('#d0c5a6',.82),paving=mat('#c7c1af',.86),timber=mat('#8b6947',.8);customMaterials.push(waterMat);
  root.position.set(cx,ground,cz);
  // A hand-shaped shoreline gives Jabi Lake bays and coves instead of a pool-like rectangle or circle.
  const outline=[[-.52,-.18],[-.43,-.42],[-.18,-.51],[.12,-.48],[.43,-.32],[.52,-.06],[.46,.22],[.25,.45],[-.08,.5],[-.35,.4],[-.53,.16]];
  const geometryFrom=(points,scale)=>{const shape=new THREE.Shape();points.forEach(([x,z],i)=>{const px=x*lake.w*scale,pz=-z*lake.h*scale;i?shape.lineTo(px,pz):shape.moveTo(px,pz)});shape.closePath();const geo=new THREE.ShapeGeometry(shape);geo.rotateX(-Math.PI/2);return geo};
  const shoreMesh=new THREE.Mesh(geometryFrom(outline,1.09),shore);shoreMesh.position.y=.09;root.add(shoreMesh);
  const water=new THREE.Mesh(geometryFrom(outline,1),waterMat);water.position.y=.16;root.add(water);
  flat(root,0,.22,lake.h*.49,lake.w*.66,22,paving);flat(root,-lake.w*.23,.27,lake.h*.42,80,12,timber);flat(root,lake.w*.18,.27,lake.h*.42,64,12,timber);
  // Three waterfront pavilions, green banks and path lighting keep the lake active without filling it with generic towers.
  for(const x of [-lake.w*.31,0,lake.w*.31]){const z=-lake.h*.42;flat(root,x,.22,z,40,30,paving);for(const dx of [-14,14])for(const dz of [-9,9])box(root,x+dx,3,z+dz,.55,6,.55,mat('#5f6967',.48));box(root,x,6.2,z,36,.65,25,mat('#344b52',.42));const lamp=new THREE.PointLight('#ffdb95',7,34);lamp.position.set(x,8,z);root.add(lamp)}
  for(let i=0;i<20;i++){const a=i/20*Math.PI*2,x=Math.cos(a)*lake.w*.55,z=Math.sin(a)*lake.h*.55;if(z>lake.h*.31&&Math.abs(x)<lake.w*.38)continue;const trunk=new THREE.Mesh(new THREE.CylinderGeometry(.65,.95,8,7),mats.trunk);trunk.position.set(x,4,z);root.add(trunk);const crown=new THREE.Mesh(new THREE.SphereGeometry(5.5+(i%3),8,6),i%3?mats.leaf:mats.leaf2);crown.position.set(x,10,z);crown.scale.set(1,1.25,1);root.add(crown)}
  const sign=label('JABI LAKE  ·  WATERFRONT','#25414b','#e7f5f1',20);sign.scale.set(72,10,1);sign.position.set(0,8,lake.h*.55);root.add(sign);group.add(root);return root;
 } function metropolitanPrecinct(group,p){
  const root=new THREE.Group(),cx=p.x+p.w/2,cz=p.y+p.h/2,ground=terrainY(cx,cz),paving=mat('#c8c2b2',.9),lawn=mat('#8caf7d'),asphalt=mat('#454e52',.92),stone=mat('#d6d1c5',.62,.08),dark=mat('#263139',.42,.3),brass=mat('#c79d52',.36,.5),glass=new THREE.MeshStandardMaterial({color:'#91c5d2',roughness:.16,metalness:.14,transparent:true,opacity:.72,emissive:'#8dc5ca',emissiveIntensity:.08});customMaterials.push(glass);
  root.position.set(cx,ground,cz);flat(root,0,.04,0,p.w+28,p.h+28,lawn);flat(root,0,.16,0,p.w+10,p.h+10,paving);
  const plant=(x,z,scale=1)=>{const bed=new THREE.Mesh(new THREE.CylinderGeometry(3.5*scale,4.2*scale,.55,8),mat('#5a7651'));bed.position.set(x,.48,z);root.add(bed);const crown=new THREE.Mesh(new THREE.SphereGeometry(6*scale,9,7),mats.leaf);crown.position.set(x,7*scale,z);crown.scale.set(1,1.25,1);root.add(crown)};
  const lamp=(x,z)=>{box(root,x,4,z,.34,8,.34,mat('#566267',.48));const glow=new THREE.PointLight('#ffd89b',5,34);glow.position.set(x,8,z);root.add(glow)};
  if(p.kind==='cbd'){
   flat(root,0,.25,p.h*.38,p.w*.87,p.h*.2,asphalt);flat(root,0,.31,p.h*.23,p.w*.84,22,mat('#d9d3c2'));
   for(let row=0;row<2;row++)for(let col=0;col<7;col++){const x=(col-3)*p.w*.105,z=p.h*.39+(row-.5)*25;flat(root,x,.39,z,12,.25,mat('#eeeadf'));if((col+row)%3===0)carModel(root,x,z-4,['#243543','#d4d1c8','#9f473e','#5d7480'][(row+col)%4],col%2?'sedan':'suv',false,true)}
   for(const [i,t] of p.towers.entries()){
    const x=-p.w/2+t.x*p.w,z=-p.h/2+t.z*p.h,tw=t.w,td=t.d,h=t.h,podiumH=Math.max(13,h*.22),upperH=h-podiumH;
    flat(root,x,.29,z,tw+32,td+32,mat('#b7b4a9'));box(root,x,.42,z,tw,podiumH,td,stone);box(root,x,.9,z-td*.502,tw*.83,podiumH*.62,.45,glass);box(root,x,podiumH+.42,z+td*.04,tw*.72,upperH,td*.7,i%2?dark:mat('#70848a',.4,.22));box(root,x,podiumH+3,z-td*.325,tw*.61,upperH-6,.42,glass);
    for(const side of [-1,1])for(let level=1;level<Math.max(2,Math.floor(h/9));level++){const y=podiumH+level*8;box(root,x+side*tw*.37,y,z,1.05,1.2,td*.72,brass);box(root,x,y,z+td*.37,tw*.72,1.2,1.05,brass)}
    box(root,x,podiumH+upperH+.9,z,tw*.58,1.8,td*.5,dark);box(root,x+tw*.12,podiumH+upperH+3,z-td*.08,tw*.2,4,td*.18,mat('#747d7b'));for(const sx of [-1,1]){box(root,x+sx*(tw*.42),podiumH+upperH*.58,z-td*.37,.55,upperH*.72,.8,brass)}
    const entry=label(['CAPITAL TOWER','CIVIC GALLERIA','UNITY HOTEL','ABUJA PLAZA'][i%4],'#27333a','#f2dcaf',15);entry.scale.set(Math.min(48,tw*.55),6,1);entry.position.set(x,podiumH*.56,z-td*.53);root.add(entry);plant(x-tw*.42,z-td*.4,.8);plant(x+tw*.42,z-td*.4,.8);
   }
   const plaza=new THREE.Mesh(new THREE.CylinderGeometry(38,42,.7,28),mat('#d6d0bd'));plaza.position.set(0,.5,0);root.add(plaza);const fountain=new THREE.Mesh(new THREE.CylinderGeometry(11,15,1.2,20),mat('#7ca8bb',.24,.12));fountain.position.set(0,1.25,0);root.add(fountain);const jet=new THREE.Mesh(new THREE.ConeGeometry(3,16,10),mat('#bfe9ef',.12,.08));jet.position.set(0,9,0);root.add(jet);for(let a=0;a<6;a++){const angle=a*Math.PI/3;plant(Math.cos(angle)*31,Math.sin(angle)*31,.75)}
  }else{
   flat(root,0,.24,p.h*.25,p.w*.94,p.h*.36,asphalt);flat(root,0,.3,-p.h*.36,p.w*.9,30,mat('#ddd6c6'));
   const count=p.shops||6;for(let i=0;i<count;i++){const width=p.w/(count+1),x=-p.w/2+width*(i+1),d=72+(i%3)*12,h=13+(i%3)*4;box(root,x,.45,-p.h*.05,width-9,h,d,i%2?stone:dark);box(root,x,2,-p.h*.05-d*.51,width-16,h*.57,.5,glass);box(root,x,h+.65,-p.h*.05,width-5,1.2,d+3,i%2?dark:brass);box(root,x,2.6,-p.h*.05-d*.56,width*.76,.72,5,mat(['#af7147','#557980','#9e7947','#7b5b55'][i%4]));const sign=label(['ABUJA MARKET','CITY TABLE','CAPITAL MART','URBAN OFFICE','THE VUE','LIFESTYLE'][i%6],'#2a3438','#f4dfa9',12);sign.scale.set(Math.min(42,width*.65),5,1);sign.position.set(x,h*.67,-p.h*.05-d*.58);root.add(sign)}
   for(let row=0;row<2;row++)for(let col=0;col<count;col++){const x=-p.w*.39+col*(p.w*.78/(count-1||1)),z=p.h*.23+(row-.5)*28;flat(root,x,.35,z,13,.25,mat('#f0ede3'));if((row+col)%2===0)carModel(root,x,z-4,['#d4d3cd','#2a343c','#9f463c','#667b81'][(row+col)%4],col%2?'sedan':'suv',false,true)}
   for(let i=0;i<6;i++){const x=-p.w*.42+i*p.w*.17;plant(x,-p.h*.39,.85);lamp(x,p.h*.38)}
  }
  for(const x of [-p.w*.44,p.w*.44])for(const z of [-p.h*.42,p.h*.42])lamp(x,z);const tag=label(p.name.toUpperCase(),'#223039','#f3e3bb',17);tag.scale.set(Math.min(72,p.w*.42),7,1);tag.position.set(0,8,-p.h*.52);root.add(tag);group.add(root);return root;
 } function terrainChunk(g,cx,cz){const side=9,step=chunkSize/side,vertices=[],indices=[];for(let j=0;j<=side;j++)for(let i=0;i<=side;i++){const x=cx+i*step,z=cz+j*step;vertices.push(x,terrainY(x,z),z)}for(let j=0;j<side;j++)for(let i=0;i<side;i++){const a=j*(side+1)+i,b=a+1,c=a+side+1,d=c+1;indices.push(a,c,b,b,c,d)}const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geo.setIndex(indices);geo.computeVertexNormals();const mesh=new THREE.Mesh(geo,mats.grass);mesh.receiveShadow=true;g.add(mesh)}
 function makeChunk(cx,cz){const key=`${cx/chunkSize}:${cz/chunkSize}`,g=new THREE.Group();g.userData.key=key;g.userData.buildingLods=[];
  terrainChunk(g,cx,cz);
  // Abuja's planned districts use distinct green-space tones and keep future parcels legible.
  for(const district of G.world.districts||[]){const r=district.bounds;if(r.x>=cx+chunkSize||r.x+r.w<=cx||r.y>=cz+chunkSize||r.y+r.h<=cz)continue;if(district.style.includes('estate')||district.style.includes('residential')){const ix=Math.max(cx,r.x),iz=Math.max(cz,r.y),ax=Math.min(cx+chunkSize,r.x+r.w),az=Math.min(cz+chunkSize,r.y+r.h);rect(g,(ix+ax)/2,(iz+az)/2,ax-ix,az-iz,mat(district.style==='low-rise-estate'?'#a8c495':'#9dbb8e'))}}
  for(const p of G.world.futurePlots||[]){if(p.x>cx+chunkSize||p.x+p.w<cx||p.y>cz+chunkSize||p.y+p.h<cz)continue;rect(g,p.x+p.w/2,p.y+p.h/2,p.w,p.h,mats.soil);for(let x=p.x+20;x<p.x+p.w;x+=24){flat(g,x,terrainY(x,p.y)+.3,p.y,1,p.h,mat('#bd9c66'))}}
  drawRoads(g,cx,cz);
  jabiLakeBridge(g,cx,cz);
  if(cx<8900&&cx+chunkSize>7400&&cz<6530&&cz+chunkSize>6290){const left=Math.max(cx,7400),right=Math.min(cx+chunkSize,8900);rect(g,(left+right)/2,6405,right-left,84,mat('#424c53'));for(let x=left+15;x<right;x+=48)flat(g,x,terrainY(x,6405)+.2,6405,20,.45,mats.white)}
  for(const estate of G.world.residentialEstates||[]){const ex=Math.floor((estate.x+estate.w/2)/chunkSize)*chunkSize,ez=Math.floor((estate.y+estate.h/2)/chunkSize)*chunkSize;if(ex===cx&&ez===cz)estateCompound(g,estate)}
  for(const precinct of G.world.metropolitanPrecincts||[]){const px=Math.floor((precinct.x+precinct.w/2)/chunkSize)*chunkSize,pz=Math.floor((precinct.y+precinct.h/2)/chunkSize)*chunkSize;if(px===cx&&pz===cz)metropolitanPrecinct(g,precinct)}
  for(const lake of G.world.lakes||[]){const lx=Math.floor((lake.x+lake.w/2)/chunkSize)*chunkSize,lz=Math.floor((lake.y+lake.h/2)/chunkSize)*chunkSize;if(lx===cx&&lz===cz)jabiWaterfront(g,lake)}
  const lotKey=`${cx/chunkSize}:${cz/chunkSize}`;buildCityFabric(g,G.world.cityLotsByChunk?.[lotKey],cx,cz);
  for(const r of G.world.roundabouts||[])if(Math.floor(r.x/chunkSize)===cx/chunkSize&&Math.floor(r.y/chunkSize)===cz/chunkSize)roundaboutAsset(g,r);
  for(const b of G.world.buildings||[]){const bounds=b.assetBounds||b;if(bounds.x>cx+chunkSize||bounds.x+bounds.w<cx||bounds.y>cz+chunkSize||bounds.y+bounds.h<cz)continue;const builderName=G.world.assetManifest?.[b.asset]?.builder,builder=G.world.assetBuilders?.[builderName]||G.world.assetBuilders?.[b.asset]||G.world.assetBuilders?.architecture;const centerX=bounds.x+bounds.w/2,centerY=bounds.y+bounds.h/2;if(Math.floor(centerX/chunkSize)!==cx/chunkSize||Math.floor(centerY/chunkSize)!==cz/chunkSize)continue;if(builder){builder(g,b,{THREE,mat,box,flat,rect,label,terrainY,buildingModel});continue}architecturalAsset(g,b)}
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
 function render(){if(!visible)return;const s=G.state;if(!s)return;updateLighting();const scale=(G.view.scale||1)*1.047;
  const panX=G.view.panX||0,panY=G.view.panY||0;
  const targetX=clamp(s.x-(panX/.74+panY/.38)/(2*(G.view.scale||1)),0,G.W),targetZ=clamp(s.y-(panY/.38-panX/.74)/(2*(G.view.scale||1)),0,G.H);
  const viewHeight=innerHeight/scale;camera.left=-innerWidth/(2*scale);camera.right=innerWidth/(2*scale);camera.top=viewHeight/2;camera.bottom=-viewHeight/2;
  const elev=Math.asin(.61),horizontal=Math.max(viewHeight,innerWidth/scale)*1.34;
  camera.position.set(targetX+Math.cos(Math.PI/4)*horizontal,terrainY(targetX,targetZ)+Math.tan(elev)*horizontal,targetZ+Math.sin(Math.PI/4)*horizontal);
  camera.lookAt(targetX,terrainY(targetX,targetZ),targetZ);camera.updateProjectionMatrix();camera.updateMatrixWorld();
  const r=Math.max(chunkSize*1.75,(innerWidth/(1.48*scale)+innerHeight/(.76*scale))/2+chunkSize*.5),minX=Math.max(0,Math.floor((targetX-r)/chunkSize)*chunkSize),maxX=Math.min(G.W,Math.ceil((targetX+r)/chunkSize)*chunkSize),minZ=Math.max(0,Math.floor((targetZ-r)/chunkSize)*chunkSize),maxZ=Math.min(G.H,Math.ceil((targetZ+r)/chunkSize)*chunkSize),needed=new Set();
  for(let x=minX;x<maxX;x+=chunkSize)for(let z=minZ;z<maxZ;z+=chunkSize)needed.add(String(x/chunkSize)+':'+String(z/chunkSize));
  const queued=[...needed].filter(k=>!chunks.has(k)).sort((a,b)=>{const[ax,az]=a.split(':').map(Number),[bx,bz]=b.split(':').map(Number);return Math.hypot((ax+.5)*chunkSize-targetX,(az+.5)*chunkSize-targetZ)-Math.hypot((bx+.5)*chunkSize-targetX,(bz+.5)*chunkSize-targetZ)});
  for(const key of queued.slice(0,3)){const[x,z]=key.split(':').map(Number);makeChunk(x*chunkSize,z*chunkSize)}
  for(const key of chunks.keys())if(!needed.has(key))discardChunk(key);
  for(const g of chunks.values()){for(const lod of g.userData.buildingLods||[])lod.update(camera);const homes=g.userData.homeLOD;if(!homes)continue;let changed=false;for(const item of homes.items){const near=Math.hypot(item.x-targetX,item.z-targetZ)<260;if(near===item.near)continue;item.near=near;if(near){const detail=makeHouse(item.h);detail.position.set(item.x,item.ground,item.z);item.parent.add(detail);item.detail=detail}else if(item.detail){item.parent.remove(item.detail);item.detail.traverse(o=>{if(o.geometry&&!sharedGeometry.has(o.geometry))o.geometry.dispose()});item.detail=null}dummyHome(item,homes.bodies,homes.roofs);changed=true}if(changed){homes.bodies.instanceMatrix.needsUpdate=true;homes.roofs.instanceMatrix.needsUpdate=true}}
  if(performance.now()-lastSync>400){syncActors();lastSync=performance.now()}
  const player=s.vehicle?vehicles.get(s.vehicle.id||s.vehicle.name):null;
  if(player){player.position.set(s.x,terrainY(s.x,s.y),s.y);player.rotation.y=-(s.angle||0);player.visible=true;playerFigure.visible=false}else{playerFigure.position.set(s.x,terrainY(s.x,s.y),s.y);playerFigure.rotation.y=-(s.angle||0);playerFigure.visible=true}
  renderer.render(scene,camera);if(!firstRendered){firstRendered=true;diagnostic('first-render-complete',{drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,chunks:chunks.size})}
 }
 const api={ready:true,renderer,scene,camera,chunks,get stats(){return{chunks:chunks.size,buildings:G.world.buildings.length,cityLots:G.world.cityLots?.length||0,houseLots:G.world.houseLots.length,roads:G.world.roadSegments?.length||0,roundabouts:G.world.roundabouts?.length||0,trees:[...chunks.values()].reduce((n,c)=>n+(c.userData.treeCount||0),0),drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles}},render,refreshLocation,setVisible(v){visible=!!v;canvas.style.display=v?'block':'none'},dispose(){removeEventListener('resize',resize);for(const key of chunks.keys())discardChunk(key);renderer.dispose();materialCache.forEach(m=>m.dispose());customMaterials.forEach(m=>m.dispose());labelCache.forEach(t=>t.dispose());textures.forEach(t=>t.dispose());canvas.remove()}};
 G.world.threeWorld=api;
 diagnostic('three-world-initialization-complete',{canvasConnected:canvas.isConnected,rendererRevision:THREE.REVISION});
 return api;
}


