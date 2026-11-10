/* FlowPulse Campus - history.js
   Simulates all 10 weekdays once (Week 1 and Week 2) so the weekly report has data.
   Uses AUTO mode: the office answers every alert by sending a backup bus. */

/* ---- two weeks of history: every day is simulated once, the office answers every alert ---- */
const HIST=[];let GMX=1;
(function(){AUTO=true;for(let d=0;d<NDAYS;d++){reset(d);REC=HIST[d]={L:H.map(()=>({req:0,brd:0,mq:0,ns:0,bk:0})),C:H.map(()=>({req:0,brd:0,mq:0,ns:0,bk:0}))};while(SIM.now<END)step()}REC=null;AUTO=false;
 HIST.forEach(h=>['L','C'].forEach(s=>h[s].forEach(c=>GMX=Math.max(GMX,c.req))))})();

// total of one stat (req, brd, ns, bk) for a day and stop
const sum=(d,s,k)=>HIST[d][s].reduce((a,c)=>a+c[k],0);
