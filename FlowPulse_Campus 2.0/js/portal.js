/* Authenticated entrypoint. Server permissions are authoritative. */
const portal={user:null,poll:null,redirecting:false,driverFilter:'active',studentPlanning:false,menuKey:null};
window.accountWorkspace=true;
const portalHome=role=>({staff:'/staff',driver:'/driver',student:'/student'}[role]||'/login.html');
const portalView=role=>({staff:'office',driver:'driver',student:'student'}[role]);
const portalLabels={staff:'APU Staff',driver:'Bus Driver',student:'Student'};
function clearPortal(){
 if(portal.poll)clearInterval(portal.poll);portal.poll=null;stopLaptopCamera();stopQrScanner();clearCameraReview();
 live.booking=null;live.user=null;live.role=null;live.state=null;portal.user=null;document.body.classList.add('auth-pending');
 el('bookingQr').innerHTML='';el('liveBooking').textContent='';el('kioskBooking').innerHTML='';el('bookingRoster').innerHTML='';
}
window.handleSessionExpired=function(){if(portal.redirecting)return;portal.redirecting=true;clearPortal();window.location.replace('/login.html');};
function syncAccountBookings(state){
 if(portal.user?.role!=='student')return;
 const rows=(state.reservations||[]).filter(x=>x.student_id===portal.user.student_id).map(x=>({...x,reservation_id:x.id||x.reservation_id}));
 try{localStorage.setItem(bookingStorageKey('bookings'),JSON.stringify(rows.slice(0,20)));}catch{}
 const active=live.booking?.reservation_id||(()=>{try{return localStorage.getItem(bookingStorageKey('activeBooking'));}catch{return null;}})();
 const selected=rows.find(x=>x.reservation_id===active)||(!live.booking&&!portal.studentPlanning?rows.find(x=>['reserved','checked_in'].includes(x.status)):null);
 if(selected){live.booking=selected;try{localStorage.setItem(bookingStorageKey('activeBooking'),selected.reservation_id);}catch{}}
 else if(live.booking&&!rows.some(x=>x.reservation_id===live.booking.reservation_id))live.booking=null;
 renderSavedBookings();renderBooking();
}
async function initializePortal(){
 if(portal.poll)clearInterval(portal.poll);portal.poll=null;
 try{
  const response=await fetch('/api/session',{cache:'no-store'});if(!response.ok)throw Error();const data=await response.json();
  if(!data.user){window.handleSessionExpired();return;}
  portal.user=data.user;live.user=data.user;live.role=data.user.role;portal.studentPlanning=false;
  document.body.classList.remove('role-staff','role-driver','role-student','sv','dv');
  document.body.classList.add('role-mode','role-'+data.user.role);
  el('liveStudentId').value=data.user.student_id||'';el('liveStudentId').readOnly=true;
  renderRoleMenu();setDataMode('live');view(portalView(data.user.role));
  document.querySelectorAll('.brand,.mobile-brand').forEach(link=>{
   link.href=portalHome(data.user.role);link.onclick=event=>{event.preventDefault();view(portalView(portal.user.role));window.scrollTo({top:0,behavior:motionBehavior()});};
  });
  await liveRefresh(true);if(portal.redirecting)return;
  document.body.classList.remove('auth-pending');document.body.classList.add('portal-ready');
  if(typeof requestAnimationFrame==='function')requestAnimationFrame(()=>window.scrollTo(0,0));
  portal.poll=setInterval(()=>liveRefresh(),4000);
 }catch{el('portalBootMessage').textContent='FlowPulse could not connect. Make sure the server is running, then refresh this page.';}
}
const originalPortalView=view;
view=function(requested){
 if(!portal.user)return;
 const allowed=portalView(portal.user.role),demoStudent=portal.user.role==='staff'&&live.mode==='simulation'&&['student','driver'].includes(requested);
 const resolved=requested===allowed||demoStudent?requested:allowed;
 if(typeof history!=='undefined'&&history.replaceState){
  const anchor=location.hash==='#mainContent'?'#mainContent':'';
  history.replaceState(null,'',portalHome(portal.user.role)+'#'+resolved);
  originalPortalView(resolved);
  history.replaceState(null,'',portalHome(portal.user.role)+anchor);
 }else originalPortalView(resolved);
};
openAccess=function(){if(!portal.user){window.location.replace('/login.html');return;}if(!el('accessDialog').open)el('accessDialog').showModal();};
logoutLive=async function(){
 const button=el('logoutButton');button.disabled=true;
 try{await liveCall('logout',{});clearPortal();window.location.replace('/login.html');}
 catch{button.disabled=false;liveMessage('Could not sign out. Check your connection and try again.',true);}
};
const originalPortalWorkspace=setWorkspace;
setWorkspace=function(name){if(portal.user?.role!=='staff')return;originalPortalWorkspace(name);renderRoleMenu();};
const originalPortalMode=setDataMode;
setDataMode=function(mode){const previous=live.mode;const allowed=portal.user?.role==='staff'?mode:'live';originalPortalMode(allowed);if(portal.user&&allowed==='live')view(portalView(portal.user.role));if(allowed==='simulation'&&previous!=='simulation'&&typeof startExperience==='function'){if(SIM.immersive){setPlaying(true);draw();}else startExperience();}renderRoleMenu();};
function selectStaffWorkspace(name){if(live.mode==='simulation'){view('office');setWorkspace('overview');draw();return;}view('office');setWorkspace(name);}
function openMyBookings(){const details=el('savedBookings').closest('details');details.open=true;details.scrollIntoView({behavior:motionBehavior(),block:'center'});el('savedBookings').focus({preventScroll:true});}
function renderRoleMenu(){
 const user=portal.user;if(!user)return;el('roleMenuCaption').textContent=portalLabels[user.role].toUpperCase();
 const demo=user.role==='staff'&&live.mode==='simulation';
 const menus=demo?[['grid','Demo operations',"selectStaffWorkspace('overview')",!document.body.classList.contains('sv')&&!document.body.classList.contains('dv')],['ticket','Demo student ride',"view('student');renderRoleMenu()",document.body.classList.contains('sv')],['bus','Demo driver hub',"view('driver');renderRoleMenu()",document.body.classList.contains('dv')],['arrow','Return to live',"setDataMode('live')",false]]:user.role==='staff'?
  [['grid','Overview',"selectStaffWorkspace('overview')",studio.workspace==='overview'],['calendar','Departures',"selectStaffWorkspace('departures')",studio.workspace==='departures'],['activity','Observations',"selectStaffWorkspace('observations')",studio.workspace==='observations'],['ticket','Check-in',"selectStaffWorkspace('checkin')",studio.workspace==='checkin'],['users','Insights',"selectStaffWorkspace('insights')",studio.workspace==='insights']]:
  user.role==='driver'?[['bus','Active requests',"filterDriverRequests('active')",portal.driverFilter==='active'],['clock','Request history',"filterDriverRequests('history')",portal.driverFilter==='history']]:
  [['ticket','My rides',"view('student')",true],['calendar','My bookings','openMyBookings()',false]];
 const key=user.role+'|'+studio.workspace+'|'+portal.driverFilter+'|'+live.mode+'|'+document.body.classList.contains('sv')+'|'+document.body.classList.contains('dv');
 if(portal.menuKey!==key){el('roleMenu').innerHTML=menus.map(x=>`<button aria-label="${x[1]}" ${x[3]?'aria-current="page"':''} class="${x[3]?'on':''}" onclick="${x[2]}"><span>${icon(x[0])}</span><span>${x[1]}</span></button>`).join('');portal.menuKey=key;}
 el('sidebarAccountName').textContent=user.display_name;el('sidebarAccountUsername').textContent=user.username;
}
function filterDriverRequests(filter){portal.driverFilter=filter==='history'?'history':'active';el('driverInbox').innerHTML=renderDispatches(live.state?.dispatches||[],true);renderRoleMenu();}
const originalPortalDispatches=renderDispatches;
renderDispatches=function(items,driver){if(driver&&portal.user?.role==='driver'){items=items.filter(x=>portal.driverFilter==='active'?['requested','accepted','arrived'].includes(x.status):!['requested','accepted','arrived'].includes(x.status));if(!items.length&&portal.driverFilter==='history')return '<div class="empty-state">'+icon('clock')+'<strong>No request history yet.</strong><p>Completed and declined requests will appear here.</p></div>';}return originalPortalDispatches(items,driver);};
const originalPortalRender=renderLive;
renderLive=function(state){
 if(!state.user||state.user.username!==portal.user?.username){window.handleSessionExpired();return;}
 live.user=state.user;portal.user=state.user;syncAccountBookings(state);originalPortalRender(state);
 const user=portal.user;el('roleBadge').textContent=portalLabels[user.role];el('roleAvatar').textContent={staff:'AS',driver:'BD',student:'ST'}[user.role];
 el('accessStatus').textContent=portalLabels[user.role]+' workspace';el('profileAccountName').textContent=user.display_name;el('profileUsername').textContent=user.username;el('profileStudentId').textContent=user.student_id?'Student ID · '+user.student_id:'';
 el('liveStudentId').value=user.student_id||'';el('liveStudentId').readOnly=true;renderRoleMenu();
 if(user.role==='student')drawLiveStudent();
};
const originalPortalPlan=planAnotherRide;
planAnotherRide=function(){portal.studentPlanning=true;originalPortalPlan();};
const originalPortalChoose=chooseSavedBooking;
chooseSavedBooking=async function(index){portal.studentPlanning=false;await originalPortalChoose(index);};
const originalPortalBook=bookLive;
bookLive=async function(){
 if(window.bookingRequestPending)return;window.bookingRequestPending=true;
 const button=el('reserveButton');button.disabled=true;button.setAttribute('aria-busy','true');button.innerHTML=icon('refresh')+'Reserving your seat…';
 try{await originalPortalBook();if(live.booking)portal.studentPlanning=false;}
 finally{window.bookingRequestPending=false;button.setAttribute('aria-busy','false');renderStudentDepartures();}
};
window.addEventListener('pagehide',()=>{document.body.classList.add('auth-pending');if(portal.poll)clearInterval(portal.poll);portal.poll=null;});
window.addEventListener('pageshow',event=>{if(event.persisted){document.body.classList.add('auth-pending');initializePortal();}});
