/* FlowPulse Campus - office.js
   Office dashboard: stop panels, big alerts with the backup-bus action, weekly report and CSV. */

/* ---- office panels ---- */
function stopPanel(s){
 const queue=Q(s),nd=nextDep(),open=t<END,cap=open?capacityAt(s,nd):0,overflow=Math.max(0,queue.length-cap),backup=SIM.extra[s];
 const tail=queue.length?estimate(s,queue.length):null;
 return `<article class="card stop-card ${overflow?'congested':''}"><div class="row"><h2>${SN[s]}</h2><span class="status-label">${!open?'Service closed':overflow?'Support needed':'Within capacity'}</span></div><div class="stop-count"><strong>${queue.length}</strong><span>students waiting</span></div><div class="stop-facts"><div><span>Next departure</span><b>${open?fmt(nd):'None today'}</b></div><div><span>Scheduled seats</span><b>${cap}</b></div><div><span>Cannot fit next departure</span><b>${overflow}</b></div><div><span>Awaiting check-in</span><b>${P(s).length}</b></div></div><p class="mut">${queue.length?tail?'Estimated wait at end of queue: '+tail.wait+' min.':'Some students have no projected seat before service closes.':'No confirmed students waiting.'}</p>${backup?`<div class="dispatch-status"><b>Backup dispatched</b><p>${backupStatus(s)}</p></div>`:`<button class="${overflow?'pri':''} dispatch-button" ${t+BACKUP_TRAVEL>END?'disabled':''} onclick="dispatchBackup('${s}')">Dispatch backup to ${s==='L'?'LRT':'campus'}</button>`}<small>Each regular or backup bus has 75 seats.</small></article>`;
}
function alertsHTML(){
 if(t>=END)return '<div class="item warn">Service closed. No further departures today; remaining students need alternative transport.</div>';
 const crowded=['L','C'].filter(s=>Q(s).length>capacityAt(s,nextDep()));
 if(!crowded.length)return '<div class="item ok"><p>Both queues fit their next scheduled departure. Continue monitoring.</p></div>';
 return '<div class="item warn"><p><b>Attention needed:</b> '+crowded.map(s=>`${SN[s]} has ${Math.max(0,Q(s).length-capacityAt(s,nextDep()))} students beyond the next departure capacity${SIM.extra[s]?'; a backup has been scheduled':''}`).join('. ')+'. Queue order is preserved for later buses.</p></div>';
}

/* ---- weekly report (from the two simulated weeks) ---- */
function buildReport(){
 $('#rep').value='';$('#repmsg').textContent='';
 const w=+$('#wk').value,s=$('#ws').value,cw=Math.floor(DAYI/5)+1,o=(w-1)*5;
 $('#wk').innerHTML=[1,2].map(x=>`<option value="${x}"${x===w?' selected':''}>Week ${x} (${x===cw?'selected simulation week':x<cw?'reference week':'reference scenario'})</option>`).join('');
 const days=[0,1,2,3,4];
 let rows=`<div class="tblw"><table class="tbl"><tr><th>Day</th><th>Requests</th><th>Boarded</th><th>No-shows</th><th>Peak queue</th><th>Backup buses</th>${w===2?'<th>Vs reference week</th>':''}</tr>`;
 [0,1,2,3,4].forEach(i=>{const d=o+i;
  const q=sum(d,s,'req'),mq=Math.max(...HIST[d][s].map(c=>c.mq)),mh=H[HIST[d][s].findIndex(c=>c.mq===mq)],ch=w===2?`<td>${(q/sum(d-5,s,'req')*100-100>=0?'+':'')+Math.round(q/sum(d-5,s,'req')*100-100)}%</td>`:'';
  rows+=`<tr><td>${DAYS[i]}${SP(d)?' (long peak)':''}</td><td>${q}</td><td>${sum(d,s,'brd')}</td><td>${sum(d,s,'ns')}</td><td>${mq} at ${fmt(mh*60)}</td><td>${sum(d,s,'bk')}</td>${ch}</tr>`});
 $('#wsum').innerHTML=rows+'</table></div>';
 let g='<div></div>'+H.map(x=>`<div class="${PK.some(p=>p[0]===x)?'pk':''}">${x}</div>`).join('');
 [0,1,2,3,4].forEach(i=>{const d=o+i;g+=`<div>${DAYS[i]}</div>`+H.map((_,k)=>{const v=HIST[d][s][k].req;return `<div title="${DAYS[i]} ${fmt(H[k]*60)}: ${v} requests" style="background:rgba(var(--hot),${(.06+.94*v/GMX).toFixed(2)});color:${v/GMX>.5?'#fff':'inherit'}">${v/GMX>.55?v:''}</div>`}).join('')});
 $('#grid').innerHTML=g;
 const ds=days.map(i=>o+i),avg=H.map((_,k)=>ds.reduce((a,d)=>a+HIST[d][s][k].req,0)/ds.length),cap=6*CAP,L=a=>a.map(x=>fmt(x*60)).join(', ');
 const top=H.map((x,k)=>({x,v:avg[k]})).sort((a,b)=>b.v-a.v).slice(0,7).map(c=>c.x).sort((a,b)=>a-b),over=H.filter((_,k)=>avg[k]>cap);
 const req=ds.reduce((a,d)=>a+sum(d,s,'req'),0),brd=ds.reduce((a,d)=>a+sum(d,s,'brd'),0),bk=ds.reduce((a,d)=>a+sum(d,s,'bk'),0);
 let ih=`<div class="item crit"><p><b>Peak hours at ${SN[s]}:</b> ${L(top)}.</p></div><div class="item warn"><p><b>Over bus capacity</b> (average above ${cap} requests per hour): ${over.length?L(over):'none'}.</p><p>${req} students asked for a seat, ${brd} boarded, and ${bk} backup shuttle buses were sent.</p></div>`;
 if(w===2&&ds.includes(7)&&ds.includes(8)){const win=d=>HIST[d][s].slice(6,12).reduce((a,c)=>a+c.req,0),a=win(7)+win(8),b=win(2)+win(3);
  ih+=`<div class="item info"><p><b>Week 2 Wednesday and Thursday:</b> a continuous peak ran from 12:00 to 18:00 with ${a} requests in that window, ${Math.round(a/b*100-100)}% more than reference week's Wednesday and Thursday.</p></div>`}
 else if(w===2&&(ds.includes(7)||ds.includes(8)))ih+=`<div class="item info"><p>Week 2 Wednesday and Thursday have a continuous peak from 12:00 to 18:00.</p></div>`;
 $('#ins').innerHTML=ih}
function report(){const w=+$('#wk').value,o=(w-1)*5;
 let r='data_source,policy,stop,week,day,hour,requests,boarded,max_queue,no_shows,backup_buses\n';
 ['L','C'].forEach(s=>[0,1,2,3,4].forEach(i=>{const d=o+i;HIST[d][s].forEach((c,k)=>r+=`PRESET_SIMULATION,AUTO_BACKUP,${SN[s]},${w},${DAYS[i]},${fmt(H[k]*60)},${c.req},${c.brd},${c.mq},${c.ns},${c.bk}\n`)}));
 $('#rep').value=r;$('#repmsg').textContent='  Preset simulation report built (not live activity).'}
function copyRep(){const a=$('#rep');if(!a.value)report();a.select();try{navigator.clipboard.writeText(a.value).then(()=>$('#repmsg').textContent='  Copied. Paste it into a spreadsheet.',()=>document.execCommand('copy'))}catch(e){document.execCommand('copy')}}

function drawOffice(){
 $('#overview').innerHTML=operationsHTML();
 $('#guide').innerHTML=guideHTML();
 $('#responses').innerHTML=responsesHTML();
 $('#map').innerHTML=mapHTML(null);
 $('#stops').innerHTML=stopPanel('L')+stopPanel('C');
 $('#alerts').innerHTML=alertsHTML();
 $('#deps').innerHTML=SIM.dep.map(d=>`<div>${fmt(d.t)} ${SN[d.s]}: Bus #${d.bus}${d.ex?' + backup':''} left with ${d.n}/${d.cap}.${d.left?' '+d.left+' carried over.':''}</div>`).join('')||'<div class="mut">No departures yet.</div>';
 $('#scans').innerHTML=SIM.scans.slice().reverse().map(s=>`<div>${fmt(s.t)} ${s.s==='L'?'LRT':'Campus'} kiosk ${s.k}: ${s.id} scanned ${s.q}</div>`).join('')||'<div class="mut">No scans yet.</div>';
 $('#parkO').innerHTML=parkHTML(true)}

