/* FlowPulse Campus - office.js
   Office dashboard: stop panels, big alerts with the backup-bus action, weekly report and CSV. */

/* ---- office panels ---- */
function stopPanel(s){
 const qd=Q(s),pd=P(s),ex=SIM.extra[s],cap=CAP*(ex?2:1),take=Math.min(qd.length,cap),over=Math.max(0,qd.length-cap),nd=nextDep(),carry=qd.filter(x=>x.carried).length;
 const K=(v,l,c)=>`<div class="mk"><b style="color:${c}">${v}</b><small>${l}</small></div>`;
 return `<div class="card"><h2>${SN[s]}</h2><div class="mks">${K(qd.length,'On queue',`var(--${sq(qd.length)})`)}${K(pd.length,'Pending','var(--acc)')}${K(fmt(nd),'Next, bus #'+(busOf(s,nd)+1),'var(--tx)')}${over?K('+'+over,'Miss next bus','var(--crit)'):K(cap-take,'Seats left','var(--ok)')}</div>
 <div class="seats">${Array.from({length:cap},(_,i)=>`<i style="background:${i<take?'var(--acc)':'var(--line)'}"></i>`).join('')}</div>
 <div class="row"><small>${take} of ${cap} seats taken. ${carry} on queue have first priority.</small>${ex?'<span class="pill">Backup bus sent</span>':`<button onclick="SIM.extra.${s}=1;draw()">Send backup shuttle bus</button>`}</div>
 <div class="lg" style="margin-top:8px"><div><b>On queue</b><ol>${qd.slice(0,5).map((x,i)=>`<li><span>#${i+1} ${x.id}</span>${x.carried?'<span class="pill">Priority</span>':''}</li>`).join('')||'<li class="mut">Nobody yet</li>'}</ol></div><div><b>Pending</b><ol>${pd.slice(0,5).map(x=>`<li><span>${x.id}</span><span class="mut">${t-x.tj} min</span></li>`).join('')||'<li class="mut">Nobody yet</li>'}</ol></div></div></div>`}
function alertsHTML(){let al=SP(DAYI)?`<div class="item info"><p><b>${dname(DAYI)}:</b> peak demand runs from 12:00 to 18:00. Expect long queues all afternoon.</p></div>`:'';
 ['L','C'].forEach(s=>{const n=Q(s).length,cap=CAP*(SIM.extra[s]?2:1),nd=nextDep();
  if(n>2*CAP&&!SIM.extra[s])al+=`<div class="abig" role="alert"><div><h3>${SN[s]}: ${n} students on queue</h3><p>That is more than 2 buses (${2*CAP} seats). The 6 buses in rotation cannot clear it. Send the backup shuttle bus now.</p></div><button onclick="SIM.extra.${s}=1;draw()">Send backup shuttle bus</button></div>`;
  else if(SIM.extra[s])al+=`<div class="abig ok"><div><h3>Backup shuttle bus sent to ${SN[s]}</h3><p>It leaves at ${fmt(nd)} together with the regular bus and carries up to ${cap} students.</p></div></div>`;
  else if(n>CAP)al+=`<div class="item warn"><p><b>${SN[s]}:</b> ${n-CAP} students will miss the ${fmt(nd)} bus. They go first on the next one.</p></div>`;
  const pd=P(s).length;if(pd>=60)al+=`<div class="item warn"><p><b>${SN[s]}:</b> ${pd} students have not scanned yet. They hold no seat until they scan at a kiosk.</p></div>`});
 return al.includes('abig')||al.includes('warn')?al:al+'<div class="abig ok calm"><div><h3>No alerts. Both queues fit the next bus.</h3></div></div>'}

/* ---- weekly report (from the two simulated weeks) ---- */
function buildReport(){
 const w=+$('#wk').value,s=$('#ws').value,cw=Math.floor(DAYI/5)+1,o=(w-1)*5;
 $('#wk').innerHTML=[1,2].map(x=>`<option value="${x}"${x===w?' selected':''}>Week ${x} (${x===cw?'this week, up to today':x<cw?'last week':'not started'})</option>`).join('');
 const days=[0,1,2,3,4].filter(i=>o+i<=DAYI);
 let rows=`<div class="tblw"><table class="tbl"><tr><th>Day</th><th>Requests</th><th>Boarded</th><th>No-shows</th><th>Peak queue</th><th>Backup buses</th>${w===2?'<th>Vs last week</th>':''}</tr>`;
 [0,1,2,3,4].forEach(i=>{const d=o+i;if(d>DAYI){rows+=`<tr class="mut"><td>${DAYS[i]}</td><td colspan="${w===2?6:5}">Not yet</td></tr>`;return}
  const q=sum(d,s,'req'),mq=Math.max(...HIST[d][s].map(c=>c.mq)),mh=H[HIST[d][s].findIndex(c=>c.mq===mq)],ch=w===2?`<td>${(q/sum(d-5,s,'req')*100-100>=0?'+':'')+Math.round(q/sum(d-5,s,'req')*100-100)}%</td>`:'';
  rows+=`<tr><td>${DAYS[i]}${SP(d)?' (long peak)':''}</td><td>${q}</td><td>${sum(d,s,'brd')}</td><td>${sum(d,s,'ns')}</td><td>${mq} at ${fmt(mh*60)}</td><td>${sum(d,s,'bk')}</td>${ch}</tr>`});
 $('#wsum').innerHTML=rows+'</table></div>';
 let g='<div></div>'+H.map(x=>`<div class="${PK.some(p=>p[0]===x)?'pk':''}">${x}</div>`).join('');
 [0,1,2,3,4].forEach(i=>{const d=o+i;g+=`<div>${DAYS[i]}</div>`+H.map((_,k)=>{if(d>DAYI)return'<div></div>';const v=HIST[d][s][k].req;return `<div title="${DAYS[i]} ${fmt(H[k]*60)}: ${v} requests" style="background:rgba(var(--hot),${(.06+.94*v/GMX).toFixed(2)});color:${v/GMX>.5?'#fff':'inherit'}">${v/GMX>.55?v:''}</div>`}).join('')});
 $('#grid').innerHTML=g;
 if(!days.length){$('#ins').innerHTML='<div class="item info"><p>This week has not started yet.</p></div>';return}
 const ds=days.map(i=>o+i),avg=H.map((_,k)=>ds.reduce((a,d)=>a+HIST[d][s][k].req,0)/ds.length),cap=6*CAP,L=a=>a.map(x=>fmt(x*60)).join(', ');
 const top=H.map((x,k)=>({x,v:avg[k]})).sort((a,b)=>b.v-a.v).slice(0,7).map(c=>c.x).sort((a,b)=>a-b),over=H.filter((_,k)=>avg[k]>cap);
 const req=ds.reduce((a,d)=>a+sum(d,s,'req'),0),brd=ds.reduce((a,d)=>a+sum(d,s,'brd'),0),bk=ds.reduce((a,d)=>a+sum(d,s,'bk'),0);
 let ih=`<div class="item crit"><p><b>Peak hours at ${SN[s]}:</b> ${L(top)}.</p></div><div class="item warn"><p><b>Over bus capacity</b> (average above ${cap} requests per hour): ${over.length?L(over):'none'}.</p><p>${req} students asked for a seat, ${brd} boarded, and ${bk} backup shuttle buses were sent.</p></div>`;
 if(w===2&&ds.includes(7)&&ds.includes(8)){const win=d=>HIST[d][s].slice(6,12).reduce((a,c)=>a+c.req,0),a=win(7)+win(8),b=win(2)+win(3);
  ih+=`<div class="item info"><p><b>Week 2 Wednesday and Thursday:</b> a continuous peak ran from 12:00 to 18:00 with ${a} requests in that window, ${Math.round(a/b*100-100)}% more than last week's Wednesday and Thursday.</p></div>`}
 else if(w===2&&(ds.includes(7)||ds.includes(8)))ih+=`<div class="item info"><p>Week 2 Wednesday and Thursday have a continuous peak from 12:00 to 18:00.</p></div>`;
 $('#ins').innerHTML=ih}
function report(){const w=+$('#wk').value,o=(w-1)*5;
 let r='stop,week,day,hour,requests,boarded,max_queue,no_shows,backup_buses\n';
 ['L','C'].forEach(s=>[0,1,2,3,4].forEach(i=>{const d=o+i;if(d<=DAYI)HIST[d][s].forEach((c,k)=>r+=`${SN[s]},${w},${DAYS[i]},${fmt(H[k]*60)},${c.req},${c.brd},${c.mq},${c.ns},${c.bk}\n`)}));
 $('#rep').value=r;$('#repmsg').textContent='  Week '+w+' report built.'}
function copyRep(){const a=$('#rep');if(!a.value)report();a.select();try{navigator.clipboard.writeText(a.value).then(()=>$('#repmsg').textContent='  Copied. Paste it into a spreadsheet.',()=>document.execCommand('copy'))}catch(e){document.execCommand('copy')}}

function drawOffice(){
 $('#map').innerHTML=mapHTML(null);
 $('#stops').innerHTML=stopPanel('L')+stopPanel('C');
 $('#alerts').innerHTML=alertsHTML();
 $('#deps').innerHTML=SIM.dep.map(d=>`<div>${fmt(d.t)} ${SN[d.s]}: Bus #${d.bus}${d.ex?' + backup':''} left with ${d.n}/${d.cap}.${d.left?' '+d.left+' carried over.':''}</div>`).join('')||'<div class="mut">No departures yet.</div>';
 $('#scans').innerHTML=SIM.scans.slice().reverse().map(s=>`<div>${fmt(s.t)} ${s.s==='L'?'LRT':'Campus'} kiosk ${s.k}: ${s.id} scanned ${s.q}</div>`).join('')||'<div class="mut">No scans yet.</div>';
 $('#parkO').innerHTML=parkHTML(true)}
