/* FlowPulse Campus - app.js
   Wires the page together: clock, day rollover, view switching and the 1 second tick. Loaded last. */

function draw(){
 $('#clk').textContent=fmt(t);$('#sl').value=t;
 drawOffice();drawStudent()}

/* ---- wiring: the simulation runs on from one day to the next ---- */
function note(m){$('#note').textContent=m;clearTimeout(nt);nt=setTimeout(()=>$('#note').textContent='',9000)}
function nextDay(){const o=DAYI,d=(o+1)%NDAYS;
 note(`${dname(o)} ended. ${o%5===4?'There is no bus service at the weekend. ':''}${d===0?'The two-week simulation restarts at Week 1 Monday.':'Continuing on '+dname(d)+'.'}`);
 reset(d);$('#day').value=d;buildReport()}
function toggle(){playing=!playing;$('#play').textContent=playing?'Pause':'Play'}
function view(v){document.body.classList.toggle('sv',v==='student');$('#nO').classList.toggle('on',v!=='student');$('#nS').classList.toggle('on',v==='student');if(location.hash!=='#'+v)location.hash=v}
addEventListener('hashchange',()=>view(location.hash==='#student'?'student':'office'));
$('#day').innerHTML=Array.from({length:NDAYS},(_,d)=>`<option value="${d}">${dname(d)}</option>`).join('');$('#day').value=DAYI;
$('#sl').oninput=e=>{simTo(+e.target.value);draw()};
$('#day').onchange=e=>{const x=t;reset(+e.target.value);simTo(Math.max(x,START));buildReport();draw()};
$('#ws').onchange=buildReport;$('#wk').onchange=buildReport;
function tick(){if(!playing)return;for(let i=0;i<+$('#spd').value;i++){if(SIM.now>=END)nextDay();step()}draw()}
reset(5);simTo(450);$('#wk').innerHTML='<option value="1">Week 1</option>';buildReport();view(location.hash==='#student'?'student':'office');draw();setInterval(tick,1000);
