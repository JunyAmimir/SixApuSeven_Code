/* Management summary and dispatch outcomes, derived from the live simulation. */
function operationsHTML(){
 const stops=['L','C'],waiting=stops.reduce((n,s)=>n+Q(s).length,0);
 const overflow=stops.reduce((n,s)=>n+Math.max(0,Q(s).length-(t<END?capacityAt(s,nextDep()):0)),0);
 const active=stops.filter(s=>SIM.extra[s]).length;
 return `<article class="summary-card"><span>Confirmed students waiting</span><strong>${waiting}</strong><small>Across LRT and campus stops</small></article><article class="summary-card ${overflow?'attention':''}"><span>${t>=END?'Waiting after service closes':'Cannot fit the next departure'}</span><strong>${overflow}</strong><small>${t>=END?'Alternative transport needed':'Based on scheduled capacity at '+fmt(nextDep())}</small></article><article class="summary-card"><span>Backup shuttles dispatched</span><strong>${active}</strong><small>En route or boarding at a stop</small></article>`;
}
function guideHTML(){
 let title='Start with one clear scenario',body='Load 161 waiting students at the LRT station. The demo pauses so you can explain each action.',label='Start guided demo',action='loadDemo()';
 if(SIM.demo){
  const job=SIM.actions.slice().reverse().find(x=>x.s==='L'),b=SIM.extra.L;
  if(!job){title='1 / Respond to the LRT queue';body='The next regular bus has 75 seats. Dispatch a backup to add 75 more at its scheduled departure.';label='Dispatch LRT backup';action="dispatchBackup('L')";}
  else if(b&&t<b.arrival){title='2 / Backup is on the way';body=`Dispatched at ${fmt(b.sent)}. Expected at ${fmt(b.arrival)}. Students remain in the queue until departure.`;label='Show backup arrival';action='advanceDemo()';}
  else if(b){title='3 / Backup arrived - ready to board';body=`The backup is at the LRT stop. Both buses depart at ${fmt(b.departure)}. Advance to see the actual boarding result.`;label='Show boarding result';action='advanceDemo()';}
  else{title='4 / Review the actual outcome';body=`At ${fmt(job.departure)}, the regular bus carried ${job.regularBoarded} students and the backup carried ${job.backupBoarded}. ${job.remaining} remained immediately after that departure. Current queue: ${Q('L').length}.`;label='View student confirmation';action="view('student')";}
 }
 const finished=SIM.demo&&SIM.actions.some(job=>job.s==='L'&&job.status==='departed');
 return `<div class="next-action"><div><span class="eyebrow">${SIM.demo?'FIXED SCENARIO / NEW ARRIVALS OFF':'DEMO WALKTHROUGH'}</span><h2>${title}</h2><p>${body}</p>${finished?'<p>This scenario has no new arrivals. Continue normal simulation to generate new students again.</p>':''}</div><div class="guide-actions"><button class="pri" onclick="${action}">${label}</button>${finished?'<button onclick="resumeTraffic()">Continue normal simulation</button>':''}</div></div>`;
}
function responsesHTML(){
 if(!SIM.actions.length)return '<div class="empty-state">No backup dispatched yet. Dispatch from a stop card to track arrival, boarding and the resulting queue here.</div>';
 return SIM.actions.slice(-4).reverse().map(job=>{
  const departed=job.status==='departed',arrived=t>=job.arrival;
  const stages=[['Dispatched',fmt(job.sent),true],['Arrived',fmt(job.arrival),arrived],['Departed',fmt(job.departure),departed],['Result',departed?job.backupBoarded+' on backup':'Awaiting boarding',departed]];
  return `<article class="response-card"><div class="row"><h3>${SN[job.s]} / backup shuttle</h3><span class="status-label">${departed?'Departure completed':arrived?'At stop / boarding':'En route to stop'}</span></div><ol class="dispatch-steps">${stages.map(([name,time,done])=>`<li class="${done?'done':''}"><b>${name}</b><span>${time}</span></li>`).join('')}</ol>${departed?`<div class="outcome-grid"><div><strong>${job.regularBoarded}</strong><span>Regular bus boarded</span></div><div><strong>${job.backupBoarded}</strong><span>Backup boarded</span></div><div><strong>${job.remaining}</strong><span>Left after departure</span></div></div><p class="mut">${job.queuedAtDeparture} waiting immediately before the ${fmt(job.departure)} departure. Current queue: ${Q(job.s).length}. Outcome from this simulated dispatch.</p>`:`<p>${job.queuedAtDispatch} waiting when dispatched; ${Q(job.s).length} waiting now. The backup adds up to 75 seats at ${fmt(job.departure)}.</p>`}</article>`;
 }).join('');
}
