/* FlowPulse Campus - parking.js
   Parking bay model (underground 700, outside 500) and the lot cards used by both views. */

/* ---- parking model ---- */
const LOTS=[{id:'U',n:'Underground parking',cap:700,pk:.9,s:400,w:170,dep:1020},{id:'O',n:'Outside parking',cap:500,pk:.98,s:390,w:120,dep:990}];
const DF=[1,1,.95,1,.85];
function occ(L,m){const k=DF[DAYI%5],dp=L.dep+(SP(DAYI)?70:0),j=1+.02*Math.sin(m/7+L.cap);return Math.round(cl(L.cap*(.06+(L.pk*k-.06)*(sm((m-L.s)/L.w)-.93*sm((m-dp)/150)))*j,0,L.cap))}
const free=(L,m)=>L.cap-occ(L,m);
const lstat=(L,m)=>{const f=free(L,m)/L.cap;return f<.1?'crit':f<.25?'warn':'ok'};
function parkHTML(office){
 return '<div class="twoeq">'+LOTS.map(L=>{const f=free(L,t),c=closed[L.id],s=c?'crit':lstat(L,t),tr=free(L,t+10)-f;
 const strip=H.map(h=>{const p=occ(L,h*60+30)/L.cap;return `<i title="${fmt(h*60)}: ${Math.round(p*100)}% full" style="background:rgba(var(--hot),${(.1+.9*p).toFixed(2)});${h===Math.floor(t/60)?'outline:2px solid var(--acc)':''}"></i>`}).join('');
 return `<div class="lot ${s}${office?'':' sv'}"><div class="row"><b class="nm">${L.n}</b><span class="mut">${c?'Closed':tr<-5?'Filling up':tr>5?'Emptying':'Steady'}</span></div>
 <div style="margin-top:8px"><b class="n" style="color:var(--${s})">${c?0:f}</b> <span class="mut of">of ${L.cap} bays free</span></div>
 <div class="bar"><span style="width:${c?100:(1-f/L.cap)*100}%;background:var(--${s})"></span></div>
 <div class="strip">${strip}</div><small>Occupancy by hour, 06:00 to 22:00 (current hour outlined)</small>
 <div style="margin-top:10px">${office?`<button onclick="closed.${L.id}=!closed.${L.id};draw()">${c?'Reopen this lot':'Mark as closed'}</button>`:`<small>${c?'Closed by the campus office.':f<40?'Almost full. Try the other lot.':'Spaces available.'}</small>`}</div></div>`}).join('')+'</div><small>Updated by bay sensors at '+fmt(t)+'.</small>'}
