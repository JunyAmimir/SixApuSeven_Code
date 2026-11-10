/* FlowPulse Campus - student.js
   Student view: live bus location, big on-queue / pending numbers, join buttons and parking. */

/* ---- student bus card ---- */
function qr(){let c='';for(let i=0;i<11;i++)for(let j=0;j<11;j++){const f=(i<3&&j<3)||(i<3&&j>7)||(i>7&&j<3);if(f||rnd(i+MYN,j+5)>.5)c+=`<rect x="${j*10}" y="${i*10}" width="10" height="10"/>`}return `<svg viewBox="0 0 110 110" style="width:130px;background:#fff;padding:8px;border-radius:8px" fill="#0F172A" role="img" aria-label="Your QR code">${c}</svg>`}
function stopBlock(s){
 const me=SIM.me,mine=me&&!me.done&&me.stop===s,busy=me&&!me.done,riding=me&&me.done==='boarded'&&t<me.tb+TRIP,nd=nextDep(),qn=Q(s).length,pn=P(s).length;
 let h=`<div class="state ${mine?(me.st==='p'?'warn':'ok'):'info'}"><div class="row"><b style="font-size:20px">${SN[s]}</b><span class="mut">Next bus ${fmt(nd)} (Bus #${busOf(s,nd)+1})</span></div>
 <div class="tiles"><div class="tile"><b style="color:var(--${sq(qn)})">${qn}</b><span>On queue</span></div><div class="tile"><b style="color:var(--acc)">${pn}</b><span>Pending</span></div></div>`;
 if(mine&&me.st==='p')h+=`<p>Your ID is <b>${MYID}</b>. You have no seat yet. Show this QR code or tap your NFC tag at the kiosk in the bus waiting area. Your request expires in ${Math.max(0,EXP-(t-me.tj))} min.</p><div style="text-align:center">${qr()}</div><button class="pri big" onclick="scanMe()">Demo: scan at kiosk</button><p><button onclick="cancelMe()">Cancel request</button></p>`;
 else if(mine){const qd=Q(s),pos=qd.indexOf(me)+1,full=pos>CAP*(SIM.extra[s]?2:1);h+=`<p><b>You are on queue</b></p><div style="font-size:44px;font-weight:800;color:var(--${full?'crit':'ok'})">#${pos}</div>${full?'<p>The next bus will be full. You will wait for the following bus and get first place on it.</p>':`<p>You are on the ${fmt(nd)} bus.${me.carried?' You have first priority because the last bus was full.':''}</p>`}<button onclick="cancelMe()">Leave queue</button>`}
 else h+=`<button class="pri big" ${busy||riding?'disabled':''} onclick="joinMe('${s}')">Join queue at ${SN[s]}</button>${busy?'<small>You are already in a queue at the other stop.</small>':riding?'<small>You are on a bus right now.</small>':''}`;
 return h+'</div>'}
function busStudent(){
 const me=SIM.me;let hl=null,top=SP(DAYI)?`<div class="state warn"><b>Heavy demand 12:00 to 18:00 today.</b> Join the queue early.</div>`:'';
 if(me&&!me.done){const s=me.stop,qd=Q(s);let nd=nextDep();if(me.st==='q'&&qd.indexOf(me)+1>CAP*(SIM.extra[s]?2:1))nd+=HW;const nb=busOf(s,nd);hl=nb;
  top+=`<div class="state info"><b>Live location: Bus #${nb+1}</b><p>${busLine(nb)}</p><p>It leaves ${SN[s]} at ${fmt(nd)}.</p></div>`}
 else if(me&&me.done==='boarded'&&t<me.tb+TRIP){hl=me.bus-1;top+=`<div class="state ok"><b>You are on Bus #${me.bus}</b><p>Heading to ${me.stop==='L'?'the school campus':'the LRT station'}. Arriving at ${fmt(me.tb+TRIP)}.</p></div>`}
 else{if(me&&me.done==='boarded')top+=`<div class="state ok"><b>You arrived at ${me.stop==='L'?'the school campus':'the LRT station'}.</b><p>Thanks for riding Bus #${me.bus}.</p></div>`;
  if(me&&me.done==='expired')top+=`<div class="state crit"><p>Your request expired because no kiosk scan was received. Join again and scan within ${EXP} minutes.</p></div>`}
 return mapHTML(hl)+top+stopBlock('L')+stopBlock('C')}

function drawStudent(){
 $('#busS').innerHTML=busStudent();
 $('#parkS').innerHTML=parkHTML(false)}
