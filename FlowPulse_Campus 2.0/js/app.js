/* FlowPulse Campus - app.js
   Wires the page together: clock, day rollover, view switching and the 1 second tick. Loaded last. */

function draw(){
 $('#clk').textContent=fmt(t);$('#sl').value=t;
 drawOffice();drawStudent();drawDemoProgress();if(typeof drawExperience==='function')drawExperience()}

function setPlaying(value){playing=value;$('#play').textContent=playing?'Pause':'Play'}
function resumeTraffic(){
 if(t>=END){resetDemo();}
 SIM.demo=false;setPlaying(true);draw();
 note('Normal simulation resumed: new students will arrive and the clock is running. Existing dispatch outcomes are kept until reset.');
}
function loadDemo(){
 setPlaying(false);closed={};reset(5);SIM.now=t=471;SIM.demo=true;
 for(let i=0;i<160;i++)SIM.q.push({id:'TP'+String(100000+i),stop:'L',st:'q',tj:t-5,ts:t-1+i/1000,carried:false});
 joinMe('L');scanMe();SIM.me.ts=t-1+99.5/1000;
 SIM.demoBaseline=estimate('L',101).time;SIM.demoStudent=SIM.me;$('#day').value=DAYI;$('#spd').value='1';buildReport();view('office');draw();
 note('Demo paused at 07:51: 161 students waiting; you are #101. Dispatch a backup, then advance through arrival and departure. Background arrivals are frozen for repeatable results.');
}
function resetDemo(){setPlaying(false);closed={};reset(5);simTo(450);$('#day').value=DAYI;$('#spd').value='1';buildReport();draw();note('Simulation reset to 07:30 and paused. Queue, trip and parking overrides cleared.');}
function advanceDemo(){
 const wasPlaying=playing;
 if(t>=END){
  if(SIM.me&&SIM.me.done==='boarded'&&t<SIM.me.tb+TRIP){simTo(SIM.me.tb+TRIP);draw();return}
  note('Service has ended. Reset to start a new demo.');return;
 }
 const events=[nextDep(),END];
 if(SIM.immersive)Object.values(SIM.disruptions).forEach(d=>{if(d.delayTo>t)events.push(d.delayTo);if(d.closedUntil>t)events.push(d.closedUntil);});
 Object.values(SIM.extra).forEach(b=>{if(b&&b.arrival>t)events.push(b.arrival);if(b&&b.departure>t)events.push(b.departure)});
 if(SIM.me&&SIM.me.done==='boarded'&&SIM.me.tb+TRIP>t)events.push(SIM.me.tb+TRIP);
 simTo(Math.min(...events));setPlaying(wasPlaying);draw();
}
function drawDemoProgress(){
 const el=$('#demoProgress');
 if(SIM.immersive){el.textContent=`Campus experience · ${playing?'Running':'Paused'} · ${SIM.arrivals} new ride requests · ${SIM.checkins} check-ins · ${SIM.boarded} boarded. Simulated activity, separate from live records.`;return}
 if(!SIM.demo){el.textContent=`Normal simulation / ${playing?'Running - new students arrive over time.':'Paused - press Play to run the clock and generate arrivals.'} Rewinding time or changing day clears the active trip.`;return}
 const me=SIM.me,e=me&&!me.done&&me.st==='q'?estimate(me.stop,Q(me.stop).indexOf(me)+1):null;
 const actual=me===SIM.demoStudent?(me&&me.done==='boarded'?me.tb:e?e.time:null):null;
 el.textContent=`Controlled scenario · LRT queue: ${Q('L').length} · Without backup: departure ${fmt(SIM.demoBaseline)}${actual!==null?' · '+(me.done==='boarded'?'Boarded':'Estimated departure')+': '+fmt(actual)+' · '+Math.max(0,SIM.demoBaseline-actual)+' simulated minutes saved for this student':''}. This comparison applies only to the fixed demo scenario.`;
}

/* ---- wiring: the simulation runs on from one day to the next ---- */
function note(m){$('#note').textContent=m;clearTimeout(nt);nt=setTimeout(()=>$('#note').textContent='',9000)}
function nextDay(){const o=DAYI,d=(o+1)%NDAYS;
 note(`${dname(o)} ended. ${o%5===4?'There is no bus service at the weekend. ':''}${d===0?'The two-week simulation restarts at Week 1 Monday.':'Continuing on '+dname(d)+'.'}`);
 reset(d);$('#day').value=d;buildReport()}
function toggle(){setPlaying(!playing);draw()}
function view(v){document.body.classList.toggle('sv',v==='student');document.body.classList.toggle('dv',v==='driver');$('#nO').classList.toggle('on',v==='office');$('#nS').classList.toggle('on',v==='student');if($('#nD'))$('#nD').classList.toggle('on',v==='driver');if(location.hash!=='#'+v)location.hash='#'+v;if(globalThis.onFlowViewChange)globalThis.onFlowViewChange(v)}
addEventListener('hashchange',()=>view(location.hash==='#driver'?'driver':location.hash==='#student'?'student':'office'));
$('#day').innerHTML=Array.from({length:NDAYS},(_,d)=>`<option value="${d}">${dname(d)}</option>`).join('');$('#day').value=DAYI;
$('#sl').oninput=e=>{setPlaying(false);if(+e.target.value<SIM.now)note('Time rewound: queue and active journey reset.');simTo(+e.target.value);draw()};
$('#day').onchange=e=>{setPlaying(false);const x=t;reset(+e.target.value);simTo(Math.max(x,START));buildReport();draw();note('Day changed: queue and active journey reset.');};
$('#ws').onchange=buildReport;$('#wk').onchange=buildReport;
function tick(){if(!playing)return;for(let i=0;i<+$('#spd').value;i++){const finish=SIM.me&&SIM.me.done==='boarded'?Math.max(END,SIM.me.tb+TRIP):END;if(SIM.now>=finish){setPlaying(false);note('Service closed. Reset or choose another day to continue.');break}step()}draw()}
reset(5);simTo(450);setPlaying(false);$('#wk').innerHTML='<option value="1">Week 1</option>';buildReport();view(location.hash==='#driver'?'driver':location.hash==='#student'?'student':'office');draw();setInterval(tick,1000);

