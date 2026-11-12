/* Continuous, local-only campus experience. No server writes. */
function experienceEvent(message){if(!SIM.immersive)return;SIM.activity.unshift({time:t,message});SIM.activity=SIM.activity.slice(0,8);}
function startExperience(){
 closed={};reset(5);simTo(465);SIM.immersive=true;SIM.traffic=1.65;SIM.arrivals=0;SIM.checkins=0;SIM.boarded=0;SIM.activity=[];SIM.requests=[];SIM.disruptions={L:{},C:{}};SIM.stats={wait:0,served:0,backupBoarded:0,departures:0,opening:SIM.q.length};
 const level=$('#trafficLevel');if(level)level.value='1.65';$('#day').value=DAYI;$('#spd').value='1';
 setPlaying(true);view('office');if(typeof setWorkspace==='function')setWorkspace('overview');
 experienceEvent('Morning rush is starting. Students are arriving at both stops.');draw();
 note('Campus experience is running. Explore operations or the student ride; only Pause stops time.');
 if(typeof renderRoleMenu==='function')renderRoleMenu();
}
function setExperienceTraffic(value){const n=Number(value);if(SIM.immersive&&[0.55,1,1.65].includes(n)){SIM.traffic=n;experienceEvent('Arrival intensity changed. Existing queues keep their places.');draw();}}
function drawExperience(){
 const panel=$('#campusExperience');if(!panel)return;panel.hidden=!SIM.immersive;if(!SIM.immersive){for(const id of ['#demoDriverPanel','#demoStudentUpdates']){const n=$(id);if(n)n.innerHTML='';}return;}
 $('#experienceMetrics').innerHTML=[['New ride requests',SIM.arrivals],['Checked in',SIM.checkins],['Boarded',SIM.boarded],['Waiting now',Q('L').length+Q('C').length]].map(([label,n])=>`<div><strong>${n}</strong><span>${label}</span></div>`).join('');
 $('#experienceCrowds').innerHTML=['L','C'].map(s=>{const q=Q(s).length,p=P(s).length,visible=Math.min(q,72);return `<article><div class="row"><h3>${SN[s]}</h3><strong>${q} waiting</strong></div><div class="crowd-people" aria-hidden="true">${Array.from({length:visible},(_,i)=>`<i style="--delay:${i%9*-.16}s"></i>`).join('')}</div><p>${q>72?'Each figure represents part of the queue. ':''}${p} on their way to check-in · ${t<END?'Next departure '+fmt(nextExperienceDeparture(s)):'Service closed'}</p></article>`;}).join('');
 drawExperienceExtension();
 $('#experienceFeed').innerHTML=SIM.activity.map(x=>`<p><time>${fmt(x.time)}</time><span>${x.message}</span></p>`).join('');
}
const experienceGuide=guideHTML;
guideHTML=function(){if(!SIM.immersive)return experienceGuide();return `<div class="next-action"><div><span class="eyebrow">CONTINUOUS SIMULATION</span><h2>${playing?'The campus keeps moving.':'The campus is paused.'}</h2><p>Queues grow as students check in. Dispatch a backup from a stop card, or join as a student. Navigation keeps the same clock and queues.</p></div><div class="guide-actions"><button onclick="view('student');renderRoleMenu()">Experience a student ride</button></div></div>`;};


function stopClosed(s){return !!(SIM.immersive&&SIM.disruptions?.[s]?.closedUntil>t);}
const experienceCapacity=capacityAt;
capacityAt=function(s,m){
 if(!SIM.immersive)return experienceCapacity(s,m);
 const d=SIM.disruptions[s];if(d.closedUntil>m||d.delayFrom===m)return 0;
 return (d.delayTo===m?CAP:((m-START)%HW===0?CAP:0))+(SIM.extra[s]?.departure===m?CAP:0);
};
const experienceEstimate=estimate;
estimate=function(s,pos){
 if(!SIM.immersive)return experienceEstimate(s,pos);
 const times=[];for(let m=nextDep();m<=END;m+=HW)times.push(m);
 const delayed=SIM.disruptions[s].delayTo;if(delayed>t&&delayed<=END)times.push(delayed);
 for(const m of [...new Set(times)].sort((a,b)=>a-b)){const cap=capacityAt(s,m);if(cap&&pos<=cap)return {time:m,wait:m-t,backup:pos>CAP,bus:busOf(s,SIM.disruptions[s].delayTo===m?SIM.disruptions[s].delayFrom:m)+1};pos-=cap;}
 return null;
};
const experienceDispatch=dispatchBackup;
dispatchBackup=function(s){
 if(!SIM.immersive)return experienceDispatch(s);
 if(!['L','C'].includes(s)||stopClosed(s)||SIM.extra[s]||SIM.requests.some(x=>x.s===s&&['requested','accepted','arrived'].includes(x.status)))return;
 if(t+BACKUP_TRAVEL>END){note('No backup can reach this stop before closing.');return;}
 SIM.requests.push({id:SIM.requests.length+1,s,sent:t,status:'requested',queuedAtDispatch:Q(s).length});
 experienceEvent(`Staff requested a backup at ${SN[s]}. Awaiting driver acceptance.`);draw();
};
function respondDemoDriver(id,response){
 if(!SIM.immersive)return;const job=SIM.requests.find(x=>x.id===id);if(!job||job.status!=='requested'||!['accepted','declined'].includes(response))return;
 if(response==='declined'){job.status='declined';experienceEvent(`Driver declined the ${SN[job.s]} request. Staff can request again.`);draw();return;}
 const arrival=t+BACKUP_TRAVEL,departure=START+Math.ceil((arrival-START)/HW)*HW;
 if(departure>END||stopClosed(job.s)){note('This stop cannot accept a backup now. Decline or wait until it reopens.');return;}
 Object.assign(job,{status:'accepted',arrival,departure,accepted:t});SIM.extra[job.s]=job;SIM.actions.push(job);
 experienceEvent(`Driver accepted: backup to ${SN[job.s]}, arriving ${fmt(arrival)}, boarding at ${fmt(departure)}.`);draw();
}
const experienceDepart=depart;
depart=function(s,m){
 if(!SIM.immersive)return experienceDepart(s,m);
 const d=SIM.disruptions[s];
 if(d.closedUntil>m||d.delayFrom===m){
  const job=SIM.extra[s];if(job?.departure===m){job.departure=START+Math.ceil((Math.max(m+1,d.closedUntil||0,d.delayTo||0)-START)/HW)*HW;if(job.departure>END){job.status='declined';SIM.extra[s]=0;experienceEvent('Backup cancelled: no departure before service closes.');}}
  experienceEvent(`${SN[s]}: departure held; queue order preserved.`);return;
 }
 const before=Q(s),job=SIM.extra[s],cap=experienceCapacity(s,m),go=before.slice(0,cap);
 // A delayed regular bus still has 75 seats; the base departure applies accepted backup seats.
 experienceDepart(s,m);
 SIM.stats.served+=go.length;SIM.stats.wait+=go.reduce((sum,x)=>sum+Math.max(0,m-x.ts),0);
 SIM.stats.departures++;if(job?.status==='departed')SIM.stats.backupBoarded+=job.backupBoarded;
 if(d.delayTo===m){delete d.delayFrom;delete d.delayTo;}
};
const experienceStep=step;
step=function(){
 experienceStep();if(!SIM.immersive||t>END)return;
 for(const s of ['L','C']){
  const d=SIM.disruptions[s];if(d.delayTo===t&&(t-START)%HW!==0)depart(s,t);
  if(d.closedUntil===t)experienceEvent(`${SN[s]} reopened. Boarding resumes at the next scheduled departure.`);
  const job=SIM.extra[s];if(job&&job.status==='accepted'&&t>=job.arrival){job.status='arrived';experienceEvent(`Backup arrived at ${SN[s]}. Boarding at ${fmt(job.departure)}.`);}
 }
};
function triggerCampusEvent(kind){
 if(!SIM.immersive||t>=END)return;const s=$('#eventStop').value;if(!['L','C'].includes(s))return;const d=SIM.disruptions[s];
 if(kind==='lecture'){
  for(let i=0;i<60;i++)SIM.q.push({id:tp(),stop:s,st:'p',tj:t,ts:null,plan:t+1+Math.floor(R()*4),skip:false,carried:false});
  SIM.arrivals+=60;experienceEvent(`Lecture dismissal: 60 students heading to ${SN[s]}.`);
 }else if(kind==='delay'){
  if(d.delayTo>t){note('A bus delay is already active at this stop.');return;}
  const from=nextDep();if(from+5>END){note('Too late to delay another departure today.');return;}
  d.delayFrom=from;d.delayTo=from+5;experienceEvent(`${SN[s]} bus delayed: ${fmt(from)} departure moves to ${fmt(d.delayTo)}.`);
 }else if(kind==='closure'){
  d.closedUntil=Math.min(END,t+10);experienceEvent(`${SN[s]} temporarily closed until ${fmt(d.closedUntil)}. Requests continue; boarding is held.`);
 }else return;
 draw();
}
function drawExperienceExtension(){
 if(!SIM.immersive)return;
 $('#experienceMap').innerHTML=mapHTML(null)+['L','C'].map(s=>{const j=SIM.extra[s];return j?`<p>${SN[s]} backup: ${t<j.arrival?'travelling, ETA '+fmt(j.arrival):'at stop'} · boarding ${fmt(j.departure)}</p>`:'';}).join('');
 const avg=SIM.stats.served?(SIM.stats.wait/SIM.stats.served).toFixed(1):'—';
 $('#experienceResults').innerHTML=`<div class="experience-metrics"><div><strong>${SIM.stats.served}</strong><span>Passengers boarded</span></div><div><strong>${Q('L').length+Q('C').length}</strong><span>Still waiting</span></div><div><strong>${SIM.stats.backupBoarded}</strong><span>Backup seats used</span></div><div><strong>${avg}</strong><span>Mean queue wait, minutes</span></div></div><p class="mut">Measured since this session started, including students already present. Queue wait is check-in to boarding for boarded students only. No claim of real-world savings.</p>`;
 const notices=['L','C'].flatMap(s=>{const d=SIM.disruptions[s];return [d.closedUntil>t?`${SN[s]} closed until ${fmt(d.closedUntil)}.`:'',d.delayTo>t?`${SN[s]} bus now departs ${fmt(d.delayTo)}.`:''].filter(Boolean);});
 $('#experienceDisruptions').innerHTML=notices.map(x=>`<p class="item warn">${x}</p>`).join('');
 const driverMarkup=`<h2>Simulated driver inbox</h2><p>Accept a request to send a vehicle. The same queue and clock continue across all three views.</p>`+(SIM.requests.slice().reverse().map(j=>`<article class="response-card"><h3>${SN[j.s]} · request #${j.id}</h3><p>${j.status==='departed'?'Completed':j.status} · ${j.queuedAtDispatch} waiting when requested</p>${j.status==='requested'?`<button onclick="respondDemoDriver(${j.id},'accepted')">Accept request #${j.id}</button> <button onclick="respondDemoDriver(${j.id},'declined')">Decline request #${j.id}</button>`:j.arrival?`<p>Arrival ${fmt(j.arrival)} · departure ${fmt(j.departure)}</p>`:''}</article>`).join('')||'<p>No requests yet. Request support from Demo operations.</p>');
 const driverPanel=$('#demoDriverPanel');if(driverPanel.innerHTML!==driverMarkup)driverPanel.innerHTML=driverMarkup;
 const me=SIM.me,s=me?.stop,job=s&&SIM.extra[s];
 $('#demoStudentUpdates').innerHTML='<h3>Your campus updates</h3>'+[...notices,job?`Your backup is ${t<job.arrival?'on its way':'at the stop'}. Boarding at ${fmt(job.departure)}.`:'',SIM.activity.find(x=>x.message.includes('Lecture dismissal'))?.message||'',me?.done==='boarded'?`You boarded at ${fmt(me.tb)}. Estimated arrival ${fmt(me.tb+TRIP)}.`:''].filter(Boolean).map(x=>`<p>${x}</p>`).join('');
}
const experienceStopPanel=stopPanel;
stopPanel=function(s){let html=experienceStopPanel(s);if(!SIM.immersive)return html;const pending=SIM.requests.find(x=>x.s===s&&x.status==='requested');
 if(pending)html=html.replace(/<button[^>]*onclick="dispatchBackup[^>]*>[^<]*<\/button>/,`<button onclick="view('driver');renderRoleMenu()">Awaiting driver · open request #${pending.id}</button>`);
 if(stopClosed(s)){html=html.replace('students waiting','students waiting · stop temporarily closed');html=html.replace(/<button([^>]*onclick="dispatchBackup)/,'<button disabled$1');}
 return html;};
function nextExperienceDeparture(s){return estimate(s,1)?.time||END;}
const experienceBusState=busState;
busState=function(b){
 if(SIM.immersive)for(const s of ['L','C']){const d=SIM.disruptions[s];if(d.delayFrom<=t&&d.delayTo>t&&busOf(s,d.delayFrom)===b)return {b,mode:'park',at:s,leaves:d.delayTo};}
 return experienceBusState(b);
};
const experienceMapHTML=mapHTML;
mapHTML=function(hl){let html=experienceMapHTML(hl);if(!SIM.immersive)return html;
 let markers='';for(const s of ['L','C']){const j=SIM.extra[s];if(j&&t<j.arrival){const u=Math.max(0,Math.min(1,(t-j.accepted)/BACKUP_TRAVEL)),point=EL(s==='L'?'CL':'LC',u);markers+=busG('B',point[0],point[1]-18,false,false,true);}}
 return html.replace('</svg>',markers+'</svg>');
};
