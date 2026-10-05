(function(){
const G=window.Game;
const SX=.74,SY=.38;
const shade=(hex,factor)=>{let c=hex.replace('#','');if(c.length===3)c=c.split('').map(x=>x+x).join('');let n=parseInt(c,16),r=Math.max(0,Math.min(255,Math.round((n>>16)*factor))),g=Math.max(0,Math.min(255,Math.round(((n>>8)&255)*factor))),b=Math.max(0,Math.min(255,Math.round((n&255)*factor)));return `rgb(${r},${g},${b})`};
G.world.draw3D=function(ctx,scale,dpr,w,h){
 const s=G.state,px=(x,y,z=0)=>[w/2+((x-s.x)-(y-s.y))*SX*scale+(G.view.panX||0),h/2+((x-s.x)+(y-s.y))*SY*scale-z*scale+(G.view.panY||0)];
 const poly=(points,fill,stroke)=>{ctx.beginPath();points.forEach((p,i)=>{let q=px(p[0],p[1],p[2]||0);i?ctx.lineTo(q[0],q[1]):ctx.moveTo(q[0],q[1])});ctx.closePath();ctx.fillStyle=fill;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=1.2;ctx.stroke()}};
 const polygon2=(points,fill)=>{ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));ctx.closePath();ctx.fillStyle=fill;ctx.fill()};
 ctx.save();ctx.setTransform(dpr,0,0,dpr,0,0);ctx.fillStyle='#a9bf91';ctx.fillRect(0,0,w,h);ctx.restore();
 ctx.save();ctx.setTransform(dpr,0,0,dpr,0,0);
 // Water and the pale sandy edge.
 const coast=[[1745,0],[2200,0],[2200,1700],[1875,1700],[1930,1420],[1840,1190],[1970,930],[1855,755],[1990,420],[1670,290]];
 polygon2(coast.map(q=>px(q[0],q[1])), '#55a9c8');
 ctx.lineWidth=8;ctx.strokeStyle='#d7c89d';ctx.beginPath();coast.slice(5).forEach((q,i)=>{let p=px(q[0],q[1]);i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1])});ctx.stroke();
 // City park blocks and green spaces.
 for(let y=0;y<G.H;y+=205)for(let x=0;x<G.W;x+=235){let seed=(x*13+y*7)%9;if(seed<3){let p=[[x+12,y+10],[x+205,y+10],[x+205,y+170],[x+12,y+170]];poly(p,seed===0?'#98b989':'#a4c292');for(let k=0;k<3;k++)drawTree(x+45+k*54,y+70+(k%2)*45,0.8)}}
 // Wide city streets follow the isometric grid.
 const road=(axis,pos,width,outer,inner)=>{let pts=axis==='x'?[[pos-width/2,-120],[pos+width/2,-120],[pos+width/2,G.H+120],[pos-width/2,G.H+120]]:[[-120,pos-width/2],[G.W+120,pos-width/2],[G.W+120,pos+width/2],[-120,pos+width/2]];poly(pts,outer);let m=width*.82,mid=axis==='x'?[[pos-m/2,-120],[pos+m/2,-120],[pos+m/2,G.H+120],[pos-m/2,G.H+120]]:[[-120,pos-m/2],[G.W+120,pos-m/2],[G.W+120,pos+m/2],[-120,pos+m/2]];poly(mid,inner);};
 G.world.roadX.forEach(x=>road('x',x,112,'#baa982','#626e70'));G.world.roadY.forEach(y=>road('y',y,112,'#baa982','#626e70'));
 // Broken centre lines on the asphalt.
 ctx.strokeStyle='#e8d896';ctx.lineWidth=2;ctx.setLineDash([12,12]);for(let x of G.world.roadX){let a=px(x,0),b=px(x,G.H);ctx.beginPath();ctx.moveTo(a[0],a[1]);ctx.lineTo(b[0],b[1]);ctx.stroke()}for(let y of G.world.roadY){let a=px(0,y),b=px(G.W,y);ctx.beginPath();ctx.moveTo(a[0],a[1]);ctx.lineTo(b[0],b[1]);ctx.stroke()}ctx.setLineDash([]);
 // Small sidewalks, yards and buildings are sorted by depth.
 const sorted=[...G.world.buildings].sort((a,b)=>(a.x+a.y)-(b.x+b.y));
 for(const b of sorted){
   const x=b.x,y=b.y,w0=b.w,h0=b.h,z=b.type==='apartment'?96:b.type==='government'?100:b.type==='hospital'?88:b.type==='hotel'?92:b.type==='university'?100:b.type==='mosque'?74:62;
   const lot=[[x-17,y-15],[x+w0+17,y-15],[x+w0+17,y+h0+18],[x-17,y+h0+18]];
   poly(lot,'#d3c9ac');poly([[x-8,y-7],[x+w0+8,y-7],[x+w0+8,y+h0+8],[x-8,y+h0+8]],'#b8b7a4');
   // Building cuboid: two lit walls, dark roof edge, and roof plane.
   const wall='#';const base=b.color||'#bd9c73',door=(x+w0*.53,y+h0-2),up=v=>v-z/SY;
   const a=[x,y,0],bb=[x+w0,y,0],c=[x+w0,y+h0,0],d=[x,y+h0,0];
   poly([a,bb,[x+w0,y, z],[x,y,z]],shade(base,.78));
   poly([bb,c,[x+w0,y+h0,z],[x+w0,y,z]],shade(base,.58));
   poly([[x,y,z],[x+w0,y,z],[x+w0,y+h0,z],[x,y+h0,z]],shade(base,1.16),'#474f51');
   // Roof parapet and a small cap to give each block a low-poly silhouette.
   const lip=8;
   poly([[x-3,y-3,z],[x+w0+3,y-3,z],[x+w0+3,y-3,z+lip],[x-3,y-3,z+lip]],shade(base,.65));
   poly([[x+w0+3,y-3,z],[x+w0+3,y+h0+3,z],[x+w0+3,y+h0+3,z+lip],[x+w0+3,y-3,z+lip]],shade(base,.48));
   if(b.type==='government'||b.type==='bank'||b.type==='hotel'||b.type==='university'){
     poly([[x+w0*.35,y+h0*.34,z+1],[x+w0*.65,y+h0*.34,z+1],[x+w0*.65,y+h0*.34,z+4],[x+w0*.35,y+h0*.34,z+4]],'#e8c66d');
   }
   // Repeated front windows on each visible facade.
   const count=Math.max(2,Math.floor(w0/36));
   for(let i=0;i<count;i++){
     let wx=x+12+i*((w0-28)/count),wy=y+17;
     poly([[wx,wy,z-13],[wx+12,wy,z-13],[wx+12,wy,z-28],[wx,wy,z-28]],'#b9e3e3','#53686a');
     let vx=x+w0-17,vy=y+18+i*((h0-32)/count);
     poly([[vx,vy,z-14],[vx,vy+11,z-14],[vx,vy+11,z-28],[vx,vy,z-28]],'#b9e3e3','#485a5c');
   }
   // Door on the near-facing right wall.
   poly([[x+w0*.64,y+h0-24,1],[x+w0*.83,y+h0-24,1],[x+w0*.83,y+h0-24,z*.54],[x+w0*.64,y+h0-24,z*.54]],'#553a2b','#382c25');
   const center=px(x+w0/2,y+h0/2,z+lip+8);drawLabel(center[0],center[1],b.icon+' '+b.name);
 }
 // Palm and shade trees along the blocks, outside the travel lanes.
 for(let i=0;i<52;i++){let x=(i*173+120)%G.W,y=(i*127+80)%G.H;if(G.world.roadX.some(r=>Math.abs(r-x)<86)||G.world.roadY.some(r=>Math.abs(r-y)<86))continue;drawTree(x,y,1)}
 // Traffic and residents are drawn above the city surfaces.
 for(const c of G.world.cars)if(!(s.vehicle&&s.vehicle.name===c.name))drawVehicle(c.x,c.y,c.color,c.name);
 for(const n of G.world.npcs){drawPerson(n.x,n.y,n.emoji,n.id==='cop'?'#244b9b':'#dfaa76');if(Math.hypot(n.x-s.x,n.y-s.y)<75){let p=px(n.x,n.y,42);drawLabel(p[0],p[1]-13,n.name,true)}}
 if(s.vehicle)drawVehicle(s.x,s.y,s.vehicle.color,s.vehicle.name,true);else drawPerson(s.x,s.y,s.gender==='man'?'🧑🏾':'👩🏾','#19845f',true);
 ctx.restore();
 function drawLabel(x,y,text,small){ctx.save();ctx.setTransform(dpr,0,0,dpr,0,0);ctx.font=`${small?'600 11px':'700 12px'} Manrope, sans-serif`;let width=ctx.measureText(text).width+18,height=small?21:25;ctx.fillStyle=small?'#fff':'#fffffff2';ctx.shadowColor='#1b293633';ctx.shadowBlur=6;ctx.beginPath();ctx.roundRect(x-width/2,y-height/2,width,height,12);ctx.fill();ctx.shadowBlur=0;ctx.fillStyle='#263242';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,x,y);ctx.restore()}
 function drawTree(x,y,k){let p=px(x,y);ctx.save();ctx.setTransform(dpr,0,0,dpr,0,0);ctx.fillStyle='#0002';ctx.beginPath();ctx.ellipse(p[0]+8,p[1]+3,16*k,7*k,-.15,0,Math.PI*2);ctx.fill();ctx.fillStyle='#72553a';ctx.fillRect(p[0]-3*k,p[1]-29*k,6*k,30*k);ctx.fillStyle='#267752';ctx.beginPath();ctx.moveTo(p[0],p[1]-77*k);ctx.lineTo(p[0]-24*k,p[1]-36*k);ctx.lineTo(p[0]-17*k,p[1]-42*k);ctx.lineTo(p[0]-30*k,p[1]-20*k);ctx.lineTo(p[0],p[1]-28*k);ctx.lineTo(p[0]+25*k,p[1]-19*k);ctx.lineTo(p[0]+16*k,p[1]-43*k);ctx.lineTo(p[0]+26*k,p[1]-37*k);ctx.closePath();ctx.fill();ctx.fillStyle='#3c9863';ctx.beginPath();ctx.moveTo(p[0],p[1]-77*k);ctx.lineTo(p[0]+17*k,p[1]-43*k);ctx.lineTo(p[0]+12*k,p[1]-33*k);ctx.lineTo(p[0],p[1]-28*k);ctx.lineTo(p[0]-5*k,p[1]-47*k);ctx.closePath();ctx.fill();ctx.restore()}
 function drawPerson(x,y,emoji,color,player){let p=px(x,y);ctx.save();ctx.setTransform(dpr,0,0,dpr,0,0);ctx.fillStyle='#0003';ctx.beginPath();ctx.ellipse(p[0],p[1]+2,9,4,0,0,Math.PI*2);ctx.fill();ctx.fillStyle=color;ctx.fillRect(p[0]-6,p[1]-24,12,18);ctx.fillStyle='#563b30';ctx.beginPath();ctx.arc(p[0],p[1]-29,6,0,Math.PI*2);ctx.fill();ctx.fillStyle='#fff';ctx.font=player?'17px sans-serif':'15px sans-serif';ctx.textAlign='center';ctx.fillText(emoji,p[0],p[1]-24);ctx.restore()}
 function drawVehicle(x,y,color,name,player){let p=px(x,y);ctx.save();ctx.setTransform(dpr,0,0,dpr,0,0);ctx.fillStyle='#0003';ctx.beginPath();ctx.ellipse(p[0]+3,p[1]+5,25,9,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#222';ctx.fillRect(p[0]-20,p[1]-3,8,8);ctx.fillRect(p[0]+12,p[1]-3,8,8);ctx.fillStyle=color||'#bb4b3e';polygon2([[p[0]-25,p[1]-6],[p[0]-14,p[1]-15],[p[0]+10,p[1]-15],[p[0]+24,p[1]-6],[p[0]+23,p[1]+1],[p[0]-24,p[1]+1]],ctx.fillStyle);ctx.fillStyle='#a9d6dc';polygon2([[p[0]-10,p[1]-13],[p[0]+7,p[1]-13],[p[0]+13,p[1]-6],[p[0]-15,p[1]-6]],ctx.fillStyle);if(player){ctx.strokeStyle='#fff';ctx.lineWidth=2;ctx.strokeRect(p[0]-27,p[1]-18,54,27)}ctx.restore()}
};
})();
