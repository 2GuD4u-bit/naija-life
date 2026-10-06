'use strict';

// Server-owned accounts, payment transactions, and wallet ledger.
// Requires Node.js 24+ (node:sqlite) and HTTPS in production.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');

// Minimal .env reader so secrets can stay out of source control and the browser.
const envFile=path.join(__dirname,'.env');
if(fs.existsSync(envFile))for(const line of fs.readFileSync(envFile,'utf8').split(/\r?\n/)){const m=line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);if(m&&process.env[m[1]]===undefined)process.env[m[1]]=m[2].replace(/^(['"])(.*)\1$/,'$2')}

const ROOT = path.resolve(__dirname, '..');
const PORT = Number(process.env.PORT || 8787);
const SESSION_MS = 1000 * 60 * 60 * 24 * 14;
const STATES = ['Pending','Awaiting payment','Detecting payment','Confirming','Completed','Failed','Expired','Refunded'];
const ALLOWED_CRYPTO = (process.env.CRYPTO_CURRENCIES || 'BTC,ETH,USDT,USDC,TRX').split(',').map(x=>x.trim().toUpperCase()).filter(Boolean);
const ALLOWED_NETWORKS = Object.fromEntries((process.env.CRYPTO_NETWORKS || 'USDT:TRC20,USDT:Polygon,USDT:ERC20,USDC:Polygon,USDC:ERC20').split(',').map(x=>x.trim().split(':')).filter(x=>x.length===2).map(([c,n])=>[c.toUpperCase(),n]));
const packages = (()=>{try{const p=JSON.parse(process.env.PAYMENT_PACKAGES_JSON||'{}');return p&&typeof p==='object'?p:{}}catch{return {}}})();
const dbPath = path.resolve(process.env.DB_PATH || path.join(__dirname,'data','naija-life.sqlite'));
fs.mkdirSync(path.dirname(dbPath),{recursive:true});
const db = new DatabaseSync(dbPath,{timeout:5000});
db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE COLLATE NOCASE, display_name TEXT NOT NULL, password_salt TEXT NOT NULL, password_hash TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS password_resets(token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,expires_at INTEGER NOT NULL,used_at TEXT,created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS profiles(user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,username TEXT NOT NULL UNIQUE COLLATE NOCASE,avatar_json TEXT NOT NULL DEFAULT '{}',stats_json TEXT NOT NULL DEFAULT '{}',inventory_json TEXT NOT NULL DEFAULT '[]',settings_json TEXT NOT NULL DEFAULT '{}',account_status TEXT NOT NULL DEFAULT 'active',adult_consent_at TEXT,terms_version TEXT,privacy_version TEXT,created_at TEXT NOT NULL,updated_at TEXT NOT NULL,last_login TEXT);
CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires_at INTEGER NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS wallets(user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, balance INTEGER NOT NULL DEFAULT 0 CHECK(balance>=0), updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS payments(id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), package_id TEXT NOT NULL, amount_minor INTEGER NOT NULL CHECK(amount_minor>0), amount_paid REAL, fiat_currency TEXT NOT NULL, credit_units INTEGER NOT NULL CHECK(credit_units>0), method TEXT NOT NULL CHECK(method IN ('bank_transfer','crypto')), status TEXT NOT NULL CHECK(status IN ('Pending','Awaiting payment','Detecting payment','Confirming','Completed','Failed','Expired','Refunded')), provider TEXT NOT NULL, provider_reference TEXT UNIQUE, provider_order_id TEXT NOT NULL UNIQUE, idempotency_key TEXT NOT NULL, request_fingerprint TEXT NOT NULL, instructions_json TEXT, verification_json TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, expires_at TEXT, credited_at TEXT, UNIQUE(user_id,idempotency_key));
CREATE TABLE IF NOT EXISTS wallet_ledger(id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), payment_id TEXT UNIQUE REFERENCES payments(id), delta INTEGER NOT NULL CHECK(delta<>0), balance_after INTEGER NOT NULL CHECK(balance_after>=0), reason TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS economy_ops(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),idempotency_key TEXT NOT NULL,operation TEXT NOT NULL,request_fingerprint TEXT NOT NULL,delta INTEGER NOT NULL,cash_after INTEGER NOT NULL,bank_after INTEGER NOT NULL,created_at TEXT NOT NULL,UNIQUE(user_id,idempotency_key));
CREATE TABLE IF NOT EXISTS economy_limits(user_id TEXT PRIMARY KEY REFERENCES users(id),last_work_at INTEGER NOT NULL DEFAULT 0,last_crime_at INTEGER NOT NULL DEFAULT 0,next_mission INTEGER NOT NULL DEFAULT 0,last_settle_date TEXT,last_rent_week TEXT,rent INTEGER NOT NULL DEFAULT 3500,investments INTEGER NOT NULL DEFAULT 0,business INTEGER NOT NULL DEFAULT 0,job TEXT NOT NULL DEFAULT 'Courier',job_level INTEGER NOT NULL DEFAULT 0,shifts INTEGER NOT NULL DEFAULT 0);
CREATE INDEX IF NOT EXISTS payments_user_created ON payments(user_id,created_at DESC);
CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires_at);`);
const walletCols=new Set(db.prepare('PRAGMA table_info(wallets)').all().map(c=>c.name));
const profileCols=new Set(db.prepare('PRAGMA table_info(profiles)').all().map(c=>c.name));
for(const [c,def] of [['adult_consent_at','TEXT'],['terms_version','TEXT'],['privacy_version','TEXT']])if(!profileCols.has(c))db.exec(`ALTER TABLE profiles ADD COLUMN ${c} ${def}`);
for(const u of db.prepare('SELECT id,email,display_name,created_at FROM users').all()){
  if(db.prepare('SELECT 1 FROM profiles WHERE user_id=?').get(u.id))continue;
  let username=(u.email.split('@')[0].toLowerCase().replace(/[^a-z0-9_]/g,'_').replace(/^_+|_+$/g,'').slice(0,16)||'player');
  if(db.prepare('SELECT 1 FROM profiles WHERE username=? COLLATE NOCASE').get(username))username='player_'+u.id.replace(/-/g,'').slice(0,12);
  const stamp=u.created_at||nowISO();db.prepare("INSERT INTO profiles(user_id,username,created_at,updated_at,last_login) VALUES(?,?,?, ?,?)").run(u.id,username,stamp,stamp,stamp);
}
if(!walletCols.has('cash_balance'))db.exec('ALTER TABLE wallets ADD COLUMN cash_balance INTEGER NOT NULL DEFAULT 0 CHECK(cash_balance>=0)');
if(!walletCols.has('bank_balance'))db.exec('ALTER TABLE wallets ADD COLUMN bank_balance INTEGER NOT NULL DEFAULT 0 CHECK(bank_balance>=0)');
const limitCols=new Set(db.prepare('PRAGMA table_info(economy_limits)').all().map(c=>c.name));
for(const [c,def] of [['last_settle_date','TEXT'],['last_rent_week','TEXT'],['rent','INTEGER NOT NULL DEFAULT 3500'],['investments','INTEGER NOT NULL DEFAULT 0'],['business','INTEGER NOT NULL DEFAULT 0'],['job',"TEXT NOT NULL DEFAULT 'Courier'"],['job_level','INTEGER NOT NULL DEFAULT 0'],['shifts','INTEGER NOT NULL DEFAULT 0']])if(!limitCols.has(c))db.exec(`ALTER TABLE economy_limits ADD COLUMN ${c} ${def}`);
const economyCols=new Set(db.prepare('PRAGMA table_info(economy_ops)').all().map(c=>c.name));if(!economyCols.has('request_fingerprint'))db.exec("ALTER TABLE economy_ops ADD COLUMN request_fingerprint TEXT NOT NULL DEFAULT ''");

const nowISO=()=>new Date().toISOString();
function lagosDateKey(){const p=new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Lagos',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()),g=t=>p.find(x=>x.type===t)?.value||'';return `${g('year')}-${g('month')}-${g('day')}`}
function lagosWeekKey(dateKey=lagosDateKey()){const day=new Date(dateKey+'T00:00:00Z').getUTCDay();return new Date(Date.parse(dateKey+'T00:00:00Z')-day*86400000).toISOString().slice(0,10)}
const randomId=()=>crypto.randomUUID();
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const safeEq=(a,b)=>{if(typeof a!=='string'||typeof b!=='string')return false;const x=Buffer.from(a,'hex'),y=Buffer.from(b,'hex');return x.length===y.length&&x.length>0&&crypto.timingSafeEqual(x,y)};
const json=(res,status,data,headers={})=>{res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store',...headers});res.end(JSON.stringify(data))};
function readBody(req,max=64*1024){return new Promise((resolve,reject)=>{let b=[];let n=0;req.on('data',c=>{n+=c.length;if(n>max){reject(Object.assign(Error('Request too large'),{status:413}));req.destroy();return}b.push(c)});req.on('end',()=>resolve(Buffer.concat(b)));req.on('error',reject)})}
function cookies(req){return Object.fromEntries((req.headers.cookie||'').split(';').map(p=>p.trim().split('=').map(decodeURIComponent)).filter(p=>p.length===2))}
function auth(req){const cookieToken=cookies(req)['nl_session'];const header=String(req.headers.authorization||'');const bearer=/^Bearer\s+([A-Za-z0-9_-]{20,})$/i.exec(header);const raw=cookieToken||(bearer&&bearer[1]);if(!raw)return null;const s=db.prepare('SELECT user_id,expires_at FROM sessions WHERE token_hash=?').get(hash(raw));if(!s||s.expires_at<Date.now())return null;return s.user_id}
function sessionCookie(token,maxAge){const production=process.env.NODE_ENV==='production',secure=production?'; Secure':'',sameSite=production?'None':'Lax';return `nl_session=${encodeURIComponent(token)}; HttpOnly; SameSite=${sameSite}; Path=/; Max-Age=${maxAge}${secure}`}
function cors(req,res){const origin=req.headers.origin,allowed=process.env.FRONTEND_ORIGIN;if(origin&&allowed&&origin===allowed){res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Access-Control-Allow-Credentials','true');res.setHeader('Vary','Origin')}res.setHeader('Access-Control-Allow-Methods','GET,POST,OPTIONS');res.setHeader('Access-Control-Allow-Headers','Authorization, Content-Type, Idempotency-Key')}
function userRequired(req,res){const id=auth(req);if(!id){json(res,401,{error:'Sign in to your Naija Life account first.'});return null}return id}
function packageById(id){const p=packages[id];if(!p||!Number.isSafeInteger(p.amountMinor)||p.amountMinor<=0||!Number.isSafeInteger(p.creditUnits)||p.creditUnits<=0)return null;return {id,amountMinor:p.amountMinor,creditUnits:p.creditUnits,currency:'NGN'}}
function publicPayment(p){return {id:p.id,packageId:p.package_id,amountMinor:p.amount_minor,amountPaid:p.amount_paid,fiatCurrency:p.fiat_currency,creditUnits:p.credit_units,method:p.method,status:p.status,createdAt:p.created_at,expiresAt:p.expires_at,instructions:p.instructions_json?JSON.parse(p.instructions_json):null}}
function loadPayment(id){return db.prepare('SELECT * FROM payments WHERE id=?').get(id)}
function updateState(id,status,providerRef,verify,instructions,expires){if(!STATES.includes(status))throw Error('Invalid payment state');const current=db.prepare('SELECT status FROM payments WHERE id=?').get(id)?.status,rank={'Pending':0,'Awaiting payment':1,'Detecting payment':2,'Confirming':3,'Completed':4,'Failed':5,'Expired':5,'Refunded':6};if(!current||current==='Completed'||current==='Refunded'||rank[status]<rank[current])return;db.prepare(`UPDATE payments SET status=?,provider_reference=COALESCE(?,provider_reference),verification_json=COALESCE(?,verification_json),instructions_json=COALESCE(?,instructions_json),expires_at=COALESCE(?,expires_at),updated_at=? WHERE id=?`).run(status,providerRef||null,verify?JSON.stringify(verify):null,instructions?JSON.stringify(instructions):null,expires||null,nowISO(),id)}
function completePayment(payment,amountPaid,verification){
  db.exec('BEGIN IMMEDIATE');
  try{
    const current=loadPayment(payment.id);if(!current)throw Error('Payment missing');
    if(current.status==='Completed'){db.exec('COMMIT');return false}
    if(current.status==='Refunded'||current.status==='Expired'||current.status==='Failed'){db.exec('COMMIT');return false}
    const wallet=db.prepare('SELECT balance,cash_balance,bank_balance FROM wallets WHERE user_id=?').get(current.user_id);const balance=(wallet?.balance||0)+current.credit_units,cash=(wallet?.cash_balance||0)+current.credit_units;
    if(!Number.isSafeInteger(balance)||balance<0)throw Error('Invalid wallet balance');
    const stamp=nowISO();
    db.prepare('INSERT INTO wallets(user_id,balance,cash_balance,bank_balance,updated_at) VALUES(?,?,?,0,?) ON CONFLICT(user_id) DO UPDATE SET balance=excluded.balance,cash_balance=excluded.cash_balance,updated_at=excluded.updated_at').run(current.user_id,balance,cash,stamp);
    db.prepare('INSERT INTO wallet_ledger(id,user_id,payment_id,delta,balance_after,reason,created_at) VALUES(?,?,?,?,?,?,?)').run(randomId(),current.user_id,current.id,current.credit_units,balance,'Verified game-money purchase',stamp);
    db.prepare(`UPDATE payments SET status='Completed',amount_paid=?,verification_json=?,credited_at=?,updated_at=? WHERE id=?`).run(amountPaid,JSON.stringify(verification),stamp,stamp,current.id);
    db.exec('COMMIT');return true;
  }catch(e){db.exec('ROLLBACK');throw e}
}
const ECONOMY_COSTS={eat:900,date:1500,business:30000,businessupgrade:5000,hire:3000,buybike:18000,buycar:125000,fuel:2500,repair:500,heal:2000,water:100,upgradehome:45000,gym:500,study:700,bus:300,club:1200,delivery:1200,movie:500,invest:5000,bill:600,ad:1000};
const HOME_PRICES={'Face-me-I-face-you|Nyanya':[7200,2400],'Self-contain|Kubwa':[18000,6000],'Mini-flat|Wuse':[51000,17000],'Duplex|Maitama':[750000,250000],'Mansion|Asokoro':[4500000,1500000],'Hall of Residence|UniAbuja, Gwagwalada':[3600,1200]};
const MISSION_REWARDS=[800,1100,2200,1200,2600,1400,3000,1800,2500,6000];
function economyCommand(userId,key,body){
  if(typeof key!=='string'||key.length<16||key.length>100)throw Object.assign(Error('A unique idempotency key is required.'),{status:400});
  const requestFingerprint=hash(JSON.stringify(body));
  db.exec('BEGIN IMMEDIATE');
  try{
    const previous=db.prepare('SELECT cash_after,bank_after,delta,request_fingerprint FROM economy_ops WHERE user_id=? AND idempotency_key=?').get(userId,key);
    if(previous){if(previous.request_fingerprint!==requestFingerprint)throw Object.assign(Error('That idempotency key was already used for another request.'),{status:409});const info=db.prepare('SELECT job,job_level,shifts,rent,investments,business FROM economy_limits WHERE user_id=?').get(userId);db.exec('COMMIT');return {cash:previous.cash_after,bank:previous.bank_after,balance:previous.cash_after+previous.bank_after,job:info?.job||'Courier',jobLevel:info?.job_level||0,shifts:info?.shifts||0,rent:info?.rent||3500,investments:info?.investments||0,business:!!info?.business,replayed:true}}
    const w=db.prepare('SELECT balance,cash_balance,bank_balance FROM wallets WHERE user_id=?').get(userId);if(!w)throw Object.assign(Error('Wallet not found.'),{status:404});
    let cash=w.cash_balance,bank=w.bank_balance,delta=0,op=String(body.operation||''),reason=op,limits=db.prepare('SELECT * FROM economy_limits WHERE user_id=?').get(userId)||{last_work_at:0,last_crime_at:0,next_mission:0},now=Date.now();
    const spend=n=>{if(!Number.isSafeInteger(n)||n<0)throw Object.assign(Error('Invalid game purchase.'),{status:400});if(cash<n)throw Object.assign(Error('Not enough server-verified game money.'),{status:409});cash-=n;delta-=n};
    if(op==='deposit'||op==='withdraw'){
      const amount=Number(body.amount);if(!Number.isSafeInteger(amount)||amount<1||amount>100000000)throw Object.assign(Error('Enter a valid transfer amount.'),{status:400});if(op==='deposit'){if(cash<amount)throw Object.assign(Error('Not enough cash in your wallet.'),{status:409});cash-=amount;bank+=amount}else{if(bank<amount)throw Object.assign(Error('Not enough money in your bank.'),{status:409});bank-=amount;cash+=amount}
      reason=op==='deposit'?'Cash deposited to bank':'Cash withdrawn from bank';
    }else if(op==='transfer'){if(bank<500)throw Object.assign(Error('Not enough money in your bank.'),{status:409});bank-=500;delta=-500;reason='Transfer to neighbor'}
    else if(op==='business'){if(limits.business)throw Object.assign(Error('You already own a business.'),{status:409});spend(ECONOMY_COSTS.business);reason='Game purchase: business'}
    else if(op==='businessupgrade'){if(!limits.business)throw Object.assign(Error('Open a business first.'),{status:409});spend(ECONOMY_COSTS.businessupgrade);reason='Game purchase: businessupgrade'}
    else if(op==='hire'){if(!limits.business)throw Object.assign(Error('Open a business first.'),{status:409});spend(ECONOMY_COSTS.hire);reason='Game purchase: hire'}
    else if(Object.hasOwn(ECONOMY_COSTS,op)){spend(ECONOMY_COSTS[op]);reason='Game purchase: '+op}
    else if(op==='movehome'){const home=String(body.home||'');const option=HOME_PRICES[home];if(!option)throw Object.assign(Error('That home is not available.'),{status:400});spend(option[0]);reason='Move home: '+home;db.prepare('INSERT INTO economy_limits(user_id,rent) VALUES(?,?) ON CONFLICT(user_id) DO UPDATE SET rent=excluded.rent').run(userId,option[1])}
      else if(op==='fine'){const wanted=Math.max(0,Math.min(3,Number(body.wanted)||0)),nominal=Math.max(500,wanted*1200);if(body.reason==='pay'){spend(nominal)}else{const fine=Math.min(cash,nominal);cash-=fine;delta=-fine}reason='Police fine'}
    else if(op==='event'){const choice=String(body.choice||'');const cost=choice==='0'?800:choice==='1'?0:choice==='2'?500:null;if(cost===null)throw Object.assign(Error('That ticket is not available.'),{status:400});spend(cost);reason='City event ticket'}
    else if(op==='outfit'){const outfit=String(body.outfit||''),cost=outfit==='coral'?1800:outfit==='blue'?3200:outfit==='green'?0:null;if(cost===null)throw Object.assign(Error('That outfit is not available.'),{status:400});spend(cost);reason='Outfit: '+outfit}
    else if(op==='applyjob'){
      const job=String(body.job||''),allowed=['Courier','Cafe assistant','Junior web designer','Banker','Musician','Construction worker','Hotel staff'];if(!allowed.includes(job))throw Object.assign(Error('That job is not available.'),{status:400});db.prepare('INSERT INTO economy_limits(user_id,job) VALUES(?,?) ON CONFLICT(user_id) DO UPDATE SET job=excluded.job').run(userId,job);reason='Applied for work: '+job;
    }else if(op==='quitjob'){
      db.prepare("INSERT INTO economy_limits(user_id,job,job_level) VALUES(?,'Courier',0) ON CONFLICT(user_id) DO UPDATE SET job='Courier',job_level=0").run(userId);reason='Changed to courier work';
    }else if(op==='work'){
      if(now-limits.last_work_at<3600000)throw Object.assign(Error('That one-hour shift was already paid. You can work again after one real hour.'),{status:429});const job=limits.job||'Courier',basePay=({construction:2800,'Construction worker':2800,hotel:2200,'Hotel staff':2200,'Junior web designer':9900,Banker:11600,Musician:7400,'Cafe assistant':2000})[job]||2400,level=Number(limits.job_level)||0,pay=Math.round(basePay*(1+Math.min(level,4)*.12));cash+=pay;delta=pay;reason='Completed work shift';const shifts=(Number(limits.shifts)||0)+1,nextLevel=shifts%3===0?level+1:level;db.prepare('INSERT INTO economy_limits(user_id,last_work_at,last_crime_at,next_mission,job,job_level,shifts) VALUES(?,?,?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET last_work_at=excluded.last_work_at,job_level=excluded.job_level,shifts=excluded.shifts').run(userId,now,limits.last_crime_at,limits.next_mission,job,nextLevel,shifts);
    }else if(op==='crime'){
      if(now-limits.last_crime_at<300000)throw Object.assign(Error('Wait before claiming another street-crime reward.'),{status:429});cash+=1500;delta=1500;reason='Street-crime game reward';db.prepare('INSERT INTO economy_limits(user_id,last_work_at,last_crime_at,next_mission) VALUES(?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET last_crime_at=excluded.last_crime_at').run(userId,limits.last_work_at,now,limits.next_mission);
    }else if(op==='mission'){
      const index=Number(body.index);if(!Number.isInteger(index)||index!==limits.next_mission||index<0||index>=MISSION_REWARDS.length)throw Object.assign(Error('That mission reward is not available.'),{status:409});const reward=MISSION_REWARDS[index];cash+=reward;delta=reward;reason='Completed story mission '+(index+1);db.prepare('INSERT INTO economy_limits(user_id,last_work_at,last_crime_at,next_mission) VALUES(?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET next_mission=excluded.next_mission').run(userId,limits.last_work_at,limits.last_crime_at,index+1);
    }else if(op==='settle'){
      const dateKey=lagosDateKey(),weekKey=lagosWeekKey(dateKey);
      if(limits.last_settle_date===dateKey){const info=db.prepare('SELECT job,job_level,shifts,rent,investments,business FROM economy_limits WHERE user_id=?').get(userId);db.exec('COMMIT');return {cash,bank,balance:w.balance,job:info?.job||'Courier',jobLevel:info?.job_level||0,shifts:info?.shifts||0,rent:info?.rent||3500,investments:info?.investments||0,business:!!info?.business,replayed:true}}
      let income=0;if(limits.investments>0)income+=Math.floor(limits.investments*.05);if(limits.business)income+=1200;
      if(limits.last_rent_week!==weekKey){const rent=Number(limits.rent||3500);if(cash>=rent){cash-=rent;delta-=rent;reason='Weekly rent'}db.prepare('INSERT INTO economy_limits(user_id,last_rent_week) VALUES(?,?) ON CONFLICT(user_id) DO UPDATE SET last_rent_week=excluded.last_rent_week').run(userId,weekKey)}
      cash+=income;delta+=income;if(income)reason='Daily business and investment income';db.prepare('INSERT INTO economy_limits(user_id,last_settle_date) VALUES(?,?) ON CONFLICT(user_id) DO UPDATE SET last_settle_date=excluded.last_settle_date').run(userId,dateKey);
    }else throw Object.assign(Error('This game-money action is not enabled for online accounts yet.'),{status:400});
    if(op==='business')db.prepare('INSERT INTO economy_limits(user_id,business) VALUES(?,1) ON CONFLICT(user_id) DO UPDATE SET business=1').run(userId);
    if(op==='upgradehome')db.prepare('INSERT INTO economy_limits(user_id,rent) VALUES(?,8500) ON CONFLICT(user_id) DO UPDATE SET rent=8500').run(userId);
    if(op==='invest')db.prepare('INSERT INTO economy_limits(user_id,investments) VALUES(?,5000) ON CONFLICT(user_id) DO UPDATE SET investments=investments+5000').run(userId);
    const balance=cash+bank;if(!Number.isSafeInteger(cash)||!Number.isSafeInteger(bank)||cash<0||bank<0||!Number.isSafeInteger(balance))throw Error('Invalid wallet balance');const stamp=nowISO();
    db.prepare('UPDATE wallets SET balance=?,cash_balance=?,bank_balance=?,updated_at=? WHERE user_id=?').run(balance,cash,bank,stamp,userId);
    db.prepare('INSERT INTO economy_ops(id,user_id,idempotency_key,operation,request_fingerprint,delta,cash_after,bank_after,created_at) VALUES(?,?,?,?,?,?,?,?,?)').run(randomId(),userId,key,op,requestFingerprint,delta,cash,bank,stamp);
    if(delta)db.prepare('INSERT INTO wallet_ledger(id,user_id,delta,balance_after,reason,created_at) VALUES(?,?,?,?,?,?)').run(randomId(),userId,delta,balance,reason,stamp);
    const info=db.prepare('SELECT job,job_level,shifts,rent,investments,business FROM economy_limits WHERE user_id=?').get(userId);db.exec('COMMIT');return {cash,bank,balance,job:info?.job||'Courier',jobLevel:info?.job_level||0,shifts:info?.shifts||0,rent:info?.rent||3500,investments:info?.investments||0,business:!!info?.business,replayed:false};
  }catch(e){if(db.isTransaction)db.exec('ROLLBACK');throw e}
}
async function paystackVerify(reference){const r=await fetch('https://api.paystack.co/transaction/verify/'+encodeURIComponent(reference),{headers:{Authorization:'Bearer '+process.env.PAYSTACK_SECRET_KEY}});if(!r.ok)throw Error('Paystack verification request failed');const v=await r.json();if(!v.status||!v.data)throw Error('Paystack did not return a valid verification');return v.data}
async function oxapayVerify(trackId){const r=await fetch('https://api.oxapay.com/v1/payment/'+encodeURIComponent(trackId),{headers:{merchant_api_key:process.env.OXAPAY_MERCHANT_API_KEY,'Content-Type':'application/json'}});if(!r.ok)throw Error('OxaPay verification request failed');const v=await r.json();if(!v.data)throw Error('OxaPay did not return payment information');return v.data}
async function verifyAndCredit(p,source){
  if(p.method==='bank_transfer'){
    const ref=p.provider_reference;if(!ref)return false;const v=await paystackVerify(ref);
    const paid=v.status==='success'&&v.reference===ref&&v.currency===p.fiat_currency&&v.amount===p.amount_minor&&v.channel==='bank_transfer';
    if(paid)return completePayment(p,v.amount/100,{source,reference:v.reference,status:v.status,amount:v.amount,currency:v.currency,channel:v.channel,paidAt:v.paid_at});
    if(['failed','abandoned'].includes(v.status))updateState(p.id,'Failed',ref,{source,status:v.status});
    if(v.status==='reversed'&&p.status!=='Completed')updateState(p.id,'Refunded',ref,{source,status:v.status});
    return false;
  }
  const ref=p.provider_reference;if(!ref)return false;const v=await oxapayVerify(ref);
  const status=String(v.status||'').toLowerCase();
  if(v.order_id!==p.provider_order_id)return false;
  if(status==='paid'&&String(v.currency||'').toUpperCase()===p.fiat_currency&&Number(v.amount)===p.amount_minor/100){
    return completePayment(p,Number(v.amount),{source,trackId:v.track_id,status:v.status,orderId:v.order_id,amount:v.amount,currency:v.currency,transactions:v.txs||[]});
  }
  if(status==='refunded'&&p.status!=='Completed'){updateState(p.id,'Refunded',ref,{source,status:v.status,trackId:v.track_id});return false}
  const target=status==='paying'?'Detecting payment':status==='confirming'?'Confirming':status==='expired'?'Expired':status==='failed'?'Failed':'Awaiting payment';
  if(target!==p.status)updateState(p.id,target,ref,{source,status:v.status,trackId:v.track_id,transactions:v.txs||[]});
  return false;
}
function isPaystackSignature(raw,signature){if(!process.env.PAYSTACK_SECRET_KEY||!signature)return false;const expected=crypto.createHmac('sha512',process.env.PAYSTACK_SECRET_KEY).update(raw).digest('hex');return safeEq(expected,signature)}
function isOxaSignature(raw,signature){if(!process.env.OXAPAY_MERCHANT_API_KEY||!signature)return false;const expected=crypto.createHmac('sha512',process.env.OXAPAY_MERCHANT_API_KEY).update(raw).digest('hex');return safeEq(expected,signature)}
const loginAttempts=new Map();
function rateLimit(req,res,key,max=12,windowMs=60000){const ip=req.socket.remoteAddress||'unknown',slot=ip+':'+key,now=Date.now(),v=loginAttempts.get(slot)||{count:0,start:now};if(now-v.start>windowMs){v.count=0;v.start=now}v.count++;loginAttempts.set(slot,v);if(v.count>max){json(res,429,{error:'Too many attempts. Try again shortly.'});return false}return true}

async function route(req,res){cors(req,res);if(req.method==='OPTIONS'){res.writeHead(204);res.end();return}
 const url=new URL(req.url,'http://localhost');const p=url.pathname;
 if(req.method==='GET'&&p==='/healthz'){try{db.prepare('SELECT 1').get();return json(res,200,{ok:true})}catch{return json(res,503,{ok:false})}}
 if(req.method==='POST'&&p==='/api/payments/webhooks/paystack'){
   const raw=await readBody(req);if(!isPaystackSignature(raw,req.headers['x-paystack-signature']))return json(res,401,{error:'Invalid provider signature'});
   const event=JSON.parse(raw.toString('utf8'));if(event.event==='charge.success'){
     const ref=event.data?.reference,meta=event.data?.metadata||{},paymentId=typeof meta==='object'?meta.payment_id:null;let payment=ref&&db.prepare('SELECT * FROM payments WHERE (provider_reference=? OR provider_order_id=?) AND provider=?').get(ref,ref,'paystack');if(!payment&&paymentId)payment=db.prepare("SELECT * FROM payments WHERE id=? AND provider='paystack'").get(paymentId);
     if(payment&&ref&&payment.provider_reference!==ref){updateState(payment.id,'Awaiting payment',ref,{provider:'paystack',reference:ref,webhook:true});payment=loadPayment(payment.id)}if(payment)await verifyAndCredit(payment,'paystack_webhook');
   }return json(res,200,{ok:true});
 }
 if(req.method==='POST'&&p==='/api/payments/webhooks/oxapay'){
   const raw=await readBody(req);if(!isOxaSignature(raw,req.headers.hmac))return json(res,401,{error:'Invalid provider signature'});
   const event=JSON.parse(raw.toString('utf8')),order=event.order_id;let payment=order&&db.prepare('SELECT * FROM payments WHERE provider_order_id=? AND provider=?').get(order,'oxapay');
   if(payment&&event.track_id&&payment.provider_reference!==String(event.track_id)){updateState(payment.id,'Awaiting payment',String(event.track_id),{provider:'oxapay',trackId:String(event.track_id),webhook:true});payment=loadPayment(payment.id)}if(payment)await verifyAndCredit(payment,'oxapay_webhook');return json(res,200,{ok:true});
 }
 if(req.method==='POST'&&p==='/api/auth/register'){
   if(!rateLimit(req,res,'register',5))return;const b=JSON.parse((await readBody(req)).toString('utf8'));const email=String(b.email||'').trim().toLowerCase(),name=String(b.displayName||'').trim().slice(0,32),username=String(b.username||'').trim().replace(/^@/,'').toLowerCase(),password=String(b.password||'');
   if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||!name||!/^[a-z0-9_]{3,20}$/.test(username)||password.length<12||password.length>200||b.adultConsent!==true)return json(res,400,{error:'Enter a valid email, name and username; use a password of at least 12 characters and confirm the age requirement.'});
   const id=randomId(),salt=crypto.randomBytes(16).toString('hex'),passwordHash=crypto.scryptSync(password,salt,64).toString('hex'),token=crypto.randomBytes(32).toString('base64url'),stamp=nowISO();
   try{db.exec('BEGIN IMMEDIATE');db.prepare('INSERT INTO users(id,email,display_name,password_salt,password_hash,created_at) VALUES(?,?,?,?,?,?)').run(id,email,name,salt,passwordHash,stamp);db.prepare("INSERT INTO profiles(user_id,username,adult_consent_at,terms_version,privacy_version,created_at,updated_at,last_login) VALUES(?,? ,?,'2026-10-05','2026-10-05',?,?,?)").run(id,username,stamp,stamp,stamp);db.prepare('INSERT INTO wallets(user_id,balance,cash_balance,bank_balance,updated_at) VALUES(?,8500,8500,0,?)').run(id,stamp);db.prepare('INSERT INTO wallet_ledger(id,user_id,delta,balance_after,reason,created_at) VALUES(?,?,8500,8500,?,?)').run(randomId(),id,'Starting game balance',stamp);db.prepare('INSERT INTO economy_limits(user_id,last_settle_date,last_rent_week) VALUES(?,?,?)').run(id,lagosDateKey(),lagosWeekKey());db.prepare('INSERT INTO sessions(token_hash,user_id,expires_at,created_at) VALUES(?,?,?,?)').run(hash(token),id,Date.now()+SESSION_MS,stamp);db.exec('COMMIT')}catch(e){if(db.isTransaction)db.exec('ROLLBACK');const conflict=String(e.message||'').includes('UNIQUE');return json(res,conflict?409:500,{error:conflict?'That email or username is already registered.':'Your account could not be created.'})}
   return json(res,201,{user:{id,displayName:name,username,email},balance:8500,accessToken:token},{'set-cookie':sessionCookie(token,Math.floor(SESSION_MS/1000))});
 }
 if(req.method==='POST'&&p==='/api/auth/login'){
   if(!rateLimit(req,res,'login',10))return;const b=JSON.parse((await readBody(req)).toString('utf8')),identity=String(b.identity||b.email||'').trim().toLowerCase(),password=String(b.password||'');const u=db.prepare('SELECT u.id,u.email,u.display_name,u.password_salt,u.password_hash,p.username FROM users u JOIN profiles p ON p.user_id=u.id WHERE u.email=? COLLATE NOCASE OR p.username=? COLLATE NOCASE').get(identity.replace(/^@/,''),identity.replace(/^@/,''));
   const candidate=u?crypto.scryptSync(password,u.password_salt,64).toString('hex'):crypto.scryptSync(password,'00000000000000000000000000000000',64).toString('hex');
   if(!u||!safeEq(candidate,u.password_hash))return json(res,401,{error:'Username/email or password is incorrect.'});const token=crypto.randomBytes(32).toString('base64url'),stamp=nowISO();db.prepare('INSERT INTO sessions(token_hash,user_id,expires_at,created_at) VALUES(?,?,?,?)').run(hash(token),u.id,Date.now()+SESSION_MS,stamp);db.prepare('UPDATE profiles SET last_login=?,updated_at=? WHERE user_id=?').run(stamp,stamp,u.id);return json(res,200,{user:{id:u.id,displayName:u.display_name,username:u.username,email:u.email},accessToken:token},{'set-cookie':sessionCookie(token,Math.floor(SESSION_MS/1000))});
 }
 if(req.method==='POST'&&p==='/api/auth/forgot-password'){
   if(!rateLimit(req,res,'forgot-password',4))return;const b=JSON.parse((await readBody(req)).toString('utf8')),email=String(b.email||'').trim().toLowerCase();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return json(res,400,{error:'Enter a valid email address.'});
   if(!process.env.RESEND_API_KEY||!process.env.RESET_EMAIL_FROM||!process.env.FRONTEND_URL)return json(res,503,{error:'Password recovery email is not configured on the account server yet.'});
   const u=db.prepare('SELECT id,email FROM users WHERE email=? COLLATE NOCASE').get(email);if(u){const token=crypto.randomBytes(32).toString('base64url'),stamp=nowISO();db.prepare('UPDATE password_resets SET used_at=? WHERE user_id=? AND used_at IS NULL').run(stamp,u.id);db.prepare('INSERT INTO password_resets(token_hash,user_id,expires_at,created_at) VALUES(?,?,?,?)').run(hash(token),u.id,Date.now()+30*60*1000,stamp);const link=process.env.FRONTEND_URL.replace(/\/$/,'')+'/?reset='+encodeURIComponent(token);const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+process.env.RESEND_API_KEY,'Content-Type':'application/json'},body:JSON.stringify({from:process.env.RESET_EMAIL_FROM,to:[u.email],subject:'Reset your Naija Life password',text:`Use this link within 30 minutes to choose a new password: ${link}\n\nIf you did not request a reset, you can ignore this email.`})});if(!response.ok){db.prepare('UPDATE password_resets SET used_at=? WHERE token_hash=?').run(nowISO(),hash(token));console.error('Password reset email provider rejected the request:',response.status);return json(res,502,{error:'The reset email could not be sent. Please try again later.'})}}
   return json(res,200,{message:'If an account matches that email, a reset link has been sent.'});
 }
 if(req.method==='POST'&&p==='/api/auth/reset-password'){
   if(!rateLimit(req,res,'reset-password',8))return;const b=JSON.parse((await readBody(req)).toString('utf8')),token=String(b.token||''),password=String(b.password||'');if(!/^[A-Za-z0-9_-]{40,60}$/.test(token)||password.length<12||password.length>200)return json(res,400,{error:'Use a valid reset link and a password of at least 12 characters.'});const reset=db.prepare('SELECT user_id,expires_at,used_at FROM password_resets WHERE token_hash=?').get(hash(token));if(!reset||reset.used_at||reset.expires_at<Date.now())return json(res,400,{error:'This reset link is invalid or expired. Request a new one.'});const salt=crypto.randomBytes(16).toString('hex'),passwordHash=crypto.scryptSync(password,salt,64).toString('hex'),stamp=nowISO();db.exec('BEGIN IMMEDIATE');try{const current=db.prepare('SELECT used_at,expires_at FROM password_resets WHERE token_hash=?').get(hash(token));if(!current||current.used_at||current.expires_at<Date.now())throw Error('Reset link already used');db.prepare('UPDATE users SET password_salt=?,password_hash=? WHERE id=?').run(salt,passwordHash,reset.user_id);db.prepare('UPDATE password_resets SET used_at=? WHERE token_hash=?').run(stamp,hash(token));db.prepare('UPDATE password_resets SET used_at=? WHERE user_id=? AND used_at IS NULL').run(stamp,reset.user_id);db.prepare('DELETE FROM sessions WHERE user_id=?').run(reset.user_id);db.exec('COMMIT')}catch(e){if(db.isTransaction)db.exec('ROLLBACK');return json(res,400,{error:'This reset link is invalid, expired, or already used. Request a new one.'})}return json(res,200,{message:'Password updated. You can now log in.'});
 }
 if(req.method==='POST'&&p==='/api/auth/logout'){
   const token=cookies(req)['nl_session'];if(token)db.prepare('DELETE FROM sessions WHERE token_hash=?').run(hash(token));return json(res,200,{ok:true},{'set-cookie':sessionCookie('',0)});
 }
 if(p.startsWith('/api/')){
   const userId=userRequired(req,res);if(!userId)return;
   if(req.method==='GET'&&p==='/api/auth/me'){const u=db.prepare('SELECT u.id,u.email,u.display_name,u.created_at,p.username,p.avatar_json,p.stats_json,p.inventory_json,p.settings_json,p.account_status,p.last_login FROM users u JOIN profiles p ON p.user_id=u.id WHERE u.id=?').get(userId),w=db.prepare('SELECT balance FROM wallets WHERE user_id=?').get(userId);return json(res,200,{user:{id:u.id,email:u.email,displayName:u.display_name,username:u.username,createdAt:u.created_at,lastLogin:u.last_login,status:u.account_status,avatar:JSON.parse(u.avatar_json),stats:JSON.parse(u.stats_json),inventory:JSON.parse(u.inventory_json),settings:JSON.parse(u.settings_json)},walletBalance:w?.balance||0})}
   if(req.method==='PUT'&&p==='/api/profile/avatar'){const b=JSON.parse((await readBody(req)).toString('utf8')),allowed={gender:['woman','man'],skin:['dark','medium','light'],hair:['curls','braids','fade'],outfit:['green','coral','blue']},optional={hairStyle:['lowcut','bald','curls','afro','locs','braids','classic','ponytail','bun','gele'],clothingStyle:['casual','hoodie','office','chill','sitework','owambe'],fabric:['plain','ankara','adire','aso-oke'],home:['Gwagwalada','Nyanya','Kubwa'],dream:['Oga at the Top','Abuja Property Mogul','Afrobeats Star',"Everybody’s Padi",'Jabi Startup Star'],birthStory:['Hustler from Nyanya','UniAbuja Pikin','Garki Market Family','Maitama Legacy']},avatar={};for(const [key,values] of Object.entries(allowed)){const value=String(b[key]||'');if(!values.includes(value))return json(res,400,{error:'Choose a valid character appearance.'});avatar[key]=value}for(const [key,values] of Object.entries(optional))if(b[key]!==undefined){if(typeof b[key]!=='string'||!values.includes(b[key]))return json(res,400,{error:'Choose a valid character appearance.'});avatar[key]=b[key]}for(const key of ['skinTone','hairColor','topColor','bottomColor'])if(b[key]!==undefined){if(!Number.isInteger(b[key])||b[key]<0||b[key]>(key==='skinTone'||key==='hairColor'?6:9))return json(res,400,{error:'Choose a valid character appearance.'});avatar[key]=b[key]}if(b.traits!==undefined){if(!Array.isArray(b.traits)||b.traits.length>2||b.traits.some(t=>typeof t!=='string'||t.length>30))return json(res,400,{error:'Choose valid character traits.'});avatar.traits=b.traits}if(b.onboardingComplete!==undefined){if(typeof b.onboardingComplete!=='boolean')return json(res,400,{error:'Invalid onboarding status.'});avatar.onboardingComplete=b.onboardingComplete}const stamp=nowISO();db.prepare('UPDATE profiles SET avatar_json=?,updated_at=? WHERE user_id=?').run(JSON.stringify(avatar),stamp,userId);return json(res,200,{avatar})}
   if(req.method==='GET'&&p==='/api/payments/packages')return json(res,200,{packages:Object.entries(packages).flatMap(([id,v])=>{const q=packageById(id);return q?[{id,amountMinor:q.amountMinor,fiatCurrency:q.currency,creditUnits:q.creditUnits}]:[]}),cryptoCurrencies:ALLOWED_CRYPTO,cryptoNetworks:ALLOWED_NETWORKS});
   if(req.method==='GET'&&p==='/api/wallet'){
     const w=db.prepare('SELECT balance,cash_balance,bank_balance,updated_at FROM wallets WHERE user_id=?').get(userId),e=db.prepare('SELECT job,job_level,shifts,rent,investments,business FROM economy_limits WHERE user_id=?').get(userId);const ledger=db.prepare('SELECT delta,balance_after,reason,created_at FROM wallet_ledger WHERE user_id=? ORDER BY created_at DESC LIMIT 30').all(userId);return json(res,200,{balance:w?.balance||0,cash:w?.cash_balance||0,bank:w?.bank_balance||0,updatedAt:w?.updated_at||null,job:e?.job||'Courier',jobLevel:e?.job_level||0,shifts:e?.shifts||0,rent:e?.rent||3500,investments:e?.investments||0,business:!!e?.business,ledger});
   }
   if(req.method==='POST'&&p==='/api/economy/action'){
     if(!rateLimit(req,res,'economy-action',60))return;const body=JSON.parse((await readBody(req)).toString('utf8'));try{return json(res,200,{wallet:economyCommand(userId,req.headers['idempotency-key'],body)})}catch(e){return json(res,e.status||500,{error:e.status?e.message:'Game transaction could not be applied.'})}
   }
   if(req.method==='GET'&&p==='/api/payments')return json(res,200,{transactions:db.prepare('SELECT * FROM payments WHERE user_id=? ORDER BY created_at DESC LIMIT 30').all(userId).map(publicPayment)});
   if(req.method==='POST'&&p==='/api/payments'){
     if(!rateLimit(req,res,'payment-create',10))return;const key=req.headers['idempotency-key'];if(typeof key!=='string'||key.length<16||key.length>100)return json(res,400,{error:'A unique idempotency key is required.'});const b=JSON.parse((await readBody(req)).toString('utf8'));const method=b.method,pack=packageById(String(b.packageId||''));if(!pack)return json(res,400,{error:'Choose an available server-priced package.'});
     if(process.env.PAYMENT_SANDBOX!=='true'&&!(process.env.NODE_ENV==='production'&&process.env.LIVE_PAYMENTS_ENABLED==='true'))return json(res,503,{error:'Live payments are disabled. Enable them explicitly only after production HTTPS, economy migration, and provider review are complete.'});
     if(!publicApiUrl().startsWith('https://'))return json(res,503,{error:'The secure HTTPS payment server URL has not been configured.'});
     if(!['bank_transfer','crypto'].includes(method))return json(res,400,{error:'Choose a supported payment method.'});const cur=String(b.cryptoCurrency||'').toUpperCase(),net=String(b.network||'');if(method==='crypto'&&(!ALLOWED_CRYPTO.includes(cur)||(net&&ALLOWED_NETWORKS[cur]!==net)))return json(res,400,{error:'That cryptocurrency or network is not enabled.'});if(method==='bank_transfer'&&!process.env.PAYSTACK_SECRET_KEY)return json(res,503,{error:'Bank transfer payments are not configured on the server.'});if(method==='bank_transfer'&&process.env.PAYMENT_SANDBOX==='true'&&!process.env.PAYSTACK_SECRET_KEY.startsWith('sk_test_'))return json(res,503,{error:'Sandbox mode requires a Paystack test secret key.'});if(method==='bank_transfer'&&process.env.PAYMENT_SANDBOX!=='true'&&!process.env.PAYSTACK_SECRET_KEY.startsWith('sk_live_'))return json(res,503,{error:'Live mode requires a Paystack live secret key.'});if(method==='crypto'&&!process.env.OXAPAY_MERCHANT_API_KEY)return json(res,503,{error:'Crypto payments are not configured on the server.'});
     const fingerprint=hash(JSON.stringify({packageId:pack.id,method,currency:cur,network:net}));let pay=db.prepare('SELECT * FROM payments WHERE user_id=? AND idempotency_key=?').get(userId,key);if(pay){if(pay.request_fingerprint!==fingerprint)return json(res,409,{error:'That idempotency key was already used for a different request.'});if(!pay.provider_reference&&pay.status==='Pending')return json(res,409,{error:'Payment creation is being reconciled. Check the transaction again shortly.'});return json(res,200,{transaction:publicPayment(pay)})}
     const stamp=nowISO(),id=randomId(),providerOrderId='NL-'+id;db.prepare(`INSERT INTO payments(id,user_id,package_id,amount_minor,fiat_currency,credit_units,method,status,provider,provider_order_id,idempotency_key,request_fingerprint,created_at,updated_at) VALUES(?,?,?,?,?,?,?,'Pending',?,?,?,?,?,?)`).run(id,userId,pack.id,pack.amountMinor,pack.currency,pack.creditUnits,method,method==='bank_transfer'?'paystack':'oxapay',providerOrderId,key,fingerprint,stamp,stamp);pay=loadPayment(id);
     try{
       if(method==='bank_transfer'){
         const user=db.prepare('SELECT email FROM users WHERE id=?').get(userId),expires=new Date(Date.now()+60*60*1000).toISOString();const response=await fetch('https://api.paystack.co/charge',{method:'POST',headers:{Authorization:'Bearer '+process.env.PAYSTACK_SECRET_KEY,'Content-Type':'application/json'},body:JSON.stringify({email:user.email,amount:pack.amountMinor,reference:providerOrderId,bank_transfer:{account_expires_at:expires},metadata:{payment_id:id,order_id:providerOrderId}})});const result=await response.json();if(!response.ok||!result.status||!result.data?.reference)throw Error('Paystack could not create the bank transfer.');const d=result.data;const instructions={bank:d.bank?.name||'Bank transfer',accountName:d.account_name||'',accountNumber:d.account_number||'',reference:d.reference,displayText:d.display_text||'Transfer the exact amount to this temporary account.'};updateState(id,'Awaiting payment',d.reference,{provider:'paystack',reference:d.reference,status:d.status},instructions,d.account_expires_at||expires);
       }else{
         const user=db.prepare('SELECT email FROM users WHERE id=?').get(userId);const body={amount:pack.amountMinor/100,currency:'NGN',pay_currency:cur,callback_url:publicApiUrl()+'/api/payments/webhooks/oxapay',order_id:providerOrderId,description:'Naija Life game-money package '+pack.id,email:user.email,lifetime:60,sandbox:process.env.PAYMENT_SANDBOX==='true'};if(net)body.network=net;const response=await fetch('https://api.oxapay.com/v1/payment/white-label',{method:'POST',headers:{merchant_api_key:process.env.OXAPAY_MERCHANT_API_KEY,'Content-Type':'application/json'},body:JSON.stringify(body)});const result=await response.json();const d=result.data;if(!response.ok||!d?.track_id||!d?.address)throw Error('OxaPay could not create the crypto payment.');const instructions={address:d.address,amount:d.pay_amount,currency:d.pay_currency,network:d.network,memo:d.memo||'',qrCode:d.qr_code||'',providerTrackId:d.track_id};updateState(id,'Awaiting payment',String(d.track_id),{provider:'oxapay',trackId:d.track_id,status:'new',orderId:providerOrderId},instructions,d.expired_at?new Date(d.expired_at*1000).toISOString():new Date(Date.now()+3600000).toISOString());
       }
     }catch(e){updateState(id,'Failed',null,{providerError:String(e.message||'Provider request failed').slice(0,200)});return json(res,502,{error:'The payment provider could not start this request. No game money was added.'})}
     return json(res,201,{transaction:publicPayment(loadPayment(id))});
   }
   const match=p.match(/^\/api\/payments\/([0-9a-f-]{36})$/i);if(req.method==='GET'&&match){let pay=loadPayment(match[1]);if(!pay||pay.user_id!==userId)return json(res,404,{error:'Transaction not found.'});if(pay.status!=='Completed'&&pay.status!=='Failed'&&pay.status!=='Expired'&&pay.provider_reference){try{await verifyAndCredit(pay,'user_status_refresh')}catch{}}pay=loadPayment(pay.id);return json(res,200,{transaction:publicPayment(pay)})}
   return json(res,404,{error:'API route not found.'});
 }
 if(req.method==='GET'||req.method==='HEAD'){
   const requested=p==='/'?'index.html':decodeURIComponent(p).replace(/^\/+/,''),file=path.resolve(ROOT,requested);if(!file.startsWith(ROOT+path.sep)&&file!==path.join(ROOT,'index.html'))return json(res,403,{error:'Forbidden'});if(file===path.join(ROOT,'backend')||file.startsWith(path.join(ROOT,'backend')+path.sep)||requested.split(/[\\/]/).some(part=>part.startsWith('.env')||part==='.git'))return json(res,404,{error:'Not found'});if(!fs.existsSync(file)||!fs.statSync(file).isFile())return json(res,404,{error:'Not found'});const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.svg':'image/svg+xml','.json':'application/json'};res.writeHead(200,{'content-type':types[path.extname(file)]||'application/octet-stream','cache-control':path.extname(file)==='.html'?'no-cache':'public, max-age=3600'});if(req.method==='HEAD')return res.end();fs.createReadStream(file).pipe(res);return;
 }
 json(res,405,{error:'Method not allowed.'});
}

const publicApiUrl=()=>String(process.env.PUBLIC_API_URL||process.env.RENDER_EXTERNAL_URL||'').replace(/\/+$/,'');
http.createServer((req,res)=>{route(req,res).catch(e=>{console.error('request failed:',e.message);if(!res.headersSent)json(res,e.status||500,{error:e.status?e.message:'Request could not be processed.'});else res.end()})}).listen(PORT,'0.0.0.0',()=>console.log(`Naija Life server listening on port ${PORT}`));
