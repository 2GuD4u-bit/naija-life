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
   const x=b.x,y=b.y,w0=b.w,h0=b.h,type=b.type;
   if(type==='construction'){drawConstructionSite(b);continue;}
   const floors=['apartment','government','hospital','hotel','university','bank','office'].includes(type)?3:2;
   const z=type==='apartment'?112:type==='government'?118:type==='hospital'?104:type==='hotel'?108:type==='university'?116:type==='mosque'?82:type==='church'?90:72;
   const base=b.color||'#bd9c73',variant=parseInt(String(b.id).replace(/\D/g,''),10)||0;
   const lot=[ [x-21,y-20],[x+w0+21,y-20],[x+w0+21,y+h0+23],[x-21,y+h0+23] ];
   poly([[x-27,y-14],[x+w0+30,y-14],[x+w0+43,y+h0+30],[x-17,y+h0+34]],'rgba(45,58,45,.22)');
   poly(lot,'#d5ccb4');
   poly([[x-10,y-9],[x+w0+10,y-9],[x+w0+10,y+h0+10],[x-10,y+h0+10]],variant%2?'#c1c2ad':'#b9bba8');
   // Warm plaster walls and darker street-facing sides give each building depth.
   const a=[x,y,0],bb=[x+w0,y,0],c=[x+w0,y+h0,0],d=[x,y+h0,0];
   poly([a,bb,[x+w0,y,z],[x,y,z]],shade(base,.82));
   poly([bb,c,[x+w0,y+h0,z],[x+w0,y,z]],shade(base,.62));
   poly([[x,y,z],[x+w0,y,z],[x+w0,y+h0,z],[x,y+h0,z]],shade(base,1.18),'#4c514c');
   // Raised roof edging and a contrasting roof surface.
   const lip=type==='apartment'||type==='government'||type==='hotel'?11:8;
   poly([[x-4,y-4,z],[x+w0+4,y-4,z],[x+w0+4,y-4,z+lip],[x-4,y-4,z+lip]],shade(base,.64));
   poly([[x+w0+4,y-4,z],[x+w0+4,y+h0+4,z],[x+w0+4,y+h0+4,z+lip],[x+w0+4,y-4,z+lip]],shade(base,.48));
   if(type==='mosque'||type==='church'){
     const peak=z+22;
     poly([[x,y,z+2],[x+w0/2,y,z+peak],[x+w0/2,y+h0,z+peak],[x,y+h0,z+2]],shade(base,.72));
     poly([[x+w0/2,y,z+peak],[x+w0,y,z+2],[x+w0,y+h0,z+2],[x+w0/2,y+h0,z+peak]],shade(base,.58));
     if(type==='church'){
       poly([[x+w0*.76,y+h0*.72,z],[x+w0*.9,y+h0*.72,z],[x+w0*.9,y+h0*.72,z+42],[x+w0*.76,y+h0*.72,z+42]],shade(base,.7));
       poly([[x+w0*.72,y+h0*.72,z+42],[x+w0*.94,y+h0*.72,z+42],[x+w0*.83,y+h0*.72,z+61]],'#b99052');
     }else{
       poly([[x+w0*.08,y+h0*.17,z],[x+w0*.2,y+h0*.17,z],[x+w0*.2,y+h0*.17,z+52],[x+w0*.08,y+h0*.17,z+52]],shade(base,.68));
       poly([[x+w0*.05,y+h0*.17,z+52],[x+w0*.23,y+h0*.17,z+52],[x+w0*.14,y+h0*.17,z+67]],'#d0ae58');
     }
   }
   // Repeated framed windows on both visible walls, arranged in storeys.
   const columns=Math.max(2,Math.floor(w0/37)),windowHeight=Math.min(15,z/(floors+1)*.62);
   for(let floor=0;floor<floors;floor++){
     const bottom=z*(.1+floor*.72/floors),top=bottom+windowHeight;
     for(let i=0;i<columns;i++){
       const wx=x+12+i*((w0-29)/columns),wy=y+13+i%2*3;
       poly([[wx,y-.6,bottom],[wx+13,y-.6,bottom],[wx+13,y-.6,top],[wx,y-.6,top]],'#9bcbd0','#e3e4d4');
       poly([[x+w0+.6,wy,bottom],[x+w0+.6,wy+13,bottom],[x+w0+.6,wy+13,top],[x+w0+.6,wy,top]],'#9bcbd0','#e3e4d4');
       if(type==='apartment'&&floor>0&&i===0){
         const rail=bottom+5;poly([[wx-3,y-5,rail],[wx+19,y-5,rail],[wx+19,y-5,rail+3],[wx-3,y-5,rail+3]],'#495d60');
       }
     }
   }
   // Entrance, steps and a colorful shop canopy make street-level destinations readable.
   const doorX=x+w0*.66,doorY=y+h0-20;
   poly([[doorX,doorY,1],[doorX+17,doorY,1],[doorX+17,doorY,z*.55],[doorX,doorY,z*.55]],'#50352a','#382c25');
   poly([[doorX-5,doorY+2,1],[doorX+23,doorY+2,1],[doorX+23,doorY+8,1],[doorX-5,doorY+8,1]],'#bcb4a1');
   if(['market','restaurant','club','office'].includes(type)){
     const awning=['#e8a34e','#df765e','#46a77b','#648cb6'][variant%4];
     poly([[x+w0*.28,y+h0+2,z*.47],[x+w0*.84,y+h0+2,z*.47],[x+w0*.84,y+h0+19,z*.4],[x+w0*.28,y+h0+19,z*.4]],awning,'#fff1d7');
   }
   // Selected roofs carry details associated with the building's use.
   if(type==='apartment'){
     poly([[x+w0*.67,y+h0*.18,z+lip],[x+w0*.9,y+h0*.18,z+lip],[x+w0*.9,y+h0*.38,z+lip],[x+w0*.67,y+h0*.38,z+lip]],'#6b8790','#e1e5d5');
     poly([[x+w0*.7,y+h0*.2,z+lip+3],[x+w0*.87,y+h0*.2,z+lip+3],[x+w0*.87,y+h0*.36,z+lip+3],[x+w0*.7,y+h0*.36,z+lip+3]],'#4f737b');
   }else if(['bank','office','university','hotel'].includes(type)){
     for(let panel=0;panel<2;panel++){const rx=x+w0*(.16+panel*.25),ry=y+h0*.18;poly([[rx,ry,z+lip+1],[rx+w0*.18,ry,z+lip+1],[rx+w0*.18,ry+h0*.22,z+lip+1],[rx,ry+h0*.22,z+lip+1]],'#344958','#d6d9c7');}
   }
   const center=px(x+w0/2,y+h0/2,z+lip+8);drawLabel(center[0],center[1],b.icon+' '+b.name);
 }
 function drawConstructionSite(b){
   const cx=b.x+b.w/2,cy=b.y+b.h/2,sx=cx-135,sy=cy-95,sw=270,sd=190,fx=cx-90,fy=cy-64,fw=180,fd=128,floors=5,floorH=47,totalH=floors*floorH;
   const line3=(a,b,color,width)=>{const p=px(a[0],a[1],a[2]||0),q=px(b[0],b[1],b[2]||0);ctx.beginPath();ctx.moveTo(p[0],p[1]);ctx.lineTo(q[0],q[1]);ctx.strokeStyle=color;ctx.lineWidth=width*scale;ctx.lineCap='square';ctx.stroke()};
   const box=(x,y,w,d,h,color,topColor)=>{poly([[x,y,0],[x+w,y,0],[x+w,y,h],[x,y,h]],shade(color,.78));poly([[x+w,y,0],[x+w,y+d,0],[x+w,y+d,h],[x+w,y,h]],shade(color,.6));poly([[x,y,h],[x+w,y,h],[x+w,y+d,h],[x,y+d,h]],topColor||shade(color,1.16),'#4b5050')};
   const fence=(a,b,h=43)=>{poly([[a[0],a[1],0],[b[0],b[1],0],[b[0],b[1],h],[a[0],a[1],h]],'#176477','#123f4c');for(let t=.12;t<1;t+=.12){const x=a[0]+(b[0]-a[0])*t,y=a[1]+(b[1]-a[1])*t;line3([x,y,0],[x,y,h],'#397d89',1.2)}line3([a[0],a[1],h],[b[0],b[1],h],'#8da4a0',2)};
   poly([[sx,sy,0],[sx+sw,sy,0],[sx+sw,sy+sd,0],[sx,sy+sd,0]],'#b78e58');
   poly([[sx+18,sy+16,1],[sx+sw-15,sy+16,1],[sx+sw-20,sy+sd-18,1],[sx+18,sy+sd-18,1]],'#c7a26a');
   // Perimeter fence with a wide equipment entrance at the front.
   fence([sx,sy],[sx+sw,sy]);fence([sx,sy],[sx,sy+sd]);fence([sx+sw,sy],[sx+sw,sy+sd]);
   fence([sx,sy+sd],[sx+sw*.31,sy+sd]);fence([sx+sw*.69,sy+sd],[sx+sw,sy+sd]);
   // Concrete foundation, five unfinished floor plates and an exposed column grid.
   poly([[fx,fy,0],[fx+fw,fy,0],[fx+fw,fy+fd,0],[fx,fy+fd,0]],'#7b7e79','#626a68');
   const gx=[fx+8,fx+fw/2,fx+fw-8],gy=[fy+8,fy+fd/2,fy+fd-8];
   for(let f=0;f<=floors;f++){
     const z=f*floorH;
     if(f>0)poly([[fx,fy,z],[fx+fw,fy,z],[fx+fw,fy+fd,z],[fx,fy+fd,z]],f%2?'#969993':'#858a85','#656d69');
     for(const xx of gx){line3([xx,fy,z],[xx,fy,z+floorH],'#a5a59b',7);line3([xx,fy+fd,z],[xx,fy+fd,z+floorH],'#a5a59b',7)}
     for(const yy of gy){line3([fx,yy,z],[fx,yy,z+floorH],'#999b93',7);line3([fx+fw,yy,z],[fx+fw,yy,z+floorH],'#93968f',7)}
     line3([fx,fy,z],[fx+fw,fy,z],'#b0afa5',6);line3([fx,fy+fd,z],[fx+fw,fy+fd,z],'#a5a69d',6);line3([fx,fy,z],[fx,fy+fd,z],'#a1a39a',6);line3([fx+fw,fy,z],[fx+fw,fy+fd,z],'#8e928b',6);
   }
   // Partial lower-floor infill and exposed rebar on the unfinished top deck.
   box(fx+8,fy+fd-8,fw*.34,5,50,'#71817c','#82908a');box(fx+fw*.62,fy+fd-8,fw*.34,5,92,'#607884','#718894');
   for(const xx of [fx+16,fx+fw*.36,fx+fw*.62,fx+fw-16])for(let n=0;n<4;n++)line3([xx+n*2,fy+18,totalH],[xx+n*2,fy+18,totalH+18],'#6b6254',1.3);
   // Scaffolding climbs one facade with cross braces and narrow work decks.
   const scaffoldX=fx+fw+9;for(let z=18;z<totalH-8;z+=floorH){line3([scaffoldX,fy+5,z],[scaffoldX,fy+fd-5,z],'#a95e32',2);line3([scaffoldX,fy+5,z+floorH],[scaffoldX,fy+fd-5,z+floorH],'#a95e32',2);line3([scaffoldX,fy+5,z],[scaffoldX,fy+fd-5,z+floorH],'#c0783d',1.2);line3([scaffoldX,fy+fd-5,z],[scaffoldX,fy+5,z+floorH],'#c0783d',1.2)}
   // Tower crane: lattice mast, triangulated jib, operator cab, cable and hook.
   const tx=sx+48,ty=sy+47,craneH=totalH+145;
   for(const ox of [-8,8])for(const oy of [-8,8])line3([tx+ox,ty+oy,0],[tx+ox,ty+oy,craneH],'#b98422',3);
   for(let z=0;z<craneH-25;z+=25){for(const side of [-1,1]){line3([tx-8,ty+side*8,z],[tx+8,ty+side*8,z+25],'#c4932f',1.5);line3([tx+8,ty+side*8,z],[tx-8,ty+side*8,z+25],'#c4932f',1.5)}}
   const top=craneH,boom=205;
   line3([tx-64,ty,top],[tx+boom,ty,top],'#bd8c29',5);line3([tx-64,ty,top+11],[tx+boom,ty,top+11],'#d0a243',3);
   for(let x=tx-55;x<tx+boom-5;x+=20){line3([x,ty,top],[x+20,ty,top+11],'#bd8c29',1.5);line3([x,ty,top+11],[x+20,ty,top],'#bd8c29',1.5)}
   line3([tx-64,ty,top],[tx-64,ty,top+11],'#bd8c29',3);line3([tx+boom,ty,top],[tx+boom,ty,top+11],'#bd8c29',3);
   box(tx-19,ty-12,28,24,24,'#536568','#7c9393');box(tx+9,ty-15,22,30,28,'#e7e2cc','#a9c4c6');
   line3([tx+boom-12,ty,top+5],[tx+boom-12,ty,top-92],'#464d4d',1.5);line3([tx+boom-12,ty,top-92],[tx+boom-20,ty,top-103],'#252d2e',3);line3([tx+boom-20,ty,top-103],[tx+boom-8,ty,top-103],'#252d2e',3);
   // A small mobile crane and work materials make the fenced yard feel active.
   drawVehicle(sx+sw*.57,sy+sd*.69,'#c95840','Site loader');line3([sx+sw*.57,sy+sd*.69,14],[sx+sw*.38,sy+sd*.48,158],'#b94e3b',9);line3([sx+sw*.38,sy+sd*.48,158],[sx+sw*.32,sy+sd*.43,158],'#d4b17a',3);
   box(sx+sw*.74,sy+sd*.24,38,28,24,'#89938c','#b4b8aa');box(sx+sw*.23,sy+sd*.74,25,20,14,'#9a6f47','#be9560');box(sx+sw*.31,sy+sd*.77,21,18,10,'#6f765f','#9b956e');
   for(let i=0;i<4;i++){const bx=sx+sw*(.42+i*.05),by=sy+sd*.88;line3([bx,by,0],[bx,by,19],'#d16b34',2);line3([bx-4,by,14],[bx+4,by,14],'#e3b56e',1)}
   const tag=px(cx,sy+sd+4,19);drawLabel(tag[0],tag[1],b.icon+' '+b.name);
 }
 // Palm and shade trees along the blocks, outside the travel lanes.
 for(let i=0;i<52;i++){let x=(i*173+120)%G.W,y=(i*127+80)%G.H;if(G.world.roadX.some(r=>Math.abs(r-x)<86)||G.world.roadY.some(r=>Math.abs(r-y)<86)||G.world.buildings.some(b=>b.type==='construction'&&x>b.x-145&&x<b.x+b.w+145&&y>b.y-105&&y<b.y+b.h+105))continue;drawTree(x,y,1)}
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
