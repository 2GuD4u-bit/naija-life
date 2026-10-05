(function(){const G=window.Game;let keys=G.keys;
window.Player={update:function(dt){let s=G.state;if(!s||document.getElementById('start-screen').classList.contains('hide')===false||G.ui.panel)return;
if(s.inside){if(keys.e){keys.e=false;s.inside=null;G.toast('You stepped back outside.')}return}
let up=keys.w||keys.arrowup,down=keys.s||keys.arrowdown,left=keys.a||keys.arrowleft,right=keys.d||keys.arrowright;let sx=(right?1:0)-(left?1:0),sy=(down?1:0)-(up?1:0),dx=(sx+sy)/Math.SQRT2,dy=(sy-sx)/Math.SQRT2;if(dx||dy){let len=Math.hypot(dx,dy);dx/=len;dy/=len;s.angle=Math.atan2(dy,dx);let mult=keys.shift?1.55:1;let speed=s.vehicle?215:keys.shift?170:112;if(['Rain','Heavy rain','Storm'].includes(s.weather))speed*=.82;if(s.vehicle&&s.fuel<=0)speed=0;let nx=s.x+dx*speed*mult*dt,ny=s.y+dy*speed*mult*dt;if(!blocked(nx,s.y))s.x=G.clamp(nx,20,G.W-20);if(!blocked(s.x,ny))s.y=G.clamp(ny,20,G.H-20);if(s.vehicle){let impact=G.world.cars.find(c=>c.name!==s.vehicle.name&&Math.hypot(c.x-s.x,c.y-s.y)<24);if(impact){s.health=Math.max(0,s.health-5);s.carDamage=Math.min(100,s.carDamage+8);s.x-=dx*22;s.y-=dy*22;if(Math.random()<.25){s.wanted=Math.min(3,s.wanted+1);G.toast('Traffic collision! Take care on the road.')}}s.fuel=Math.max(0,s.fuel-dt*.32);s.vehicle.x=s.x;s.vehicle.y=s.y;s.driving=Math.min(100,s.driving+dt*.004);G.missionEvent('drive',speed*mult*dt);if(G.world.roadX.some(x=>Math.abs(s.x-x)<48)&&G.world.roadY.some(y=>Math.abs(s.y-y)<48))s.carDamage=Math.min(100,s.carDamage+dt*.018)}else if(mult>1)s.energy=Math.max(0,s.energy-dt*.8);G.missionEvent('move',speed*mult*dt)}
for(let n of G.world.npcs){if(n.id!=='cop'&&n.scheduleHour!==s.hour){n.scheduleHour=s.hour;if(s.hour>=8&&s.hour<18){let wb=G.world.buildings.find(b=>b.id===n.workId);if(wb){n.tx=wb.x+wb.w/2;n.ty=wb.y+wb.h+18}}else if(s.hour>=18&&s.hour<22){n.tx=G.world.buildings[0].x+G.world.buildings[0].w/2;n.ty=G.world.buildings[0].y+G.world.buildings[0].h+18}else{n.tx=n.homeX;n.ty=n.homeY}}n.walkTimer-=dt;if(n.walkTimer<=0&&n.id!=='cop'&&(s.hour<8||s.hour>=22)){n.tx=n.x+(Math.random()-.5)*160;n.ty=n.y+(Math.random()-.5)*160;n.walkTimer=2+Math.random()*4}let ax=n.tx-n.x,ay=n.ty-n.y,l=Math.hypot(ax,ay);if(l>2){n.x+=ax/l*n.speed*dt;n.y+=ay/l*n.speed*dt}n.x=G.clamp(n.x,25,G.W-25);n.y=G.clamp(n.y,25,G.H-25);if(s.wanted>0&&n.react>0)n.react-=dt}
for(let c of G.world.cars){if(s.vehicle&&s.vehicle.name===c.name)continue;c.x+=((c.taxi?48:30)*dt);if(c.x>G.W-80)c.x=230; }
if(s.wanted>0){s.crimeCooldown-=dt;let officer=G.world.npcs.find(n=>n.job==='Police');if(!officer){officer={id:'cop',name:'Officer Danjuma',emoji:'👮🏾',x:s.x+240,y:s.y+160,tx:s.x,ty:s.y,speed:72,job:'Police',friend:0,react:0,walkTimer:0};G.world.npcs.push(officer)}let ox=s.x-officer.x,oy=s.y-officer.y,l=Math.hypot(ox,oy);if(l>18){officer.x+=ox/l*officer.speed*dt;officer.y+=oy/l*officer.speed*dt}if(l<24){G.arrest()}if(l>390){s.escapeTimer=(s.escapeTimer||0)+dt;if(s.escapeTimer>14){s.wanted=Math.max(0,s.wanted-1);s.escapeTimer=0;G.world.npcs=G.world.npcs.filter(n=>n.id!=='cop');G.toast(s.wanted?'You escaped the search. One wanted level remains.':'You lost the police. Keep your head down.');G.saveSilent()}}else s.escapeTimer=0}
if(G.world.nearBuilding(s.x,s.y))G.ui.nearby=G.world.nearBuilding(s.x,s.y);else G.ui.nearby=null;let npc=G.world.npcs.find(n=>Math.hypot(n.x-s.x,n.y-s.y)<47);if(npc)G.ui.nearby=npc;G.ui.hint=s.vehicle?'F · leave vehicle':G.ui.nearby?'E · interact with '+G.ui.nearby.name:'WASD · walk';},
interact:function(){let s=G.state;if(!s||s.inside)return;if(s.vehicle){s.vehicle=null;G.toast('You parked and stepped out.');return}let b=G.world.nearBuilding(s.x,s.y);if(b){s.inside=b.id;G.openBuilding(b);return}let n=G.world.npcs.find(n=>Math.hypot(n.x-s.x,n.y-s.y)<57);if(n){G.openPerson(n);return}G.toast('Nothing nearby to interact with.');},
enterCar:function(){let s=G.state;if(!s||s.inside)return;if(s.vehicle){s.vehicle=null;G.toast('You left the vehicle.');return}let c=G.world.cars.find(c=>Math.hypot(c.x-s.x,c.y-s.y)<62);if(!c){G.toast('Move closer to a vehicle first.');return}if(!c.owned&&!c.taxi){s.wanted=Math.min(3,s.wanted+1);G.missionEvent('crime');G.toast('You took an unattended car. Police may come looking.')}s.vehicle=c;s.driving=Math.min(100,s.driving+1);G.toast('Driving: '+c.name+' · use WASD, F to exit.');},
crime:function(){let s=G.state,n=G.world.npcs.find(n=>Math.hypot(n.x-s.x,n.y-s.y)<50);if(!n){G.toast('No one close enough.');return}if(s.crimeCooldown>0){G.toast('Give it a moment before causing more trouble.');return}s.cash+=1500;s.wanted=Math.min(3,s.wanted+1);s.crimeCooldown=15;n.react=10;s.reputation=Math.max(-20,s.reputation-2);G.missionEvent('crime');G.toast('You grabbed ₦1,500. Wanted level increased!');}};
function blocked(x,y){
 if(x<20||x>G.W-20||y<20||y>G.H-20)return true;
 if(x>1715&&y>340&&y<1570)return true;
 const lot=G.world.carDealership&&G.world.carDealership.lot;
 if(lot){
  const cx=lot.x+lot.w/2;
  if(x>=lot.x-7&&x<=lot.x+7&&y>lot.y+7&&y<lot.y+lot.h-7)return true;
  if(x>=lot.x+lot.w-7&&x<=lot.x+lot.w+7&&y>lot.y+7&&y<lot.y+lot.h-7)return true;
  if(y>=lot.y+lot.h-7&&y<=lot.y+lot.h+7&&x>lot.x+7&&x<lot.x+lot.w-7)return true;
  if(y>=lot.y-7&&y<=lot.y+7&&Math.abs(x-cx)>lot.gateWidth/2)return true;
 }
 if(G.world.carDealership&&G.world.carDealership.cars.some(c=>!c.interior&&Math.abs(x-c.x)<26&&Math.abs(y-c.y)<15))return true;
 return G.world.buildings.some(b=>x>b.x-11&&x<b.x+b.w+11&&y>b.y-13&&y<b.y+b.h+9);
}
function keyName(e){return e&&typeof e.key==='string'&&e.key?e.key.toLowerCase():''}
function isTextEntry(target){return !!(target&&target.closest&&target.closest('input,textarea,select,[contenteditable="true"]'))}
function keydown(e){let k=keyName(e);if(!k||e.isComposing||isTextEntry(e.target))return;if(!document.getElementById('start-screen').classList.contains('hide'))return;if(['arrowup','arrowdown','arrowleft','arrowright',' '].includes(k))e.preventDefault();if(G.ui.panel&&k!=='escape')return;keys[k]=true;if(e.repeat)return;if(k==='e')Player.interact();if(k==='f')Player.enterCar();if(k==='g')Player.crime();if(k==='escape'){if(G.ui.panel)G.closePanel();else if(G.state&&G.state.inside)G.state.inside=null}}
function keyup(e){let k=keyName(e);if(k)keys[k]=false}window.addEventListener('keydown',keydown);window.addEventListener('keyup',keyup);window.addEventListener('blur',()=>{for(let k in keys)keys[k]=false});})();






