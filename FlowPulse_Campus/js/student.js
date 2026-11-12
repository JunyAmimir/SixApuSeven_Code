/* Student journey: choose a stop, check in, wait, then ride. */
function selectStudentStop(s){if(!['L','C'].includes(s)||SIM.me&&!SIM.me.done)return;SIM.selectedStop=s;drawStudent()}
function journeySteps(stage){return '<ol class="journey-steps">'+['Choose stop','Check in','Your ride'].map((label,i)=>`<li class="${i<=stage?'current':''}" ${i===stage?'aria-current="step"':''}><span>${i+1}</span>${label}</li>`).join('')+'</ol>'}
function destination(s){return s==='L'?'School campus':'LRT station'}
function studentChoice(){
 const selected=SIM.selectedStop,open=t<END;
 return journeySteps(0)+`<div class="student-heading"><span class="eyebrow">PLAN YOUR RIDE</span><h1>Where are you leaving from?</h1><p>Choose your starting point to join the shuttle queue.</p></div>`+(!open?'<div class="item warn">Service has ended for today. Please arrange alternative transport.</div>':'')+'<div class="station-choices">'+['L','C'].map(s=>`<button class="station-choice ${selected===s?'selected':''}" aria-pressed="${selected===s}" onclick="selectStudentStop('${s}')"><span class="station-icon">${s==='L'?'L':'C'}</span><span><b>${SN[s]}</b><small>To ${destination(s)}</small><small>${Q(s).length} waiting${open?' / next departure '+fmt(nextDep()):' / service closed'}</small></span><span aria-hidden="true">${selected===s?'Selected':'Choose'}</span></button>`).join('')+`</div><button class="pri big" ${!selected||!open?'disabled':''} onclick="joinMe(SIM.selectedStop)">${!open?'Service closed':selected?'Join queue from '+SN[selected]:'Choose a stop above'}</button><p class="mut">Joining creates a request. Check in at the station to receive your queue position.</p>`;
}
function studentRequest(me){
 const checked=me.st==='q',pos=checked?Q(me.stop).indexOf(me)+1:null,e=checked?estimate(me.stop,pos):null;
 let h=journeySteps(1)+`<div class="student-heading"><span class="eyebrow">${SN[me.stop]} TO ${destination(me.stop)}</span><h1>${checked?'Your place in the queue':'Check in when you arrive'}</h1><p>${checked?'Stay near the boarding area. Your queue order is preserved.':'Your request is ready. Check in at the station to confirm you are here.'}</p></div>`;
 if(!checked)h+=`<div class="ticket-card"><span>Student ID</span><strong>${MYID}</strong><p>Check in within <b>${Math.max(0,EXP-(t-me.tj))} simulated minutes</b>. You do not have a queue position yet.</p></div><button class="pri big" onclick="scanMe()">Demo: check in at kiosk</button><p class="mut">This button simulates a station scan. No real QR or NFC reader is connected.</p>`;
 else h+=`<div class="queue-ticket"><div><span>Your position</span><strong>#${pos}</strong></div><div><span>Estimated wait</span><strong>${e?e.wait+'<small> min</small>':'--'}</strong></div></div><div class="departure-card"><span>Estimated departure</span><b>${e?fmt(e.time):'No seat projected today'}</b><p>${e?(e.backup?'Backup shuttle':'Bus #'+e.bus)+' to '+destination(me.stop):'Please contact campus transport for an alternative.'}</p></div>${e&&e.time>nextDep()?'<div class="item warn">The next departure will fill before your turn. Your estimate includes the later departure you can fit on.</div>':''}<p class="mut">Based on the current queue and scheduled buses. This is an estimate, not a seat reservation.</p>`;
 if(SIM.extra[me.stop])h+=`<div class="item info"><b>A backup is coming to your stop</b><p>${backupStatus(me.stop)}</p></div>`;
 return h+`<button class="quiet-button" onclick="cancelMe()">${checked?'Leave queue':'Cancel request'}</button>`;
}
function studentRide(me){
 const arrived=t>=me.tb+TRIP,label=me.backup?'Backup shuttle':'Bus #'+me.bus;
 return journeySteps(2)+`<div class="student-heading"><span class="eyebrow">${arrived?'JOURNEY COMPLETE':'ON YOUR WAY'}</span><h1>${arrived?'You have arrived':'You are on board'}</h1><p>${arrived?'Welcome to '+destination(me.stop)+'.':'Heading to '+destination(me.stop)+'.'}</p></div><div class="ride-card"><span>${label}</span><strong>${arrived?destination(me.stop):fmt(me.tb+TRIP)}</strong><p>${arrived?'Thanks for riding with FlowPulse.':'Estimated arrival / departed at '+fmt(me.tb)}</p></div>${arrived?'<button class="pri big" onclick="cancelMe()">Plan another ride</button>':'<p class="mut">Your boarding is confirmed. The simulated journey takes 20 minutes.</p>'}`;
}
function busStudent(){
 const me=SIM.me;let h,hl=null;
 if(me&&!me.done){h=studentRequest(me);if(me.st==='q'){const e=estimate(me.stop,Q(me.stop).indexOf(me)+1);if(e&&!e.backup)hl=e.bus-1;}}
 else if(me&&me.done==='boarded'){h=studentRide(me);if(!me.backup)hl=me.bus-1;}
 else h=(me&&me.done==='expired'?'<div class="item warn" role="status">Your request expired before check-in. Choose a stop to try again.</div>':'')+studentChoice();
 return h+'<details class="route-details"><summary>View shuttle route and simulated locations</summary>'+mapHTML(hl)+'</details>';
}
function drawStudent(){
 if(globalThis.flowpulseLive?.mode==='live'){globalThis.drawLiveStudent();return;}
 const open=$('#busS .route-details')?.open;
 $('#busS').innerHTML=busStudent();if(open)$('#busS .route-details').open=true;
 $('#parkS').innerHTML=parkHTML(false);
 $('#studentStatus').textContent=`Simulation / ${fmt(t)} / ${playing?'Running':'Paused - press Play in the top bar'}`;
}
