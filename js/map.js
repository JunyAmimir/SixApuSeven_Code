/* FlowPulse Campus - map.js
   Live bus rotation map (SVG). Buses circle clockwise between the LRT station and the campus. */

/* ---- live bus map: a loop, buses rotate clockwise ---- */
const EL=(dir,u)=>{const th=dir==='LC'?Math.PI*(1-u):-Math.PI*u;return[300+190*Math.cos(th),140-85*Math.sin(th)]};
const sq=n=>n<60?'ok':n<=CAP?'warn':'crit';
function busG(l,x,y,hl,dim,bk){return `<g transform="translate(${x.toFixed(1)},${y.toFixed(1)})" opacity="${dim?.45:1}"><rect x="-15" y="-10" width="30" height="20" rx="5" fill="${bk?'var(--warn)':'var(--acc)'}" stroke="${hl?'var(--tx)':'var(--bg)'}" stroke-width="${hl?4:2}"/><text y="4" fill="#0F172A" font-size="11" font-weight="700" text-anchor="middle">${l}</text>${hl?'<text y="-16" fill="var(--warn)" font-size="11" font-weight="700" text-anchor="middle">Your bus</text>':''}</g>`}
function mapHTML(hl){
 const sts=[0,1,2,3,4,5].map(busState),dm=b=>hl!==null&&hl!==b;
 let h='<svg class="map" viewBox="0 0 600 280" role="img" aria-label="Live bus rotation map"><ellipse cx="300" cy="140" rx="190" ry="85" fill="none" stroke="var(--line)" stroke-width="12"/><ellipse cx="300" cy="140" rx="190" ry="85" fill="none" stroke="var(--mut)" stroke-width="1.5" stroke-dasharray="3 9"/>';
 h+='<text x="300" y="134" fill="var(--tx)" font-size="13" font-weight="700" text-anchor="middle">6 buses in rotation</text><text x="300" y="152" fill="var(--mut)" font-size="11" text-anchor="middle">Clockwise. A bus leaves each stop every 10 min.</text>';
 [['L',4],['C',504]].forEach(([s,x])=>{const a=Q(s).length,p=P(s).length,c=x+46;
  h+=`<rect x="${x}" y="88" width="92" height="104" rx="8" fill="var(--panel)" stroke="var(--${sq(a)})" stroke-width="2"/><text x="${c}" y="106" fill="var(--tx)" font-size="11" font-weight="700" text-anchor="middle">${SN[s]}</text><text x="${c}" y="134" fill="var(--${sq(a)})" font-size="24" font-weight="700" text-anchor="middle">${a}</text><text x="${c}" y="147" fill="var(--mut)" font-size="10" text-anchor="middle">on queue</text><text x="${c}" y="164" fill="var(--tx)" font-size="12" font-weight="700" text-anchor="middle">${p} pending</text>`;
  if(SIM.extra[s])h+=busG('Backup',c,180,false,false,true).replace('x="-15"','x="-24"').replace('width="30"','width="48"')});
 sts.forEach(s=>{const x=s.mode==='move'?EL(s.dir,s.u):s.at==='L'?[110,140]:[490,140];h+=busG('#'+(s.b+1),x[0],x[1],hl===s.b,dm(s.b))});
 SIM.bk.forEach(k=>{const u=(t-k.d)/TRIP;if(u>=0&&u<1){const dir=k.s==='L'?'LC':'CL',x=EL(dir,u);h+=busG('B',x[0],x[1]+(dir==='LC'?-20:20),false,hl!==null,true)}});
 return h+'</svg><div class="blines">'+sts.map(s=>`<div${hl===s.b?' style="color:var(--warn);font-weight:600"':''}>${busLine(s.b)}</div>`).join('')+'</div>'}
