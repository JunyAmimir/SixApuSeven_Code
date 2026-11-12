/* FlowPulse Campus - config.js
   Constants, small helpers and the shared global state. Loaded first. */

const $=s=>document.querySelector(s);
const cl=(x,a=0,b=1)=>Math.min(b,Math.max(a,x));
const sm=x=>{x=cl(x);return x*x*(3-2*x)};
const gs=(x,m,s)=>Math.exp(-((x-m)**2)/(2*s*s));
const fmt=m=>{m=Math.round(m);return String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0')};
const rnd=(a,b)=>{const x=Math.sin(a*97.3+b*13.7)*10000;return x-Math.floor(x)};
function rng(s){let a=s>>>0;return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
const DAYS=['Mon','Tue','Wed','Thu','Fri'],DM=[1,1,.95,1,.9],NDAYS=10;
const CAP=75,HW=10,TRIP=20,START=360,END=1320,EXP=20;
const SN={L:'LRT station',C:'School campus'};
const SP=d=>d===7||d===8; // Week 2 Wednesday and Thursday: continuous peak 12:00 to 18:00
const dname=d=>`Week ${Math.floor(d/5)+1} ${DAYS[d%5]}`;
const H=[];for(let h=6;h<=22;h++)H.push(h);
const MYID='TP'+String(Math.floor(Math.random()*1e6)).padStart(6,'0'),MYN=+MYID.slice(2)%997;
let DAYI=5,t=START-1,SIM,R,playing=true,closed={},REC=null,AUTO=false,nt;

