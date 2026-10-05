(function(){
const BASE={name:'Amara',gender:'woman',skin:'dark',hair:'curls',outfit:'green',x:965,y:700,angle:0,health:100,hunger:84,energy:92,happiness:78,fitness:10,intelligence:12,driving:5,reputation:0,cash:8500,bank:0,investments:0,day:1,realDate:null,hour:8,minute:0,weather:'Sunny',wanted:0,job:null,jobLevel:0,shiftsCompleted:0,business:null,home:'Room in Wuse',rent:3500,inventory:['Phone','Water'],ownedVehicles:[],vehicle:null,fuel:68,carDamage:0,inside:null,missions:0,completed:[],relationships:{},visited:[],crimeCooldown:0,escapeTimer:0,goalProgress:0,phoneMessages:{},electionVotes:{}};
window.Game={W:2200,H:1700,view:{w:innerWidth,h:innerHeight,scale:1,baseScale:1,zoom:1,panX:0,panY:0,cameraX:0,cameraY:0},keys:{},state:null,ui:{panel:'',panelTab:'',nearby:null,hint:''},world:{buildings:[],npcs:[],cars:[],rain:[]},lastSave:0,lastTime:0,running:false};
Game.newState=function(name,gender,skin,hair,outfit){Game.state=structuredClone(BASE);Game.state.name=name||'Amara';Game.state.gender=gender||'woman';Game.state.skin=skin||'dark';Game.state.hair=hair||'curls';Game.state.outfit=outfit||'green';Game.state.realDate=Game.timeInfo().dateKey;Game.state.hour=Game.timeInfo().hour24;Game.state.minute=Number(Game.timeInfo().minute);Game.state.x=1010;Game.state.y=744;Game.state.cash=8500;Game.state.completed=[];Game.state.missions=0;localStorage.removeItem('naija-life-save');};
Game.save=function(){if(!Game.state)return;try{localStorage.setItem('naija-life-save',JSON.stringify({state:Game.state,at:Date.now()}));Game.lastSave=Date.now();Game.toast('Game saved on this device.')}catch(e){Game.toast('Could not save: browser storage is unavailable.')}};
Game.load=function(){try{let d=JSON.parse(localStorage.getItem('naija-life-save')||'null');if(!d||!d.state)return false;Game.state=Object.assign(structuredClone(BASE),d.state);return true}catch(e){return false}};
Game.toast=function(message){let el=document.getElementById('toast');if(!el)return;el.textContent=message;el.classList.add('show');clearTimeout(Game.toastTimer);Game.toastTimer=setTimeout(()=>el.classList.remove('show'),2400)};
Game.timeInfo=function(){const now=new Date();const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Africa/Lagos',weekday:'short',day:'numeric',month:'long',year:'numeric',hour:'numeric',minute:'2-digit',second:'2-digit',hour12:true}).formatToParts(now);const get=k=>parts.find(p=>p.type===k)?.value||'';const h24=Number(new Intl.DateTimeFormat('en-GB',{timeZone:'Africa/Lagos',hour:'2-digit',hourCycle:'h23'}).format(now));const iso=new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Lagos',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);const isoGet=k=>iso.find(p=>p.type===k)?.value||'';return{weekday:get('weekday'),day:get('day'),month:get('month'),year:get('year'),hour:Number(get('hour')),minute:get('minute'),second:get('second'),period:get('dayPeriod').toUpperCase(),hour24:h24,dateKey:`${isoGet('year')}-${isoGet('month')}-${isoGet('day')}`, dateLine:`${get('weekday')} ${get('day')} ${get('month')} · Abuja`,phoneTime:`${Number(get('hour'))}:${get('minute')} ${get('dayPeriod').toUpperCase()}`,clock:`${get('weekday').toUpperCase()} · ${Number(get('hour'))}:${get('minute')} ${get('dayPeriod').toUpperCase()}`}};
Game.clockText=function(){return Game.timeInfo().clock};Game.money=function(n){return '₦'+Math.round(n).toLocaleString('en-NG')};
Game.clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
})();








