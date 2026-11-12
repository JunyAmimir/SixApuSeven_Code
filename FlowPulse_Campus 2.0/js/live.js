/* Operational dashboards; legacy simulation is selectable. All live times are MYT. */
const live={connected:false,state:null,booking:null,mode:'live',role:null,user:null,refreshing:false};
window.flowpulseLive=live;
const el=id=>document.getElementById(id);
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const prettyTime=x=>new Date(x).toLocaleTimeString('en-MY',{timeZone:'Asia/Kuala_Lumpur',hour:'2-digit',minute:'2-digit',hour12:false});
const prettyDate=x=>new Date(x).toLocaleDateString('en-MY',{timeZone:'Asia/Kuala_Lumpur',weekday:'short',day:'numeric',month:'short'});
const stopName=s=>s==='L'?'Bukit Jalil LRT':'APU Campus';
const statusName=s=>({reserved:'Awaiting station check-in',checked_in:'Checked in — seat confirmed',missed:'Expired — check-in deadline missed',cancelled:'Cancelled',boarded:'Departure recorded',completed:'Scheduled journey complete'}[s]||s);
function liveMessage(message,bad=false){for(const id of ['appMessage','liveMessage']){el(id).textContent=message;el(id).style.color=bad?'var(--crit)':'var(--ok)';}}
async function liveCall(path,body){
 const r=await fetch('/api/'+path,{method:'POST',headers:{'Content-Type':'application/json','X-FlowPulse-Request':'1'},body:JSON.stringify(body)});
 const data=await r.json();if(!r.ok)throw Error(data.error||'Request failed');return data;
}
async function liveAction(path,body){try{const value=await liveCall(path,body);liveMessage(value.message||'Updated successfully');await liveRefresh(true);return value;}catch(err){liveMessage(err.message,true);return null;}}
function bookingStorageKey(name){return 'flowpulse.'+name+(live.user?.username?'.'+live.user.username:'');}
function savedBookings(){try{const x=JSON.parse(localStorage.getItem(bookingStorageKey('bookings'))||'[]');return Array.isArray(x)?x.filter(b=>typeof b.reservation_id==='string'&&typeof b.student_id==='string').slice(-20):[];}catch{return [];}}
function rememberBooking(booking){
 if(live.booking?.reservation_id!==booking.reservation_id)el('bookingQr').hidden=true;live.booking=booking;const saved=savedBookings().filter(x=>x.reservation_id!==booking.reservation_id);saved.push(booking);
 try{localStorage.setItem(bookingStorageKey('bookings'),JSON.stringify(saved.slice(-20)));localStorage.setItem(bookingStorageKey('activeBooking'),booking.reservation_id);}catch{liveMessage('Browser storage unavailable. Keep your private booking code.');}
 renderSavedBookings();renderBooking();
}
function renderSavedBookings(){
 const saved=savedBookings();el('savedBookings').innerHTML='<option value="">Choose a saved booking</option>'+saved.map((b,i)=>`<option value="${i}">${esc(b.student_id)} · ${esc(b.stop?stopName(b.stop):'Shuttle')} ${b.departs_at?prettyDate(b.departs_at)+' '+prettyTime(b.departs_at):''}</option>`).join('');
 const i=saved.findIndex(x=>x.reservation_id===live.booking?.reservation_id);el('savedBookings').value=i<0?'':String(i);
}
async function chooseSavedBooking(index){const b=savedBookings()[Number(index)];if(index===''||!b)return;el('liveStudentId').value=b.student_id;el('bookingQr').hidden=true;live.booking=b;await refreshBooking();}
async function refreshBooking(){if(!live.booking)return;const b=live.booking;try{const result=await liveCall('reservations/lookup',{student_id:b.student_id,reservation_id:b.reservation_id});if(live.booking?.reservation_id===b.reservation_id)rememberBooking(result);}catch(err){liveMessage(err.message,true);}}
async function recoverBooking(){try{rememberBooking(await liveCall('reservations/lookup',{student_id:el('liveStudentId').value.trim(),reservation_id:el('recoveryCode').value.trim()}));el('recoveryCode').value='';liveMessage('Booking recovered');drawLiveStudent();}catch(err){liveMessage(err.message,true);}}
async function bookLive(){
 const student=el('liveStudentId').value.trim(),departure_id=Number(el('liveDeparture').value);
 if(!student||!departure_id){liveMessage('Enter a student ID and select a departure',true);return;}
 const b=await liveAction('reserve',{student_id:student,departure_id});if(b){rememberBooking(b);drawLiveStudent();}
}
async function checkinLive(){liveMessage('Show your QR ticket or student card to staff at the station.');await showBookingTicket();}
async function cancelLive(){
 if(!live.booking){liveMessage('Select a booking first',true);return;}
 const r=await liveAction('cancel',{reservation_id:live.booking.reservation_id,student_id:live.booking.student_id});
 if(r){rememberBooking({...live.booking,status:r.status});el('bookingQr').hidden=true;drawLiveStudent();}
}
function renderBooking(){const b=live.booking;el('liveBooking').textContent=b?`${b.student_id}: ${statusName(b.status)}. Private booking code: ${b.reservation_id}`:'No reservation yet';}
async function showBookingTicket(){
 if(!live.booking){liveMessage('Reserve a seat or recover a booking first',true);return;}
 try{const r=await liveCall('ticket',{reservation_id:live.booking.reservation_id,student_id:live.booking.student_id});
  // SVG contains only server-generated QR modules, never user markup.
  el('bookingQr').innerHTML=r.svg;el('bookingQr').hidden=false;liveMessage('Keep this QR private. Show it to staff before the deadline.');
 }catch(err){liveMessage(err.message,true);}
}
function setDataMode(mode){
 live.mode=mode==='simulation'?'simulation':'live';document.body.classList.toggle('live-mode',live.mode==='live');el('dataMode').value=live.mode;el('officeSource').textContent=live.mode==='live'?'Shared live data':'Simulation / 6 regular buses';el('parkingSource').textContent=live.mode==='live'?'Shared recorded occupancy. Underground 700 bays, outdoor 500 bays.':'Simulated occupancy. Underground 700 bays, outside 500 bays.';
 if(live.mode==='simulation'){stopLaptopCamera();stopQrScanner();}draw();if(live.state)renderLive(live.state);
}
function parkingCards(lots){return lots.map(x=>`<article class="card"><h3>${esc(x.lot)}</h3><strong class="parking-count">${x.capacity-x.occupied}</strong> spaces free <p class="mut">${x.occupied}/${x.capacity} occupied · shared entry/exit records</p></article>`).join('');}
function drawLiveOffice(){
 const state=live.state;
 if(!state){el('overview').innerHTML='<p class="empty-state">Connecting to shared data… Start the Python server if this does not change.</p>';for(const id of ['stops','alerts','responses'])el(id).innerHTML='';return;}
 const fs=state.forecasts||[],first=['L','C'].map(s=>fs.find(x=>x.stop===s)).filter(Boolean),active=state.dispatches.filter(x=>['requested','accepted','arrived'].includes(x.status));
 el('overview').innerHTML=[['Estimated queue',first.reduce((n,x)=>n+x.demand,0),'Forecast for each stop’s next departure'],['Reserved seats',['L','C'].reduce((n,s)=>n+(state.departures.find(x=>x.stop===s)?.booked||0),0),'Next departures at both stops'],['Backup requests',active.length,'Requested, accepted or at stop']].map(x=>`<div class="summary-card"><span>${x[0]}</span><strong>${x[1]}</strong><small>${x[2]}</small></div>`).join('');
 el('stops').innerHTML=['L','C'].map(stop=>{
  const dep=state.departures.find(x=>x.stop===stop),f=fs.find(x=>x.departure_id===dep?.id),sensor=state.sensors.find(x=>x.stop===stop),request=active.find(x=>x.departure_id===dep?.id),over=f?Math.max(0,f.demand-f.capacity):0;
  return `<article class="card stop-card ${over?'congested':''}"><div class="row"><h2>${stopName(stop)}</h2><span class="status-label">${over?'Support suggested':'Monitor demand'}</span></div><div class="stop-count"><strong>${f?.demand??'—'}</strong><span>estimated queue at departure</span></div><div class="stop-facts"><div><span>Next departure</span><b>${dep?prettyDate(dep.departs_at)+' '+prettyTime(dep.departs_at):'None scheduled'}</b></div><div><span>Confirmed capacity</span><b>${dep?.capacity??0}</b></div><div><span>Reserved seats</span><b>${dep?.booked??0}</b></div><div><span>Forecast over capacity</span><b>${over}</b></div></div><p class="mut">${sensor?`Last observed: ${sensor.people} people, ${prettyTime(sensor.created_at)} · ${esc(sensor.source)}.`:'No observation yet.'} Confidence: ${esc(f?.confidence||'low')}. ${esc(f?.basis||'')}</p><button class="dispatch-button ${over?'pri':''}" ${!dep||live.role!=='staff'||request?'disabled':''} onclick="dispatchLive(${dep?.id||0},'live')">${request?'Backup '+esc(request.status):'Request backup from driver'}</button><small>Capacity counts after driver acceptance. ${live.role!=='staff'?'Staff login required.':''}</small></article>`;
 }).join('');
 el('alerts').innerHTML=first.some(x=>x.extra_buses)?'<div class="item warn">Forecast demand exceeds capacity. Review observations and request support if appropriate.</div>':'<div class="item ok">No forecast shortfall at the next departures. Estimates use the shared database.</div>';
 el('responses').innerHTML=renderDispatches(state.dispatches,false);el('parkO').innerHTML=parkingCards(state.parking);
}
window.drawLiveOffice=drawLiveOffice;
function drawLiveStudent(){
 if(live.mode!=='live')return;const b=live.booking;el('studentStatus').textContent=live.connected?'Shared live data · Kuala Lumpur time':'Waiting for backend';
 const intro='<div class="student-heading"><span class="eyebrow">YOUR SHUTTLE</span>';
 if(!b)el('busS').innerHTML=intro+'<h1>Reserve your next ride</h1><p>Choose a departure above. Bookings are saved on this device and recoverable using your private code.</p></div>';
 else{
  const terminal=['missed','cancelled','completed'].includes(b.status);
  el('busS').innerHTML=intro+`<h1>${esc(statusName(b.status))}</h1><p>${esc(b.student_id)} · ${stopName(b.stop)} to ${b.stop==='L'?'APU Campus':'Bukit Jalil LRT'}</p></div><div class="departure-card"><span>Scheduled departure</span><b>${b.departs_at?prettyTime(b.departs_at):'Loading'}</b><p>${b.departs_at?prettyDate(b.departs_at):''} · Check-in closes ${b.departs_at?prettyTime(new Date(new Date(b.departs_at)-5*60000)):''}</p></div><p>${terminal?'Choose another departure above to reserve a new ride.':b.status==='reserved'?'Show your QR ticket or student card to staff before the deadline.':b.status==='checked_in'?'Stay near the boarding area. Your seat is confirmed.':'Departure and arrival states follow the timetable; actual boarding/GPS is not independently verified.'}</p>${b.status==='reserved'?'<button class="pri big" onclick="showBookingTicket()">Show my QR ticket</button>':''}`;
 }if(live.state)el('parkS').innerHTML=parkingCards(live.state.parking);
}
window.drawLiveStudent=drawLiveStudent;
function renderDispatches(items,driver){
 if(!items.length)return '<p class="empty-state">No backup requests yet.</p>';
 return items.slice(0,12).map(x=>{
  const actions=driver?({requested:['accepted','declined'],accepted:['arrived'],arrived:['completed']}[x.status]||[]):[];
  return `<article class="response-card"><h3>${stopName(x.stop)} · ${prettyDate(x.departs_at)} ${prettyTime(x.departs_at)}</h3><p><strong>${esc(x.status)}</strong> · request ${esc(x.id.slice(0,8))}</p><p class="mut">${x.delivery_status==='in_app'?'Driver inbox available; no external delivery configured.':`External delivery: ${esc(x.delivery_status)} (${x.delivery_attempts} attempts).`} ${x.seats_applied?'75 backup seats assigned.':'No backup seats added yet.'}</p><div class="live-controls">${actions.map(a=>`<button onclick="respondDispatch('${x.id}','${a}')">${{accepted:'Accept — vehicle available',declined:'Decline',arrived:'Mark arrived at stop',completed:'Mark task complete'}[a]}</button>`).join('')}</div></article>`;
 }).join('');
}
function renderLive(state){
 notifyDriver(state);
 if(live.role==='staff'&&state.role!=='staff'){stopLaptopCamera();stopQrScanner();clearCameraReview();}live.role=state.role||null;el('accessStatus').textContent=live.role?`Signed in as ${live.role}`:'Student / visitor access';if(el('loginForm'))el('loginForm').hidden=!!live.role;el('logoutButton').hidden=!live.role;el('staffTools').hidden=live.role!=='staff';el('liveClock').textContent=prettyDate(state.server_time)+' '+prettyTime(state.server_time)+' MYT';
 if(!window.accountWorkspace){ el('reserveButton').disabled=false;const d=el('liveDeparture'),old=d.value,cutoff=new Date(state.server_time).getTime()+5*60000;
 d.innerHTML=state.departures.filter(x=>new Date(x.departs_at).getTime()>cutoff).map(x=>`<option value="${x.id}" ${x.capacity<=x.booked?'disabled':''}>${esc(stopName(x.stop))} · ${prettyDate(x.departs_at)} ${prettyTime(x.departs_at)} · ${Math.max(0,x.capacity-x.booked)} available</option>`).join('');if([...d.options].some(x=>x.value===old&&!x.disabled))d.value=old;
 }
 el('liveOfficeDepartures').innerHTML=state.departures.slice(0,8).map(x=>`<div class="live-line"><div><strong>${stopName(x.stop)} · ${prettyDate(x.departs_at)} ${prettyTime(x.departs_at)}</strong><small>${x.booked}/${x.capacity} seats reserved · ${x.extra} backups</small></div><button onclick="dispatchLive(${x.id},'demo')">Demo: add 75 seats</button></div>`).join('');
 el('liveSensors').innerHTML=['L','C'].map(s=>{const x=state.sensors.find(x=>x.stop===s);return `<div class="live-line"><div><strong>${stopName(s)}</strong><small>${x?`${x.people} detected · ${esc(x.source)} · ${prettyDate(x.created_at)} ${prettyTime(x.created_at)}`:'No reading yet'}</small></div></div>`;}).join('');
 const spaces=state.parking.map(x=>`${x.lot}: ${x.capacity-x.occupied}/${x.capacity} free`).join(' · ');el('liveParking').textContent=spaces;el('liveStudentParking').textContent=spaces;
 el('liveEvents').innerHTML=state.events.slice(0,8).map(x=>`<div class="live-line"><small>${prettyTime(x.created_at)} · ${esc(x.message)}</small></div>`).join('');
 el('cameraStatus').textContent=state.camera_configured?'Gemini configured on server':'Gemini needs a server API key; preview and manual counts remain available';
 el('liveRecommendations').innerHTML=renderForecastAdvice(state);
 const kiosk=el('kioskBooking'),chosen=kiosk.value;kiosk.innerHTML=state.reservations.filter(x=>['reserved','checked_in'].includes(x.status)).map(x=>`<option value="${esc(x.id)}">${esc(x.student_id)} · ${stopName(x.stop)} ${prettyTime(x.departs_at)}</option>`).join('');if([...kiosk.options].some(x=>x.value===chosen))kiosk.value=chosen;
 el('driverInbox').innerHTML=['staff','driver'].includes(live.role)?renderDispatches(state.dispatches,true):'<p class="empty-state">Sign in as Driver or Staff to receive requests.</p>';
 if(live.mode==='live'){drawLiveOffice();drawLiveStudent();}
}
let liveRefreshTask=null;
async function liveRefresh(force=false){
 if(liveRefreshTask){await liveRefreshTask;if(force)return liveRefresh();return;}
 liveRefreshTask=refreshLiveOnce();try{await liveRefreshTask;}finally{liveRefreshTask=null;}
}
async function refreshLiveOnce(){
 live.refreshing=true;
 try{const r=await fetch('/api/state',{cache:'no-store'});if(r.status===401&&window.handleSessionExpired)window.handleSessionExpired();if(!r.ok)throw Error('Backend unavailable');live.state=await r.json();live.connected=true;el('liveConnection').textContent='CONNECTED · SHARED DATABASE';renderLive(live.state);await refreshBooking();if(live.mode==='live')drawLiveStudent();}
 catch{live.connected=false;el('liveConnection').textContent='OFFLINE · start the Python server';el('reserveButton').disabled=true;el('liveClock').textContent='Backend offline';if(live.mode==='live')el('studentStatus').textContent='Backend offline — displayed data may be outdated';}finally{live.refreshing=false;}
}
async function loginLive(){const password=el('loginPassword').value;el('loginPassword').value='';const r=await liveAction('login',{role:el('loginRole').value,password});if(r)liveMessage(`Signed in as ${r.role}`);}
async function logoutLive(){stopLaptopCamera();stopQrScanner();clearCameraReview();await liveAction('logout',{});}
function dispatchLive(id,mode='live'){
 const dep=live.state?.departures.find(x=>x.id===id),f=live.state?.forecasts.find(x=>x.departure_id===id);
 if(mode==='live'&&dep&&typeof confirm==='function'&&!confirm(`Request one backup shuttle for ${stopName(dep.stop)} at ${prettyTime(dep.departs_at)}?\n${f?`Estimated demand: ${f.demand}; confirmed seats: ${dep.capacity}. `:''}The driver must accept before 75 seats are added.`))return Promise.resolve(null);
 return liveAction('dispatch',{departure_id:id,mode});
}
function respondDispatch(id,response){return liveAction('driver/respond',{dispatch_id:id,response});}
function sensorLive(){return liveAction('sensor',{stop:el('liveSensorStop').value,people:Number(el('livePeople').value),source:'manual'});}
function parkingLive(direction){return liveAction('parking',{lot:el('liveLot').value,direction});}
let driverAlerts=false,driverSeen=new Set();
async function enableDriverAlerts(){
 if(!['staff','driver'].includes(live.role)){liveMessage('Driver login required',true);return;}
 if(!('Notification' in window)){liveMessage('Desktop alerts are unavailable; keep the driver inbox open.');return;}
 try{driverAlerts=(await Notification.requestPermission())==='granted';liveMessage(driverAlerts?'Desktop alerts enabled while this page is open':'Alerts not enabled; keep the driver inbox open.');}catch{liveMessage('Alerts unavailable; keep the driver inbox open.');}
}
function notifyDriver(state){
 if(!['staff','driver'].includes(state.role)){driverSeen=new Set();return;}
 const waiting=(state.dispatches||[]).filter(x=>x.status==='requested');
 for(const x of waiting){if(!driverSeen.has(x.id)&&driverAlerts&&window.Notification?.permission==='granted'){
  try{new Notification('FlowPulse backup request',{body:`${stopName(x.stop)} · ${prettyTime(x.departs_at)}. Open the driver inbox to respond.`,tag:x.id});}catch{}
 }}driverSeen=new Set((state.dispatches||[]).map(x=>x.id));
}
async function importHistory(){const file=el('historyFile').files[0];if(!file||file.size>2*1024*1024){liveMessage('Choose a JSON history file up to 2 MB',true);return;}try{const r=await liveCall('history/import',{records:JSON.parse(await file.text())});liveMessage(`Imported ${r.inserted}; skipped ${r.skipped} duplicates`);await liveRefresh();}catch(err){liveMessage(err.message,true);}}
async function evaluateForecast(){el('forecastAccuracy').textContent='Checking historical predictions…';try{const r=await liveCall('forecast/evaluate',{});el('forecastAccuracy').textContent=`${r.samples} eligible targets · ${r.status==='available'?`Mean absolute error: ${r.mae} people; persistence baseline: ${r.persistence_mae}; RMSE: ${r.rmse}; bias: ${r.bias}.`:'More time-separated observations needed.'} Sources: ${JSON.stringify(r.sources)}. ${r.note}`;}catch(err){el('forecastAccuracy').textContent=err.message;}}
window.addEventListener('DOMContentLoaded',()=>{
 if(typeof initializePortal==='function'){initializePortal();return;}
 renderSavedBookings();try{const id=localStorage.getItem('flowpulse.activeBooking');live.booking=savedBookings().find(x=>x.reservation_id===id)||null;if(live.booking)el('liveStudentId').value=live.booking.student_id;}catch{}
 el('cameraFile').addEventListener('change',clearCameraReview);el('liveSensorStop').addEventListener('change',clearCameraReview);setDataMode(location.protocol==='file:'?'simulation':'live');liveRefresh();setInterval(liveRefresh,4000);
});


function renderForecastAdvice(state){
 const labels={pending:'Backup in progress',closed:'Request window closed',needs_data:'More data needed',review:'Review backup support',monitor:'Monitor closely',within_capacity:'Within capacity'};
 return (state.forecasts||[]).slice(0,8).map(f=>{
  const a=(state.dispatch_advice||[]).find(x=>x.departure_id===f.departure_id),known=f.evidence&&f.evidence!=='none';
  return `<article class="live-line"><div><strong>${esc(stopName(f.stop))} · ${prettyTime(f.departs_at)} · ${esc(labels[a?.status]||'Review estimate')}</strong><p>${known?`${f.demand} ${f.demand===1?'person':'people'} estimated · ${f.capacity} confirmed seats · ${f.reserved_floor} reserved`:'Awaiting queue observations and reservations'}</p><small>${esc(a?.reason||f.basis)} ${a?.suggested_buses?`Suggested support: ${a.suggested_buses} bus(es), one request at a time.`:''}</small><small>${f.evidence==='observations'?`Planning band: ${f.planning_low}–${f.planning_high} people. `:''}${esc(f.range_note||'')} ${esc(f.confidence)} confidence · ${f.historical_days} matching historical days · ${f.recent_readings||0} recent readings.</small><small>${esc(f.basis)}. Sources: ${esc((f.sources||[]).join(', ')||'reservations only / no observations')}.${f.demo_data?' Includes demonstration data; not evidence of real accuracy.':''}</small>${live.role==='staff'&&a?.can_request&&a.status==='review'?`<button onclick="dispatchLive(${f.departure_id},'live')">Review and request one backup</button>`:''}</div></article>`;
 }).join('')||'<p class="empty-state">No upcoming departures.</p>';
}
