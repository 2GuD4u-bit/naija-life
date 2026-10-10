(function(){
const G=window.Game;
G.W=14400;G.H=9600;
G.world.mapMeta={name:'Abuja Metropolitan Area',units:'metres',chunkSize:800,cellSize:600,version:3};
G.world.districts=[
 {id:'wuse-central',name:'Wuse & Central',bounds:{x:0,y:0,w:2400,h:2400},style:'mixed-urban'},
 {id:'garki-area-11',name:'Garki & Area 11',bounds:{x:0,y:2400,w:2400,h:2400},style:'commercial-residential'},
 {id:'maitama',name:'Maitama',bounds:{x:2400,y:0,w:2400,h:2400},style:'low-rise-estate'},
 {id:'central-business-district',name:'Central Business District',bounds:{x:2400,y:2400,w:2400,h:2400},style:'modern-civic'},
 {id:'jabi-utako',name:'Jabi & Utako',bounds:{x:4800,y:0,w:2400,h:2400},style:'mixed-modern'},
 {id:'asokoro',name:'Asokoro',bounds:{x:4800,y:2400,w:2400,h:2400},style:'hillside-residential'},
 {id:'gwarinpa',name:'Gwarinpa',bounds:{x:7200,y:0,w:2400,h:2400},style:'planned-residential'},
 {id:'airport-lugbe',name:'Airport & Lugbe',bounds:{x:7200,y:4800,w:2400,h:2400},style:'airport-corridor'},
 {id:'idu-rail',name:'Idu & Rail District',bounds:{x:7200,y:2400,w:2400,h:2400},style:'industrial-rail'},
 {id:'apo-durumi',name:'Apo & Durumi',bounds:{x:0,y:4800,w:2400,h:2400},style:'commercial-residential'},
 {id:'guzape',name:'Guzape',bounds:{x:2400,y:4800,w:2400,h:2400},style:'hillside-residential'},
 {id:'lokogoma',name:'Lokogoma',bounds:{x:4800,y:4800,w:2400,h:2400},style:'planned-residential'},
 {id:'lugbe-south',name:'Lugbe South',bounds:{x:7200,y:7200,w:2400,h:2400},style:'airport-corridor'},
 {id:'gwarinpa-extension',name:'Gwarinpa Extension',bounds:{x:9600,y:0,w:2400,h:2400},style:'planned-residential'},
 {id:'bwari',name:'Bwari & Kubwa North',bounds:{x:12000,y:0,w:2400,h:2400},style:'suburban-centre'},
 {id:'jahi-kado',name:'Jahi & Kado',bounds:{x:9600,y:2400,w:2400,h:2400},style:'mixed-modern'},
 {id:'idu-west',name:'Idu West',bounds:{x:12000,y:2400,w:2400,h:2400},style:'industrial-rail'},
 {id:'airport-city',name:'Airport City',bounds:{x:9600,y:4800,w:2400,h:2400},style:'airport-corridor'},
 {id:'kuje-corridor',name:'Kuje Corridor',bounds:{x:12000,y:4800,w:2400,h:2400},style:'suburban-centre'},
 {id:'apo-estates',name:'Apo Estates',bounds:{x:0,y:7200,w:2400,h:2400},style:'planned-residential'},
 {id:'guzape-south',name:'Guzape South',bounds:{x:2400,y:7200,w:2400,h:2400},style:'hillside-residential'},
 {id:'lokogoma-south',name:'Lokogoma South',bounds:{x:4800,y:7200,w:2400,h:2400},style:'planned-residential'},
 {id:'karu-corridor',name:'Karu Corridor',bounds:{x:9600,y:7200,w:2400,h:2400},style:'suburban-centre'},
 {id:'mpape-bwari',name:'Mpape & Bwari',bounds:{x:12000,y:7200,w:2400,h:2400},style:'hillside-residential'}
];
G.world.districtsById=Object.fromEntries(G.world.districts.map(d=>[d.id,d]));
G.world.districtAt=function(x,y){return G.world.districts.find(d=>x>=d.bounds.x&&x<=d.bounds.x+d.bounds.w&&y>=d.bounds.y&&y<=d.bounds.y+d.bounds.h)?.name||'Abuja Region'};
const defs=[
 {id:'b0',name:'Wuse Market',icon:'🧺',type:'market',x:700,y:405,w:56,h:42,desc:'Shop for food and everyday things.',asset:'market'},
 {id:'b1',name:'First Abuja Bank',icon:'🏦',type:'bank',x:1020,y:406,w:55,h:44,desc:'Use the ATM, deposit cash, or send a transfer.',asset:'bank'},
 {id:'b2',name:'City Clinic',icon:'✚',type:'hospital',x:1345,y:406,w:50,h:44,desc:'Recover health and get basic care.',asset:'clinic'},
 {id:'b3',name:'Central Police Post',icon:'🚔',type:'police',x:1655,y:406,w:55,h:44,desc:'Pay a fine or turn yourself in.',asset:'police-post'},
 {id:'b4',name:'Civic Centre',icon:'🏛️',type:'government',x:450,y:908,w:58,h:46,desc:'Public services and city notices.',asset:'civic-centre'},
 {id:'b5',name:'Oja Kitchen',icon:'🍲',type:'restaurant',x:710,y:908,w:48,h:40,desc:'Grab a hot plate of jollof rice.',asset:'restaurant'},
 {id:'abujacar_car_stand',name:'ABUJACAR CAR DEALERSHIP',icon:'🚘',type:'dealer',x:8070,y:3890,w:420,h:340,desc:'A flagship luxury vehicle dealership with sales, trade-in, finance, and service facilities.',asset:'abujacar-showroom',district:'idu-rail',rotation:0,scale:1,interior:{type:'showroom'},roadConnections:['idu-service-road'],interactionPoint:{x:8280,y:3874},collision:{x:8070,y:3890,w:420,h:340},lod:{high:650,medium:1600,low:3000}},
 {id:'b7',name:'Fuel Point',icon:'⛽',type:'fuel',x:1348,y:908,w:50,h:38,desc:'Fill your tank.',asset:'fuel-station'},
 {id:'b8',name:'Unity Apartments',icon:'🏢',type:'apartment',x:1657,y:908,w:62,h:54,desc:'Your affordable room is here.',asset:'apartment'},
 {id:'b9',name:'Northside Gym',icon:'🏋️',type:'gym',x:450,y:1410,w:50,h:40,desc:'Train fitness and improve your mood.',asset:'gym'},
 {id:'b10',name:'Capital University',icon:'🎓',type:'university',x:710,y:1410,w:62,h:46,desc:'Study and build your skills.',asset:'school'},
 {id:'b11',name:'Abuja Bus Terminal',icon:'🚌',type:'bus',x:1018,y:1410,w:70,h:46,desc:'Catch a ride to another district.',asset:'bus-terminal'},
 {id:'b12',name:'Sunset Lounge',icon:'🎵',type:'club',x:1347,y:1410,w:58,h:42,desc:'The city gets lively after dark.',asset:'nightlife'},
 {id:'b13',name:'Workshop 9',icon:'🔧',type:'mechanic',x:1655,y:1410,w:60,h:44,desc:'Repair and service your vehicle.',asset:'workshop'},
 {id:'b14',name:'Maitama Estate',icon:'🏡',type:'estate',x:2780,y:1540,w:44,h:38,desc:'A quiet, gated neighborhood.',asset:'estate-gate',district:'maitama'},
 {id:'b15',name:'City General Hospital',icon:'🏥',type:'hospital',x:400,y:655,w:62,h:48,desc:'Emergency and medical care.',asset:'hospital'},
 {id:'b16',name:'Jabi Waterfront',icon:'🌊',type:'waterfront',x:5960,y:1540,w:72,h:48,desc:'Take in the lakeside and relax.',asset:'waterfront'},
 {id:'b17',name:'Tech Yard',icon:'💻',type:'office',x:720,y:1120,w:54,h:42,desc:'A small studio is hiring freelancers.',asset:'office'},
 {id:'b18',name:'Palm Grove Hotel',icon:'🛎️',type:'hotel',x:1010,y:1120,w:58,h:44,desc:'Stay a night or look for hospitality work.',asset:'hotel'},
 {id:'b19',name:'Building Site',icon:'🏗️',type:'construction',x:1180,y:550,w:62,h:48,desc:'Short construction shifts are often available.',asset:'construction-site'},
 {id:'b20',name:'Nnamdi Azikiwe International Airport',icon:'✈️',type:'airport',x:7850,y:5940,w:900,h:600,desc:'Abuja’s airport connects the capital to cities across Nigeria and beyond.',asset:'airport',district:'airport-lugbe',collision:false,interactionPoint:{x:8300,y:6250}},
 {id:'b21',name:'Wuse District Mosque',icon:'🕌',type:'mosque',x:185,y:660,w:46,h:40,desc:'A peaceful place to pause.',asset:'mosque'},
 {id:'b22',name:'New Dawn Church',icon:'⛪',type:'church',x:1860,y:410,w:50,h:40,desc:'A neighborhood gathering place.',asset:'church'},
 {id:'loc-cbn',name:'Central Bank of Nigeria',icon:'🏦',type:'bank',x:2820,y:650,w:142,h:96,desc:'The Central Bank headquarters anchors Abuja’s civic and financial quarter.',asset:'central-bank',district:'maitama'},
 {id:'loc-central-mosque',name:'Abuja National Mosque',icon:'🕌',type:'mosque',x:3400,y:680,w:150,h:126,desc:'A landmark mosque with a central dome, minarets, and landscaped grounds.',asset:'national-mosque',district:'maitama'},
 {id:'loc-police-hq',name:'Abuja Police Headquarters',icon:'🚔',type:'police',x:3810,y:680,w:118,h:84,desc:'Federal policing and public safety services.',asset:'police-headquarters',district:'maitama'},
 {id:'loc-national-church',name:'National Christian Centre',icon:'⛪',type:'church',x:4260,y:1290,w:142,h:112,desc:'A civic landmark and place of worship in the capital.',asset:'national-church',district:'maitama'},
 {id:'loc-4u-supermarket',name:'4U Supermarket',icon:'🛒',type:'market',x:2820,y:1930,w:60,h:44,desc:'Groceries, household essentials, and everyday shopping.',asset:'supermarket',district:'maitama'},
 {id:'loc-jabi-mall',name:'Jabi Lake Mall',icon:'🛍️',type:'mall',x:5400,y:1460,w:220,h:142,desc:'A major shopping and leisure destination beside Jabi Lake.',asset:'shopping-mall',district:'jabi-utako'},
 {id:'loc-idu-rail',name:'Idu Railway Station',icon:'🚆',type:'railway',x:7770,y:3180,w:210,h:110,desc:'The capital’s intercity rail connection at Idu.',asset:'railway-station',district:'idu-rail'},
 {id:'loc-manga-car-stand',name:'Manga Car Stand',icon:'🚘',type:'dealer',x:550,y:2800,w:102,h:72,desc:'Browse new and used vehicles in the Area 11 motor district.',asset:'manga-car-stand',district:'garki-area-11'},
 {id:'loc-abana-car-stand',name:'Abana Car Stand',icon:'🚙',type:'dealer',x:10680,y:960,w:102,h:72,desc:'Vehicle sales and trade-in services in the Gwarinpa extension.',asset:'abana-car-stand',district:'gwarinpa-extension'},
 {id:'loc-sarkin-mota',name:'Sarkin Mota Car Stand',icon:'🚗',type:'dealer',x:10500,y:5200,w:108,h:76,desc:'An Abuja vehicle showroom and customer parking area in Airport City.',asset:'sarkin-mota-car-stand',district:'airport-city'},
 {id:'loc-blucabana',name:'Blucabana Restaurant',icon:'🎶',type:'club',x:5120,y:3320,w:132,h:92,desc:'A lively Abuja dining and entertainment destination with garden seating.',asset:'nightlife',district:'asokoro'},
 {id:'loc-the-vue',name:'The Vue',icon:'🍽️',type:'restaurant',x:5840,y:4380,w:132,h:92,desc:'A modern dining destination in the capital.',asset:'restaurant',district:'asokoro'},
 {id:'loc-cilantro',name:'Cilantro Abuja',icon:'🍛',type:'restaurant',x:6620,y:1360,w:132,h:92,desc:'A contemporary restaurant serving Indian cuisine.',asset:'restaurant',district:'jabi-utako'},
 {id:'loc-a-class',name:'A Class Restaurant',icon:'🍴',type:'restaurant',x:7260,y:3320,w:132,h:92,desc:'Dining and hospitality in Abuja.',asset:'restaurant',district:'idu-rail'},
 {id:'loc-istanbul',name:'Istanbul Restaurant & Café',icon:'☕',type:'restaurant',x:10900,y:3210,w:132,h:92,desc:'A welcoming restaurant and café in Jahi and Kado.',asset:'restaurant',district:'jahi-kado'},
 {id:'loc-vibes-by-anns',name:'Vibes by Ann’s',icon:'🎵',type:'club',x:1620,y:3370,w:132,h:92,desc:'Music, food, and nightlife in the Garki commercial district.',asset:'nightlife',district:'garki-area-11'},
 {id:'loc-city-view',name:'City View Restaurant',icon:'🌇',type:'restaurant',x:5440,y:3970,w:132,h:92,desc:'An elevated dining experience overlooking the capital.',asset:'restaurant',district:'asokoro'},
 {id:'loc-garki-hospital',name:'Garki Medical Centre',icon:'🏥',type:'hospital',x:1920,y:3850,w:74,h:58,desc:'Medical care and emergency services for the southern districts.',asset:'hospital',district:'garki-area-11'},
 {id:'loc-garki-fuel',name:'Capital Fuel Station',icon:'⛽',type:'fuel',x:4540,y:2140,w:60,h:42,desc:'Fuel, air, and basic roadside services.',asset:'fuel-station',district:'maitama'},
 {id:'loc-garki-bus',name:'Area 1 Transit Hub',icon:'🚌',type:'bus',x:1850,y:3620,w:88,h:56,desc:'Local and cross-city bus connections.',asset:'bus-terminal',district:'garki-area-11'},
 {id:'estate-gwarinpa-gate',name:'Gwarinpa Estate',icon:'🏘️',type:'estate',x:7580,y:1510,w:46,h:40,desc:'A planned residential community with 50 home plots, local streets, and a secure entrance.',asset:'estate-gate',district:'gwarinpa',isEstateGate:true},
 {id:'estate-maitama-gate',name:'Maitama Gardens',icon:'🏡',type:'estate',x:3000,y:1800,w:46,h:40,desc:'A garden estate with 100 home plots and reserved room for later phases.',asset:'estate-gate',district:'maitama',isEstateGate:true},
 {id:'loc-jabi-park',name:'Jabi Lake Park',icon:'🌳',type:'park',x:6900,y:1510,w:160,h:118,desc:'Public green space, lake walks, and open-air recreation beside Jabi Lake.',asset:'park',district:'jabi-utako'},
 {id:'loc-aso-rock',name:'Aso Rock',icon:'🪨',type:'landmark',x:5230,y:2920,w:420,h:320,desc:'A dramatic Abuja granite outcrop rising above the capital, with foothills and open green space.',asset:'aso-rock',district:'asokoro',collision:true},
 {id:'loc-devolt-mould',name:'Devolt Mould Flagship',icon:'🧵',type:'fashion',x:3650,y:3380,w:190,h:130,desc:'A premium Abuja fashion house with Ankara and contemporary collections, a glass-front showroom, and a full clothing floor.',asset:'devolt-mould-flagship',district:'central-business-district',interior:{type:'fashion'},interactionPoint:{x:3745,y:3364},collision:{x:3650,y:3380,w:190,h:112},roadConnections:['capital-boulevard'],lod:{high:380,medium:1100,low:2100}},
 {id:'loc-kubwa-market',name:'Kubwa Market',icon:'🧺',type:'market',x:12700,y:930,w:118,h:78,desc:'A busy neighborhood market serving Kubwa and the northern districts.',asset:'market',district:'bwari'},
 {id:'loc-bwari-clinic',name:'Bwari Community Hospital',icon:'🏥',type:'hospital',x:12900,y:3010,w:110,h:82,desc:'Community healthcare and emergency services for northern Abuja.',asset:'hospital',district:'idu-west'},
 {id:'loc-gudu-transit',name:'Gudu Transit Hub',icon:'🚌',type:'bus',x:1700,y:5630,w:118,h:78,desc:'Bus connections between Garki, Apo, and southern Abuja.',asset:'bus-terminal',district:'apo-durumi'},
 {id:'loc-airport-hotel',name:'Airport View Hotel',icon:'🛎️',type:'hotel',x:10100,y:5580,w:118,h:82,desc:'An airport-side hotel with a shaded garden, restaurant, and visitor parking.',asset:'hotel',district:'airport-city'},
 {id:'loc-north-park',name:'Kubwa Green Park',icon:'🌳',type:'park',x:13200,y:1690,w:150,h:110,desc:'A neighborhood park with shaded walks and recreation lawns.',asset:'park',district:'bwari'},
 {id:'estate-apo-gate',name:'Apo Garden Estate',icon:'🏘️',type:'estate',x:1770,y:7790,w:50,h:42,desc:'A quiet southern estate with landscaped lanes and family homes.',asset:'estate-gate',district:'apo-estates',isEstateGate:true},
 {id:'estate-kubwa-gate',name:'Kubwa Green Estate',icon:'🏘️',type:'estate',x:12680,y:2150,w:50,h:42,desc:'A secure northern neighborhood with local streets and family homes.',asset:'estate-gate',district:'bwari',isEstateGate:true},
 {id:'estate-lugbe-gate',name:'Lugbe Gardens',icon:'🏡',type:'estate',x:8780,y:7800,w:50,h:42,desc:'A landscaped residential estate connected to the southern expressway.',asset:'estate-gate',district:'lugbe-south',isEstateGate:true}
];
const colors=['#c9a279','#7d96a2','#d5c9aa','#b87c6d','#91a37e','#c58a66','#737f89','#b9a174'];
const buildingScale={market:[34,26],bank:[32,26],hospital:[76,60],police:[42,30],government:[52,38],restaurant:[26,21],dealer:[58,42],fuel:[32,26],apartment:[52,40],estate:[26,20],gym:[30,25],university:[110,76],bus:[82,48],club:[42,32],mechanic:[36,26],waterfront:[68,46],office:[32,24],hotel:[62,46],construction:[110,82],airport:[380,190],mosque:[96,78],church:[64,46],mall:[160,105],railway:[170,64],park:[112,88],landmark:[320,250]};
G.world.buildings=[];
G.world.registerLocation=function(def){
 if(!def||typeof def.id!=='string'||!def.id||G.world.buildings.some(b=>b.id===def.id))throw new Error('Location needs a unique id.');
 if(!Number.isFinite(def.x)||!Number.isFinite(def.y))throw new Error('Location needs finite world coordinates.');
 const defaults=buildingScale[def.type]||[42,32],w=Number.isFinite(def.w)&&def.w>0?def.w:defaults[0],h=Number.isFinite(def.h)&&def.h>0?def.h:defaults[1],b={...def,assetBounds:def.assetBounds?{...def.assetBounds}:undefined,w,h,rotation:Number(def.rotation)||0,scale:Number(def.scale)||1,district:def.district||'wuse-central',asset:def.asset||def.type,collision:def.collision===false?false:(def.collision||{x:def.x,y:def.y,w,h}),interactionPoint:def.interactionPoint||{x:def.x+w/2,y:def.y+h+12},lod:def.lod||{high:230,medium:750,low:1700},color:def.color||colors[G.world.buildings.length%colors.length],roadConnections:def.roadConnections||[],bounds:{x:def.x,y:def.y,w,h}};
 G.world.buildings.push(b);if(G.world.locationsById)G.world.locationsById[b.id]=b;G.world.threeWorld?.refreshLocation?.(b,null);return b;
};
defs.forEach(G.world.registerLocation);
G.world.locationsById=Object.fromEntries(G.world.buildings.map(b=>[b.id,b]));
G.world.getLocation=function(id){return G.world.locationsById[id]||null};
G.world.repositionLocation=function(id,patch={}){const b=G.world.getLocation(id);if(!b)return false;const previous={x:b.x,y:b.y,w:b.w,h:b.h,assetBounds:b.assetBounds?{...b.assetBounds}:null,interactionPoint:b.interactionPoint?{...b.interactionPoint}:null},oldCollision=b.collision&&typeof b.collision==='object'?{...b.collision}:null,x=Number.isFinite(patch.x)?patch.x:b.x,y=Number.isFinite(patch.y)?patch.y:b.y,w=Number.isFinite(patch.w)?patch.w:b.w,h=Number.isFinite(patch.h)?patch.h:b.h,dx=x-previous.x,dy=y-previous.y;b.x=x;b.y=y;b.w=w;b.h=h;b.bounds={x,y,w,h};if(oldCollision)b.collision={...oldCollision,x:x+(oldCollision.x-previous.x),y:y+(oldCollision.y-previous.y),w:oldCollision.w*(w/previous.w),h:oldCollision.h*(h/previous.h)};if(id==='abujacar_car_stand'&&G.world.carDealership){const site=G.world.carDealership;site.lot.x+=dx;site.lot.y+=dy;site.showroom.x+=dx;site.showroom.y+=dy;site.workshop.x+=dx;site.workshop.y+=dy;for(const car of site.cars){car.x+=dx;car.y+=dy}b.assetBounds={...site.lot}}else if(previous.assetBounds){b.assetBounds={...previous.assetBounds,x:previous.assetBounds.x+dx,y:previous.assetBounds.y+dy,w:previous.assetBounds.w*(w/previous.w),h:previous.assetBounds.h*(h/previous.h)}}if(patch.rotation!==undefined)b.rotation=Number(patch.rotation)||0;if(patch.scale!==undefined)b.scale=Number(patch.scale)||1;if(patch.interactionPoint)b.interactionPoint={...patch.interactionPoint};else if(id==='abujacar_car_stand'&&G.world.carDealership){const lot=G.world.carDealership.lot,cx=lot.x+lot.w/2,cy=lot.y+lot.h/2,dx=0,dy=-lot.h/2-20,c=Math.cos(b.rotation),s=Math.sin(b.rotation),co=Math.abs(c),si=Math.abs(s),bw=(lot.w*co+lot.h*si)*b.scale,bh=(lot.w*si+lot.h*co)*b.scale;b.interactionPoint={x:cx+(dx*c+dy*s)*b.scale,y:cy+(-dx*s+dy*c)*b.scale};b.assetBounds={x:cx-bw/2,y:cy-bh/2,w:bw,h:bh}}else if(previous.interactionPoint)b.interactionPoint={...previous.interactionPoint,x:previous.interactionPoint.x+dx,y:previous.interactionPoint.y+dy};else b.interactionPoint={x:x+w/2,y:y+h+12};G.world.threeWorld?.refreshLocation?.(b,previous);return b};
G.world.carDealership={id:'abujacar_car_stand',lot:{x:8070,y:3890,w:420,h:340,gateWidth:58},showroom:{x:8149,y:3930,w:262,d:158},workshop:{x:8420,y:3970,w:58,d:80},cars:[
 {id:'abujacar-showroom-suv-01',name:'Showroom Executive SUV',x:8218,y:3968,color:'#161c22',kind:'suv',interior:true},
 {id:'abujacar-showroom-sedan-01',name:'Showroom Luxury Sedan',x:8280,y:3968,color:'#e5e1d5',kind:'sedan',interior:true},
 {id:'abujacar-showroom-sport-01',name:'Showroom Grand Coupe',x:8342,y:3968,color:'#a52e2c',kind:'sport',interior:true},
 {id:'abujacar-showroom-suv-02',name:'Showroom Premium 4x4',x:8218,y:4000,color:'#384950',kind:'suv',interior:true},
 {id:'abujacar-showroom-sedan-02',name:'Showroom Executive Saloon',x:8280,y:4000,color:'#746954',kind:'sedan',interior:true},
 {id:'abujacar-showroom-suv-03',name:'Showroom Black SUV',x:8342,y:4000,color:'#101519',kind:'suv',interior:true},
 {id:'abujacar-forecourt-01',name:'Forecourt Black SUV',x:8180,y:4090,color:'#12171d',kind:'suv'},
 {id:'abujacar-forecourt-02',name:'Forecourt White SUV',x:8220,y:4090,color:'#e3e1d9',kind:'suv'},
 {id:'abujacar-forecourt-03',name:'Forecourt Graphite SUV',x:8260,y:4090,color:'#394650',kind:'suv'},
 {id:'abujacar-forecourt-04',name:'Forecourt Executive Sedan',x:8300,y:4090,color:'#d4d7d4',kind:'sedan'},
 {id:'abujacar-forecourt-05',name:'Forecourt Sport Coupe',x:8340,y:4090,color:'#a93430',kind:'sport'},
 {id:'abujacar-forecourt-06',name:'Forecourt Midnight SUV',x:8380,y:4090,color:'#17202a',kind:'suv'},
 {id:'abujacar-canopy-01',name:'Canopy Black SUV',x:8138,y:4085,color:'#131920',kind:'suv'},
 {id:'abujacar-canopy-02',name:'Canopy Silver SUV',x:8162,y:4085,color:'#c8ccca',kind:'suv'},
 {id:'abujacar-canopy-03',name:'Canopy Blue SUV',x:8138,y:4120,color:'#304758',kind:'suv'},
 {id:'abujacar-canopy-04',name:'Canopy White Sedan',x:8162,y:4120,color:'#e8e4dc',kind:'sedan'},
 {id:'abujacar-canopy-05',name:'Canopy Grey SUV',x:8398,y:4085,color:'#596165',kind:'suv'},
 {id:'abujacar-canopy-06',name:'Canopy Red Coupe',x:8422,y:4085,color:'#ac372f',kind:'sport'},
 {id:'abujacar-canopy-07',name:'Canopy Black SUV II',x:8398,y:4120,color:'#171b20',kind:'suv'},
 {id:'abujacar-canopy-08',name:'Canopy Champagne Sedan',x:8422,y:4120,color:'#b9ad97',kind:'sedan'},
 {id:'abujacar-customer-01',name:'Customer SUV',x:8138,y:4172,color:'#25313a',kind:'suv'},
 {id:'abujacar-customer-02',name:'Customer Sedan',x:8162,y:4172,color:'#d8d6cf',kind:'sedan'},
 {id:'abujacar-customer-03',name:'Customer SUV II',x:8398,y:4172,color:'#313d45',kind:'suv'},
 {id:'abujacar-customer-04',name:'Customer Executive Sedan',x:8422,y:4172,color:'#e8e4dc',kind:'sedan'}
]};
G.world.getLocation('abujacar_car_stand').assetBounds={...G.world.carDealership.lot};
G.world.lakes=[{id:'jabi-lake',name:'Jabi Lake',x:6380,y:960,w:660,h:540,shore:34,waterfront:true}];
G.world.waterfrontZones=[{id:'jabi-waterfront',lakeId:'jabi-lake',name:'Jabi Waterfront',promenade:true,pavilions:3,trees:24}];
G.world.isWaterAt=function(x,y){return (G.world.lakes||[]).some(l=>x>=l.x&&x<=l.x+l.w&&y>=l.y&&y<=l.y+l.h)};
G.world.locationTemplates={residential:['house','apartment','villa','estate-gate'],commercial:['shop','restaurant','market','office','hotel','car-dealership','shopping-mall'],public:['police-post','hospital','school','government','mosque','church'],infrastructure:['fuel-station','bus-terminal','railway-station','airport','workshop']};
G.world.assetManifest={
 'abujacar-showroom':{renderer:'procedural',builder:'dealership',detail:'high',interior:true,source:'js/three-world.js'},
 'manga-car-stand':{renderer:'procedural',builder:'car-stand',detail:'high'},
 'abana-car-stand':{renderer:'procedural',builder:'car-stand',detail:'high'},
 'sarkin-mota-car-stand':{renderer:'procedural',builder:'car-stand',detail:'high'},
 'devolt-mould-flagship':{renderer:'procedural',builder:'fashion-flagship',detail:'high',interior:true},
 'restaurant':{renderer:'procedural',builder:'restaurant-property',detail:'high'},
 'nightlife':{renderer:'procedural',builder:'restaurant-property',detail:'high'},
 'car-dealership':{renderer:'procedural',builder:'car-stand',detail:'high',interior:true},
 'central-bank':{renderer:'procedural',builder:'civic-bank',detail:'high'},
 'national-mosque':{renderer:'procedural',builder:'mosque',detail:'high'},
 'national-church':{renderer:'procedural',builder:'national-church',detail:'high'},
 'shopping-mall':{renderer:'procedural',builder:'retail-complex',detail:'high'},
 'railway-station':{renderer:'procedural',builder:'transport-terminal',detail:'high'},
 'airport':{renderer:'procedural',builder:'airport-terminal',detail:'high'},
 'aso-rock':{renderer:'procedural',builder:'landmark-rock-formation',detail:'high',collision:'footprint'},
 'construction-site':{renderer:'procedural',builder:'construction-site',detail:'high'},
 'estate-gate':{renderer:'procedural',builder:'estate-gate',detail:'high'},
 'park':{renderer:'procedural',builder:'park',detail:'high'}
};
G.world.roadX=Array.from({length:Math.floor((G.W-250)/600)+1},(_,i)=>250+i*600);
G.world.roadY=Array.from({length:Math.floor((G.H-260)/600)+1},(_,i)=>260+i*600);
G.world.roadSegments=[];
G.world.roadX.forEach((x,i)=>{for(let y=0,n=0;y<G.H;y+=G.world.mapMeta.chunkSize,n++)G.world.roadSegments.push({id:'x'+i+'-'+n,axis:'x',x1:x,y1:y,x2:x,y2:Math.min(G.H,y+G.world.mapMeta.chunkSize),class:i%5===0?'arterial':i%2===0?'avenue':'street',width:i%5===0?30:i%2===0?20:13,lanes:i%5===0?4:2})});
G.world.roadY.forEach((y,i)=>{for(let x=0,n=0;x<G.W;x+=G.world.mapMeta.chunkSize,n++)G.world.roadSegments.push({id:'y'+i+'-'+n,axis:'y',x1:x,y1:y,x2:Math.min(G.W,x+G.world.mapMeta.chunkSize),y2:y,class:i%4===0?'arterial':i%2===0?'avenue':'street',width:i%4===0?30:i%2===0?20:13,lanes:i%4===0?4:2})});
G.world.roadPaths=[
 {id:'capital-boulevard',name:'Capital Boulevard',class:'arterial',width:32,points:[[2350,2050],[3400,2300],[4800,2460],[6200,2480],[7650,2700],[9300,3100]]},
 {id:'airport-expressway',name:'Airport Expressway',class:'expressway',width:38,points:[[1200,5860],[2900,5700],[4600,5860],[6200,6040],[7900,6200],[9420,6370]]},
 {id:'north-ring-road',name:'Northern Ring Road',class:'arterial',width:32,points:[[2350,900],[3600,900],[4900,760],[6200,820],[7650,900],[9300,980],[10800,900],[12600,760],[14050,900]]},
 {id:'central-civic-link',name:'Central Civic Link',class:'arterial',width:34,points:[[1450,2050],[2050,2350],[2650,2660],[3850,2660],[5050,2660],[6250,2660],[7450,2660],[8650,2660],[9850,2660],[11050,2660],[12250,2660],[14050,2660]]},
 {id:'southern-ring-boulevard',name:'Southern Ring Boulevard',class:'arterial',width:36,points:[[650,6850],[2050,7250],[3850,7460],[5650,7460],[7450,7460],[9250,7460],[11050,7460],[12850,7460],[14050,6850]]},
 {id:'jabi-lake-approach',name:'Jabi Lake Approach',class:'avenue',width:24,points:[[5050,1460],[5650,1460],[6250,1460],[6850,1460],[7450,1460],[8050,1460]]},
 {id:'airport-city-connector',name:'Airport City Connector',class:'arterial',width:30,points:[[7450,5060],[8050,5060],[8650,5060],[9250,5060],[9850,5060],[10450,5060],[11050,5060],[11650,5060],[12250,5060],[12850,5060],[13450,5060],[14050,5060]]},
 {id:'idu-logistics-link',name:'Idu Logistics Link',class:'arterial',width:30,points:[[7450,3860],[8050,3860],[8650,3860],[9250,3860],[9850,3860],[10450,3860],[11050,3860],[11650,3860],[12250,3860],[12850,3860],[13450,3860],[14050,3860]]}
];
G.world.roundabouts=[
 {id:'cbd-civic-circle',x:3850,y:2660,radius:48,monument:true},{id:'central-business-circle',x:6250,y:2660,radius:52,monument:true},
 {id:'idu-north-circle',x:9850,y:2660,radius:44},{id:'idu-south-circle',x:12250,y:3860,radius:44},
 {id:'jabi-approach-circle',x:6250,y:1460,radius:46},{id:'airport-city-circle',x:10450,y:5060,radius:48},
 {id:'apo-south-circle',x:3850,y:7460,radius:46},{id:'lokogoma-circle',x:7450,y:7460,radius:44},
 {id:'airport-south-circle',x:10450,y:7460,radius:48},{id:'bwari-south-circle',x:12850,y:7460,radius:44}
];
G.world.residentialEstates=[
 {id:'gwarinpa-estate',locationId:'estate-gwarinpa-gate',name:'Gwarinpa Estate',x:7300,y:1500,w:560,h:430,columns:10,rows:5,homeW:24,homeD:18,spacingX:42,spacingY:66,style:'planned-suburban',homeCount:50,gate:{x:7580,y:1510},reserve:{x:7900,y:1450,w:900,h:620}},
 {id:'maitama-gardens',locationId:'estate-maitama-gate',name:'Maitama Gardens',x:2630,y:1540,w:520,h:520,columns:10,rows:10,homeW:23,homeD:19,spacingX:42,spacingY:44,style:'garden-estate',homeCount:100,gate:{x:3000,y:1800},reserve:{x:3180,y:1540,w:520,h:500}},
 {id:'apo-garden-estate',locationId:'estate-apo-gate',name:'Apo Garden Estate',x:1480,y:7600,w:600,h:460,columns:10,rows:6,homeW:25,homeD:20,spacingX:47,spacingY:57,style:'garden-estate',homeCount:60,gate:{x:1770,y:7790}},
 {id:'kubwa-green-estate',locationId:'estate-kubwa-gate',name:'Kubwa Green Estate',x:12380,y:1760,w:600,h:430,columns:10,rows:5,homeW:25,homeD:20,spacingX:48,spacingY:64,style:'planned-suburban',homeCount:50,gate:{x:12680,y:2150}},
 {id:'lugbe-gardens',locationId:'estate-lugbe-gate',name:'Lugbe Gardens',x:8500,y:7580,w:560,h:440,columns:10,rows:6,homeW:25,homeD:20,spacingX:45,spacingY:57,style:'planned-suburban',homeCount:60,gate:{x:8780,y:7800}}
];
G.world.houseLots=[];
for(const estate of G.world.residentialEstates)for(let row=0;row<estate.rows;row++)for(let col=0;col<estate.columns;col++)G.world.houseLots.push({id:estate.id+'-home-'+String(row*estate.columns+col+1).padStart(3,'0'),estateId:estate.id,x:estate.x+24+col*estate.spacingX,y:estate.y+38+row*estate.spacingY,w:estate.homeW,h:estate.homeD,rotation:0,style:estate.style,collision:true});
G.world.futurePlots=[
 {id:'reserve-idu-commercial',district:'idu-rail',x:8430,y:2460,w:1050,h:750,allowed:['mall','office','workshop','transport'],reserved:true},
 {id:'reserve-airport-logistics',district:'airport-lugbe',x:7320,y:5350,w:820,h:560,allowed:['hotel','fuel','logistics','parking'],reserved:true},
 {id:'reserve-jabi-shore',district:'jabi-utako',x:6800,y:1250,w:440,h:760,allowed:['park','entertainment','residential'],reserved:true},
 {id:'reserve-central-mixed-use',district:'central-business-district',x:3900,y:2700,w:620,h:560,allowed:['office','government','hotel'],reserved:true},
 {id:'reserve-kubwa-retail',district:'bwari',x:13200,y:400,w:900,h:460,allowed:['market','mall','parking'],reserved:true},
 {id:'reserve-airport-city-logistics',district:'airport-city',x:11100,y:5480,w:1100,h:700,allowed:['warehouse','logistics','hotel','parking'],reserved:true},
 {id:'reserve-south-estate',district:'lugbe-south',x:9180,y:8160,w:420,h:880,allowed:['residential','park'],reserved:true},
 {id:'reserve-guzape-green',district:'guzape',x:4400,y:5400,w:500,h:700,allowed:['park','villa','residential'],reserved:true}
];
// Purpose-built precincts reserve the focal city blocks for architecture with recognizable Abuja-scale massing.
G.world.metropolitanPrecincts=[
 {id:'cbd-financial-quarter',kind:'cbd',name:'CBD Financial Quarter',x:2480,y:2760,w:830,h:760,district:'central-business-district',towers:[{x:.22,z:.25,w:150,d:112,h:62},{x:.68,z:.24,w:132,d:106,h:48},{x:.33,z:.72,w:124,d:102,h:39},{x:.73,z:.69,w:158,d:116,h:54}]},
 {id:'cbd-civic-quarter',kind:'cbd',name:'CBD Civic Quarter',x:4140,y:2820,w:760,h:700,district:'central-business-district',towers:[{x:.23,z:.28,w:136,d:112,h:44},{x:.65,z:.27,w:158,d:118,h:67},{x:.31,z:.71,w:148,d:96,h:35},{x:.72,z:.69,w:122,d:102,h:48}]},
 {id:'wuse-market-corridor',kind:'commercial',name:'Wuse Commercial Corridor',x:360,y:1660,w:930,h:360,district:'wuse-central',shops:7},
 {id:'jabi-retail-corridor',kind:'commercial',name:'Jabi Retail Corridor',x:4760,y:600,w:520,h:600,district:'jabi-utako',shops:5},
 {id:'garki-business-corridor',kind:'commercial',name:'Garki Business Corridor',x:520,y:2860,w:880,h:390,district:'garki-area-11',shops:7}
];// Fill the real street blocks with a deterministic mix of occupied city parcels.
// These are non-interactable background properties; named destinations remain the gameplay locations.
const cityRandom=seed=>{let n=(seed|0)+0x6d2b79f5;return()=>{n=Math.imul(n^(n>>>15),n|1);n^=n+Math.imul(n^(n>>>7),n|61);return((n^(n>>>14))>>>0)/4294967296}};
const overlaps=(a,b,pad=0)=>a.x<b.x+b.w+pad&&a.x+a.w+pad>b.x&&a.y<b.y+b.h+pad&&a.y+a.h+pad>b.y;
const segmentDistance=(x,y,a,b)=>{const dx=b[0]-a[0],dy=b[1]-a[1],den=dx*dx+dy*dy,t=den?Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/den)):0;return Math.hypot(x-(a[0]+dx*t),y-(a[1]+dy*t))};
G.world.cityLots=[];G.world.cityLotsByChunk=Object.create(null);
for(let xi=0;xi<G.world.roadX.length-1;xi++)for(let yi=0;yi<G.world.roadY.length-1;yi++){
 const x0=G.world.roadX[xi]+(xi%5===0?15:xi%2===0?10:6.5)+15,x1=G.world.roadX[xi+1]-((xi+1)%5===0?15:(xi+1)%2===0?10:6.5)-15;
 const y0=G.world.roadY[yi]+(yi%4===0?15:yi%2===0?10:6.5)+15,y1=G.world.roadY[yi+1]-((yi+1)%4===0?15:(yi+1)%2===0?10:6.5)-15;
 const districtInfo=G.world.districts.find(d=>{const r=d.bounds;return (x0+x1)/2>=r.x&&(x0+x1)/2<r.x+r.w&&(y0+y1)/2>=r.y&&(y0+y1)/2<r.y+r.h}),district=districtInfo?.id||'wuse-central',style=districtInfo?.style||'mixed-urban',bx=x0,ex=x1,by=y0,ey=y1,rand=cityRandom(xi*73856093^yi*19349663),urban=['modern-civic','mixed-urban','commercial-residential','mixed-modern','industrial-rail','suburban-centre'].includes(style),residential=style.includes('residential')||style.includes('estate'),airport=style==='airport-corridor',chance=urban ? .92 : residential ? .68 : airport ? .48 : .64;
 const parcels=4,spanX=(ex-bx)/parcels,spanY=(ey-by)/parcels;
 for(let row=0;row<parcels;row++)for(let col=0;col<parcels;col++){
  if(rand()>chance)continue;const w=(airport?68:urban?72:residential?56:64)+rand()*(airport?54:urban?52:residential?39:48),h=(airport?56:urban?60:residential?46:52)+rand()*(airport?38:urban?43:residential?34:40),cx=bx+(col+.5)*spanX+(rand()-.5)*12,cy=by+(row+.5)*spanY+(rand()-.5)*12,lot={x:cx-w/2,y:cy-h/2,w,h};
  if(lot.x<bx||lot.y<by||lot.x+lot.w>ex||lot.y+lot.h>ey)continue;
   const occupied=overlaps(lot,{x:890,y:640,w:240,h:208})||G.world.buildings.some(b=>overlaps(lot,b.assetBounds||b,24))||G.world.houseLots.some(home=>overlaps(lot,home,12))||G.world.futurePlots.some(p=>p.reserved&&overlaps(lot,p,16))||G.world.lakes.some(l=>overlaps(lot,l,20))||G.world.metropolitanPrecincts.some(p=>overlaps(lot,p,30))||G.world.roadPaths.some(path=>path.points.slice(1).some((q,i)=>segmentDistance(cx,cy,path.points[i],q)<path.width/2+Math.hypot(w,h)*.53));
  if(occupied||G.world.cityLots.some(other=>overlaps(lot,other,18)))continue;
  const central=style==='modern-civic',floors=central?9+Math.floor(rand()*14):urban?2+Math.floor(rand()*7):residential?1+Math.floor(rand()*3):airport?1+Math.floor(rand()*3):1+Math.floor(rand()*4),types=central?['office','apartment','hotel','office']:urban?['shop','office','apartment','hotel','retail']:residential?['villa','apartment','house','villa']:airport?['warehouse','hotel','office']:['shop','office','warehouse','apartment'];
  G.world.cityLots.push({id:`city-${xi}-${yi}-${row}-${col}`,...lot,floors,district,style,type:types[Math.floor(rand()*types.length)],seed:Math.floor(rand()*2147483647),roof:Math.floor(rand()*4)});
 }
}
const chunkSize=G.world.mapMeta.chunkSize;
for(const lot of G.world.cityLots){const key=Math.floor((lot.x+lot.w/2)/chunkSize)+':'+Math.floor((lot.y+lot.h/2)/chunkSize);(G.world.cityLotsByChunk[key]||(G.world.cityLotsByChunk[key]=[])).push(lot)}
G.world.heightAt=function(x,y){
 const ridge=Math.exp(-Math.pow((x-8900)/850,2)-Math.pow((y-1500)/1250,2));
 const southHill=Math.exp(-Math.pow((x-4800)/1450,2)-Math.pow((y-6800)/620,2));
 const mpapeRise=Math.exp(-Math.pow((x-12800)/920,2)-Math.pow((y-8000)/1200,2));
 const asoRockRise=Math.exp(-Math.pow((x-5400)/500,2)-Math.pow((y-3070)/470,2));
 return Math.max(0,ridge*18+southHill*14+mpapeRise*32+asoRockRise*68+Math.sin(x/720)*.7+Math.cos(y/900)*.6);
};
const names=['Tunde','Zainab','Bisi','Musa','Kelechi','Amina','Chidi','Ngozi','Femi','Ife','Sadiq','Tomi','Hauwa','Daniel','Funmi','Yusuf','Ada','Emeka','Maryam','Chika','Aisha','Bola','Ibrahim','Nneka'];
const looks=['🧑🏾','👩🏽','👨🏿','👩🏾','🧔🏾','👨🏽','👩🏿'];
G.world.npcs=Array.from({length:144},(_,i)=>{
 const name=names[i%names.length]+(i>=names.length?' '+(Math.floor(i/names.length)+1):'');
 const x=180+((i*937+360)%(G.W-360)),y=180+((i*577+520)%(G.H-360));
 return{id:'n'+i,name,emoji:looks[i%looks.length],x,y,tx:x,ty:y,speed:1.05+(i%5)*.16,mood:i%3,friend:0,job:['Vendor','Student','Courier','Designer','Driver','Nurse'][i%6],react:0,walkTimer:(i%9)*.41,scheduleHour:-1,workId:G.world.buildings[i%G.world.buildings.length].id,homeX:x,homeY:y};
});
G.world.cars=[{x:965,y:785,color:'#c44538',name:'Starter Sedan',owned:true,kind:'sedan'},{x:820,y:784,color:'#367ca0',name:'Green Cab',owned:false,taxi:true,kind:'sedan'},{x:1455,y:783,color:'#e3b23c',name:'Mini Bus',owned:false,bus:true,kind:'minibus'},{x:1100,y:780,color:'#403a62',name:'Idu Sedan',owned:false,kind:'sedan'}];
 for(let i=0;i<72;i++){const r=G.world.roadY[(i*5)%G.world.roadY.length];G.world.cars.push({id:'city-traffic-'+i,x:210+(i*251)%(G.W-420),y:r+(i%2?8:-8),color:['#d75a4a','#e0dfd4','#273342','#477f8f','#c99c34'][i%5],name:'City Traffic '+i,kind:i%4===0?'suv':'sedan',traffic:true,speed:4.5+(i%4)*1.2,direction:i%2?1:-1})}
G.world.rain=Array.from({length:100},()=>({x:Math.random(),y:Math.random(),len:8+Math.random()*14,speed:280+Math.random()*240}));
G.world.draw=function(ctx,camera,scale){
 const s=G.state,viewW=G.view.w/scale,viewH=G.view.h/scale;
 ctx.save();ctx.translate(-camera.x,-camera.y);ctx.scale(scale,scale);
 ctx.fillStyle='#a5bd8f';ctx.fillRect(camera.x,camera.y,viewW,viewH);
 const visible=(x,y,pad)=>x>camera.x-pad&&x<camera.x+viewW+pad&&y>camera.y-pad&&y<camera.y+viewH+pad;
 for(let i=0;i<G.world.roadX.length;i++){const x=G.world.roadX[i],width=i%5===0?30:i%2===0?20:13;if(x>camera.x-50&&x<camera.x+viewW+50){
   ctx.fillStyle='#c6b58f';ctx.fillRect(x-width/2-3,camera.y,width+6,viewH);ctx.fillStyle='#626d70';ctx.fillRect(x-width/2,camera.y,width,viewH);
   ctx.strokeStyle='#e8d894';ctx.lineWidth=1;ctx.setLineDash([12,13]);ctx.beginPath();ctx.moveTo(x,camera.y);ctx.lineTo(x,camera.y+viewH);ctx.stroke();ctx.setLineDash([]);
 }}
 for(let i=0;i<G.world.roadY.length;i++){const y=G.world.roadY[i],width=i%4===0?30:i%2===0?20:13;if(y>camera.y-50&&y<camera.y+viewH+50){
   ctx.fillStyle='#c6b58f';ctx.fillRect(camera.x,y-width/2-3,viewW,width+6);ctx.fillStyle='#626d70';ctx.fillRect(camera.x,y-width/2,viewW,width);
   ctx.strokeStyle='#e8d894';ctx.lineWidth=1;ctx.setLineDash([12,13]);ctx.beginPath();ctx.moveTo(camera.x,y);ctx.lineTo(camera.x+viewW,y);ctx.stroke();ctx.setLineDash([]);
 }}
 for(let y=Math.max(0,Math.floor(camera.y/320)*320);y<Math.min(G.H,camera.y+viewH);y+=320)for(let x=Math.max(0,Math.floor(camera.x/320)*320);x<Math.min(G.W,camera.x+viewW);x+=320){
   const seed=(x*17+y*23)%11;if(seed<3){ctx.fillStyle=seed===0?'#96b583':'#9fbb8b';ctx.fillRect(x+25,y+30,210,210)}
 }
 for(const b of G.world.buildings)if(visible(b.x,b.y,180)){
   ctx.fillStyle='#71857055';ctx.fillRect(b.x-5,b.y-5,b.w+10,b.h+10);ctx.fillStyle='#e3d9c6';ctx.fillRect(b.x,b.y,b.w,b.h);ctx.fillStyle=b.color;ctx.fillRect(b.x+2,b.y+2,b.w-4,b.h-4);
   ctx.fillStyle='#273241';ctx.fillRect(b.x+b.w*.45,b.y+b.h-2,Math.max(2,b.w*.1),2);ctx.fillStyle='#cce3e1';for(let wx=b.x+7;wx<b.x+b.w-4;wx+=14)ctx.fillRect(wx,b.y+8,7,7);
   ctx.fillStyle='#fff';ctx.beginPath();ctx.roundRect(b.x+b.w/2-24,b.y-23,48,18,8);ctx.fill();ctx.fillStyle='#233043';ctx.font='bold 9px system-ui';ctx.textAlign='center';ctx.fillText(b.icon+' '+b.name,b.x+b.w/2,b.y-10);ctx.textAlign='left';
 }
 for(const lot of G.world.houseLots)if(visible(lot.x,lot.y,30)){ctx.fillStyle=lot.style==='garden-estate'?'#b79d77':'#c3af8f';ctx.fillRect(lot.x,lot.y,lot.w,lot.h);ctx.fillStyle='#a4a294';ctx.fillRect(lot.x+2,lot.y+2,lot.w-4,lot.h-4)}
 for(let i=0;i<90;i++){const x=90+(i*397)%G.W,y=80+(i*263)%G.H;if(!visible(x,y,80)||G.world.roadX.some(r=>Math.abs(r-x)<28)||G.world.roadY.some(r=>Math.abs(r-y)<28))continue;ctx.fillStyle='#72533b';ctx.fillRect(x-1,y-5,3,8);ctx.fillStyle=i%4===0?'#2b7952':'#438b60';ctx.beginPath();ctx.arc(x,y-8,5,0,7);ctx.fill()}
 for(const c of G.world.cars)if(visible(c.x,c.y,30)&&!(s.vehicle&&s.vehicle.name===c.name))drawCar(ctx,c.x,c.y,c.color,false);
 for(const n of G.world.npcs)if(visible(n.x,n.y,50)){ctx.fillStyle='#0003';ctx.beginPath();ctx.ellipse(n.x,n.y+3,2.2,1.2,0,0,7);ctx.fill();ctx.font='12px sans-serif';ctx.textAlign='center';ctx.fillText(n.emoji,n.x,n.y+3);ctx.textAlign='left'}
 if(s.vehicle)drawCar(ctx,s.x,s.y,s.vehicle.color,true);else drawPlayer(ctx,s.x,s.y,s.gender,s.skin,s.angle,s.hair,s.outfit);
 ctx.restore();
};
function drawPlayer(ctx,x,y,gender,skin,a,hair,outfit){ctx.save();ctx.translate(x,y);ctx.rotate(a||0);ctx.fillStyle=skin==='light'?'#ba7955':skin==='medium'?'#865139':'#5a332a';ctx.beginPath();ctx.arc(0,0,0.85,0,Math.PI*2);ctx.fill();ctx.fillStyle=outfit==='coral'?'#e2765e':outfit==='blue'?'#246d9c':'#168b68';ctx.fillRect(-.38,.7,.76,.9);ctx.restore()}
function drawCar(ctx,x,y,color,player){ctx.save();ctx.translate(x,y);ctx.fillStyle=color||'#bb4b3e';ctx.fillRect(-2.2,-1,4.4,2.1);ctx.fillStyle='#9ccbd2';ctx.fillRect(-1.1,-.85,2,.8);ctx.fillStyle='#252a30';for(const xx of [-1.65,1.1])for(const yy of [-1,0.7])ctx.fillRect(xx,yy,.55,.35);if(player){ctx.strokeStyle='#fff';ctx.lineWidth=.16;ctx.strokeRect(-2.3,-1.1,4.6,2.2)}ctx.restore()}
G.world.nearBuilding=function(x,y){
 let best=null,bestDistance=Infinity;
 for(const b of G.world.buildings){const p=b.interactionPoint||{x:b.x+b.w/2,y:b.y+b.h/2},distance=Math.hypot(x-p.x,y-p.y);if(distance<Math.max(18,Math.min(38,Math.max(b.w,b.h)*.42))&&distance<bestDistance){best=b;bestDistance=distance}}
 return best;
};
G.world.chunkKey=function(x,y){const size=G.world.mapMeta.chunkSize;return Math.floor(x/size)+':'+Math.floor(y/size)};
})();

