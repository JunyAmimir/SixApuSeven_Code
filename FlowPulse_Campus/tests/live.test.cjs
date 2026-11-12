const assert=require('node:assert/strict');
const fs=require('node:fs');const path=require('node:path');const vm=require('node:vm');
const root=path.join(__dirname,'..');
function fixture(storage=new Map()){
 const nodes=new Map(),events={},timers=new Map(),calls=[];let timerId=0,stopped=0;
 function element(id){if(nodes.has(id))return nodes.get(id);const e={value:'',textContent:'',hidden:false,disabled:false,style:{},options:[],files:[],srcObject:null,videoWidth:640,videoHeight:480,play:async()=>{},addEventListener(){},classList:{toggle(){},contains(){return false;}},attributes:{},setAttribute(k,v){this.attributes[k]=v;},open:false,showModal(){this.open=true;},close(){this.open=false;},focus(){},scrollIntoView(){},getContext:()=>({drawImage(){}}),toDataURL:()=> 'data:image/jpeg;base64,dGVzdA=='};
  Object.defineProperty(e,'innerHTML',{get(){return this.html||'';},set(value){this.html=value;if(id==='liveDeparture'||id==='kioskBooking'||id==='savedBookings'){this.options=[...value.matchAll(/<option value="([^"]*)"([^>]*)>/g)].map(x=>({value:x[1],disabled:x[2].includes('disabled')}));this.value=this.options.find(x=>!x.disabled)?.value||'';}}});nodes.set(id,e);return e;}
 const departure={id:1,stop:'L',departs_at:'2026-11-13T08:00:00+08:00',capacity:75,booked:0,extra:0};
 const state={server_time:'2026-11-13T07:30:00+08:00',departures:[departure],sensors:[],parking:[{lot:'Outdoor',capacity:500,occupied:0}],events:[],reservations:[],forecasts:[{departure_id:1,stop:'L',demand:0,capacity:75,extra_buses:0,confidence:'low',basis:'Booking floor'}],dispatches:[],role:'staff',camera_configured:true};
 const bookings=new Map();
 const context={console,URL,Date,JSON,Promise,Set,Map,Error,Number,String,Math,location:{protocol:'http:',hash:'#office'},
  document:{querySelectorAll:()=>[],getElementById:element,createElement:()=>element('canvas'),body:{classList:{toggle(){},contains(){return false;}}},addEventListener:(n,fn)=>events['document:'+n]=fn},
  localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},navigator:{mediaDevices:{getUserMedia:async()=>({getTracks:()=>[{stop(){stopped++;}}]})}},
  setInterval:(fn,ms)=>{const id=++timerId;timers.set(id,{fn,ms,interval:true});return id;},clearInterval:id=>timers.delete(id),
  setTimeout:(fn,ms)=>{const id=++timerId;timers.set(id,{fn,ms,interval:false});return id;},clearTimeout:id=>timers.delete(id),draw(){},
  addEventListener:(name,fn)=>events[name]=fn,
  fetch:async(url,options)=>{const body=options?JSON.parse(options.body):null;calls.push({url,body});let data=state,ok=true;
   if(url==='/api/reserve'){data={reservation_id:'private-test-code',student_id:body.student_id,stop:'L',departs_at:departure.departs_at,status:'reserved'};bookings.set(data.reservation_id,data);departure.booked=1;}
   if(url==='/api/reservations/lookup'){data=bookings.get(body.reservation_id)||{error:'Not found'};ok=!data.error;}
   if(url==='/api/camera/analyze')data={people:42,confidence:'medium',notes:'Test count'};
   if(url==='/api/sensor')data={people:body.people};
   if(url==='/api/checkin'){data={status:'checked_in'};}
   return {ok,json:async()=>structuredClone(data)};
  }};
 context.window=context;vm.createContext(context);
 for(const file of ['live.js','devices.js'])vm.runInContext(fs.readFileSync(path.join(root,'js',file),'utf8'),context,{filename:file});
 vm.runInContext('live.state='+JSON.stringify(state)+';live.role="staff";',context);
 element('liveSensorStop').value='L';element('liveStudentId').value='TP100001';element('liveDeparture').value='1';
 return {context,element,calls,state,bookings,storage,timers,events,get stopped(){return stopped;},run:code=>vm.runInContext(code,context)};
}
let count=0;
async function check(name,fn){await fn();console.log('PASS '+name);count++;}
if(require.main===module)(async()=>{
 await check('booking persists and is restored after page reload',async()=>{
  const f=fixture();await f.run('bookLive()');assert.equal(JSON.parse(f.storage.get('flowpulse.bookings'))[0].student_id,'TP100001');assert.match(f.element('liveBooking').textContent,/private-test-code/);
  const reload=fixture(f.storage);reload.bookings.set('private-test-code',f.bookings.get('private-test-code'));reload.events.DOMContentLoaded();await reload.run('liveRefresh(true)');assert.equal(reload.element('liveStudentId').value,'TP100001');assert.match(reload.element('busS').innerHTML,/Awaiting station/);
 });
 await check('main stop cards use backend forecasts and accepted capacity',async()=>{
  const f=fixture();f.run('live.state.forecasts[0].demand=161;live.state.departures[0].capacity=150;drawLiveOffice()');assert.match(f.element('stops').innerHTML,/161/);assert.match(f.element('stops').innerHTML,/150/);assert.doesNotMatch(f.element('stops').innerHTML,/SIM\./);
 });
 await check('camera preview sends no images until explicit analysis',async()=>{
  const f=fixture();await f.run('startLaptopCamera()');assert.equal(f.element('cameraVideo').hidden,false);assert.equal(f.calls.length,0);f.run('stopLaptopCamera()');assert.equal(f.stopped,1);assert.equal(f.element('cameraVideo').srcObject,null);
 });
 await check('camera counting needs review and cannot auto-save',async()=>{
  const f=fixture();await f.run('startLaptopCamera();');await f.run('captureLaptop()');assert.equal(f.calls.filter(x=>x.url==='/api/camera/analyze').length,1);assert.equal(f.calls.filter(x=>x.url==='/api/sensor').length,0);assert.equal(f.element('cameraSave').disabled,false);
  await f.run('captureLaptop()');assert.equal(f.calls.filter(x=>x.url==='/api/camera/analyze').length,1);
  await f.run('saveCamera()');assert.equal(f.calls.filter(x=>x.url==='/api/sensor').length,1);assert.equal(f.element('cameraSave').disabled,true);
 });
 await check('periodic capture stops its timer and camera tracks',async()=>{
  const f=fixture();await f.run('startLaptopCamera()');f.run('toggleAutoCamera()');assert.equal([...f.timers.values()].filter(x=>x.ms===30000).length,1);f.run('stopLaptopCamera()');assert.equal([...f.timers.values()].filter(x=>x.ms===30000).length,0);assert.equal(f.stopped,1);
 });
 await check('late camera response cannot save a count for a changed stop',async()=>{
  const f=fixture();let resolve;
  f.context.fetch=()=>new Promise(r=>{resolve=r;});
  const pending=f.run('analyzeFrame("test","image/jpeg")');f.run('clearCameraReview()');resolve({ok:true,json:async()=>({people:99,confidence:'low',notes:'late'})});await pending;assert.equal(f.element('cameraSave').disabled,true);
 });
 await check('missing Gemini key leaves manual counts and preview available',async()=>{
  const f=fixture();f.run('live.state.camera_configured=false');await f.run('startLaptopCamera()');await f.run('captureLaptop()');assert.equal(f.calls.length,0);assert.match(f.element('cameraResult').textContent,/GEMINI_API_KEY/);f.run('stopLaptopCamera()');
 });
 await check('late camera permission is released after timeout',async()=>{
  const f=fixture();let resolve,lateStopped=0;f.context.navigator.mediaDevices.getUserMedia=()=>new Promise(r=>resolve=r);
  const result=f.run('startLaptopCamera()');const timeout=[...f.timers.values()].find(x=>x.ms===15000);timeout.fn();await result;
  resolve({getTracks:()=>[{stop(){lateStopped++;}}]});await Promise.resolve();assert.equal(lateStopped,1);assert.equal(f.element('cameraVideo').hidden,true);
 });
 await check('ticket QR payload submits to station check-in',async()=>{
  const f=fixture();await f.run('submitScan(JSON.stringify({type:"flowpulse",reservation_id:"private-test-code",student_id:"TP100001"}))');assert.equal(f.calls.find(x=>x.url==='/api/checkin').body.student_id,'TP100001');assert.match(f.element('scanStatus').textContent,/Checked in/);
 });
 await check('unsupported QR camera has a keyboard-reader fallback',async()=>{
  const f=fixture();await f.run('startQrScanner()');assert.match(f.element('scanStatus').textContent,/USB barcode reader/);
 });
 console.log(`${count} live workflow checks passed.`);
})().catch(error=>{console.error(error);process.exitCode=1;});

module.exports={fixture};
