/* FlowPulse Campus - mockData.js
   Demand model: how many students ask for a bus each minute, per stop and day.
   To use real sensor data later, replace lam() with a lookup into your own feed. */

// usual peak hour, extra students joining per minute on top of about 2.8 per minute (20 to 30 per bus) at the LRT station, at the school campus
const PK=[[8,15,2.5],[10,7,4],[12,4,12],[13,10,4],[15,4,7],[16,3,13],[18,3,16]];
const lam=(s,d,m)=>{let v=2.8;PK.forEach(p=>{if(!(SP(d)&&p[0]>=12))v+=p[s==='L'?1:2]*gs(m,p[0]*60+15,12)});if(SP(d))v+=8*(sm((m-705)/30)-sm((m-1065)/30));return v*DM[d%5]};
