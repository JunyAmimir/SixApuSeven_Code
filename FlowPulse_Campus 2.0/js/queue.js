/* FlowPulse Campus - queue.js
   Bus rotation schedule, the queue simulation engine and the student actions
   (join -> pending, scan at kiosk -> on queue, board). */

/* ---- schedule: 6 buses in rotation, 60 minute loop: 20 min to campus, 10 min boarding, 20 min back, 10 min boarding ---- */
const busOf=(s,x)=>{const k=Math.round((x-START)/HW);return((((s==='L'?k:k-3)%6)+6)%6)};
const nextDep=()=>t+HW-((((t-START)%HW)+HW)%HW);
const BACKUP_TRAVEL=5;
let capacityAt=(s,m)=>CAP+(SIM.extra[s]&&SIM.extra[s].departure===m?CAP:0);
function estimate(s,pos){
 for(let m=nextDep();m<=END;m+=HW){const cap=capacityAt(s,m);if(pos<=cap)return{time:m,wait:m-t,backup:pos>CAP,bus:busOf(s,m)+1};pos-=cap}
 return null;
}
function dispatchBackup(s){
 if(SIM.extra[s])return;
 const arrival=t+BACKUP_TRAVEL,departure=START+Math.ceil((arrival-START)/HW)*HW;
 if(departure>END){note('Too late to dispatch a backup before service closes.');return}
 const job={s,sent:t,arrival,departure,queuedAtDispatch:Q(s).length,status:'dispatched'};
 SIM.extra[s]=job;SIM.actions.push(job);
 note(`Backup dispatched to ${SN[s]}. Arrival ${fmt(arrival)}, departure ${fmt(departure)}.`);draw();
}
function backupStatus(s){const b=SIM.extra[s];return b?`${t<b.arrival?'On the way · arrives '+fmt(b.arrival):'Arrived · boarding'} · departs ${fmt(b.departure)}`:''}
function busState(b){const p=(((t-START-HW*b)%60)+60)%60;
 if(p<20)return{b,mode:'move',dir:'LC',u:p/20,eta:t+20-p};
 if(p<30)return{b,mode:'park',at:'C',leaves:t+30-p};
 if(p<50)return{b,mode:'move',dir:'CL',u:(p-30)/20,eta:t+50-p};
 return{b,mode:'park',at:'L',leaves:t+60-p}}
const busLine=b=>{const s=busState(b),n='Bus #'+(b+1);return s.mode==='move'?`${n} is on the way to ${s.dir==='LC'?'the school campus':'the LRT station'}, arriving at ${fmt(s.eta)}.`:`${n} is boarding at ${s.at==='L'?'the LRT station':'the school campus'} and leaves at ${fmt(s.leaves)}.`};

/* ---- queue simulation: join in app (pending) -> scan at kiosk (on queue) -> board ---- */
const tp=()=>'TP'+String(Math.floor(R()*1e6)).padStart(6,'0');
function reset(d){if(d!==undefined)DAYI=d;R=rng(1000+DAYI*77);SIM={q:[],dep:[],scans:[],bk:[],actions:[],extra:{L:0,C:0},now:START-1,me:null};t=START-1}
function pois(l){const L=Math.exp(-l);let k=0,p=1;do{k++;p*=R()}while(p>L);return k-1}
const Q=s=>SIM.q.filter(x=>x.st==='q'&&x.stop===s).sort((a,b)=>a.ts-b.ts),P=s=>SIM.q.filter(x=>x.st==='p'&&x.stop===s);
function depart(s,m){const bus=busOf(s,SIM.immersive&&SIM.disruptions[s].delayTo===m?SIM.disruptions[s].delayFrom:m),qd=Q(s),hi=Math.floor(m/60)-6;let ex=!!(SIM.extra[s]&&SIM.extra[s].departure===m);
 if(AUTO&&!ex&&qd.length>2*CAP)ex=1; // history: the office answered every alert
 const cap=CAP*(ex?2:1),job=SIM.extra[s];if(ex)SIM.extra[s]=0;if(ex&&!REC)SIM.bk.push({s,d:m});
 const go=qd.slice(0,cap),stay=qd.slice(cap),g=new Set(go);if(SIM.immersive){SIM.boarded+=go.length;if(go.length||stay.length)experienceEvent(`${SN[s]}: ${go.length} boarded${ex?' regular + backup buses':''}; ${stay.length} still waiting.`);}
 SIM.q=SIM.q.filter(x=>!g.has(x));stay.forEach(x=>x.carried=true);
 if(ex&&job){Object.assign(job,{status:'departed',queuedAtDeparture:qd.length,regularBoarded:Math.min(CAP,go.length),backupBoarded:Math.max(0,go.length-CAP),remaining:stay.length});}
 go.forEach((x,i)=>{if(x.me){x.done='boarded';x.backup=i>=CAP;x.bus=x.backup?'Backup':bus+1;x.tb=m}});
 if(REC){const r=REC[s][hi];r.brd+=go.length;r.mq=Math.max(r.mq,qd.length);if(ex)r.bk++}
 else if(go.length||stay.length){SIM.dep.unshift({t:m,s,bus:bus+1,n:go.length,left:stay.length,cap,ex});if(SIM.dep.length>10)SIM.dep.pop()}}
function step(){const m=++SIM.now;t=m;const hi=Math.floor(m/60)-6;
 if(m>END)return; // Let the final ride finish without generating after-hours service.
 ['L','C'].forEach(s=>{const n=SIM.demo?0:pois(lam(s,DAYI,m)*(SIM.immersive?(SIM.traffic||1)*(1+0.45*Math.max(0,Math.sin((m-START)/7))):1));if(SIM.immersive){SIM.arrivals+=n;if(n)experienceEvent(`${n} students requested rides at ${SN[s]}.`);}if(REC)REC[s][hi].req+=n;for(let i=0;i<n;i++)SIM.q.push({id:tp(),stop:s,st:'p',tj:m,ts:null,plan:m+1+Math.floor(R()*8),skip:R()<.08,carried:false})});
 const keep=[];
 for(const x of SIM.q){
  if(x.st==='p'){
   if(!x.me&&!x.skip&&m>=x.plan){x.st='q';x.ts=m+R()*.9;if(SIM.immersive)SIM.checkins++;const k=1+Math.floor(R()*3),q=R()<.6?'QR':'NFC';if(!REC){SIM.scans.push({t:m,id:x.id,s:x.stop,k,q});if(SIM.scans.length>10)SIM.scans.shift()}}
   else if(m-x.tj>=EXP){if(x.me)x.done='expired';if(REC)REC[x.stop][hi].ns++;continue}}
  keep.push(x)}
 SIM.q=keep;
 if((m-START)%HW===0){depart('L',m);depart('C',m)}}
function simTo(x){if(x<SIM.now)reset();while(SIM.now<x)step()}

/* student actions */
function joinMe(s){if(t>=END)return;SIM.q=SIM.q.filter(x=>!x.me);const x={id:MYID,me:true,stop:s,st:'p',tj:t,ts:null,plan:1e9,skip:false,carried:false};SIM.q.push(x);SIM.me=x;draw()}
function scanMe(){const x=SIM.me;if(x&&x.st==='p'&&!x.done){x.st='q';x.ts=t+.95;SIM.scans.push({t,id:MYID,s:x.stop,k:1,q:'QR'});if(SIM.scans.length>10)SIM.scans.shift()}draw()}
function cancelMe(){SIM.q=SIM.q.filter(x=>!x.me);SIM.me=null;draw()}

