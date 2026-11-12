const {fixture}=require('./live.test.cjs');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
function setup(){
 const f=fixture(),classes=new Set(),views=[],redirects=[];
 f.context.document.body.classList={add:(...xs)=>xs.forEach(x=>classes.add(x)),remove:(...xs)=>xs.forEach(x=>classes.delete(x)),contains:x=>classes.has(x),toggle:(x,on)=>{if(on??!classes.has(x))classes.add(x);else classes.delete(x);}};
 f.context.view=x=>views.push(x);f.context.location.replace=x=>redirects.push(x);
 for(const file of ['studio.js','portal.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../js',file),'utf8'),f.context);
 f.run('portal.user={role:"student",username:"student",student_id:"TP123456",display_name:"Student"};live.user=portal.user;live.role="student";live.connected=true');
 return {...f,classes,views,redirects};
}
let count=0;function check(name,fn){fn();count++;console.log('PASS '+name);}
check('booking storage is isolated by the signed-in username',()=>{
 const f=setup();f.storage.set('flowpulse.bookings',JSON.stringify([{reservation_id:'legacy-other',student_id:'TP999999'}]));assert.equal(f.run('savedBookings().length'),0);
 f.run('rememberBooking({reservation_id:"own",student_id:"TP123456",stop:"L",departs_at:"2026-11-13T08:00:00+08:00",status:"reserved"})');
 assert.match(f.storage.get('flowpulse.bookings.student'),/"own"/);assert.match(f.storage.get('flowpulse.bookings'),/legacy-other/);
});
check('only the student account’s bookings are restored',()=>{
 const f=setup();f.run('syncAccountBookings({reservations:[{id:"own",student_id:"TP123456",stop:"L",departs_at:"2026-11-13T08:00:00+08:00",status:"reserved"},{id:"foreign",student_id:"TP999999",status:"reserved"}]})');
 assert.equal(f.run('live.booking.reservation_id'),'own');assert.doesNotMatch(f.storage.get('flowpulse.bookings.student'),/foreign/);
});
check('background sync does not undo a choice to plan another ride',()=>{
 const f=setup();f.run('live.state.reservations=[{id:"own",student_id:"TP123456",stop:"L",departs_at:"2026-11-13T08:00:00+08:00",status:"reserved"}];syncAccountBookings(live.state);planAnotherRide();syncAccountBookings(live.state)');
 assert.equal(f.run('live.booking'),null);assert.equal(JSON.parse(f.storage.get('flowpulse.bookings.student')).length,1);
});
check('navigation cannot open a different live account workspace',()=>{
 const f=setup();f.run('view("office")');assert.equal(f.views.at(-1),'student');
 f.run('portal.user={role:"driver",username:"bus.driver"};view("office")');assert.equal(f.views.at(-1),'driver');
 f.run('portal.user={role:"staff",username:"apu.staff"};live.mode="live";view("student")');assert.equal(f.views.at(-1),'office');
});
check('staff can still preview the student journey inside the separate guided demo',()=>{
 const f=setup();f.run('portal.user={role:"staff",username:"apu.staff"};live.mode="simulation";view("student")');assert.equal(f.views.at(-1),'student');
});
check('a session identity mismatch hides account data and returns to login',()=>{
 const f=setup();f.run('live.booking={reservation_id:"private",student_id:"TP123456"};renderLive({user:{username:"someone-else"}})');
 assert.equal(f.redirects.at(-1),'/login.html');assert.equal(f.run('live.booking'),null);assert.equal(f.classes.has('auth-pending'),true);
});
check('reduced-motion preference disables smooth programmatic scrolling',()=>{
 const f=setup();f.context.matchMedia=()=>({matches:true});assert.equal(f.run('motionBehavior()'),'auto');
});
check('refreshing the same role menu does not replace focused controls',()=>{
 const f=setup();f.run('renderRoleMenu()');f.element('roleMenu').innerHTML='focused-control-sentinel';f.run('renderRoleMenu()');assert.equal(f.element('roleMenu').innerHTML,'focused-control-sentinel');
});
console.log(`${count} account-workspace checks passed.`);

check('staff navigation preserves simulation mode and shows demo navigation',()=>{
 const f=setup();f.run('portal.user={role:"staff",username:"apu.staff"};live.role="staff";live.mode="simulation";renderRoleMenu();selectStaffWorkspace("departures")');
 assert.equal(f.run('live.mode'),'simulation');assert.equal(f.views.at(-1),'office');assert.match(f.element('roleMenu').innerHTML,/Demo student ride/);assert.match(f.element('roleMenu').innerHTML,/Return to live/);
});

check('staff can preview driver only inside simulation',()=>{
 const f=setup();f.run('portal.user={role:"staff",username:"apu.staff"};live.mode="simulation";view("driver");renderRoleMenu()');assert.equal(f.views.at(-1),'driver');assert.match(f.element('roleMenu').innerHTML,/Demo driver hub/);
 f.run('live.mode="live";view("driver")');assert.equal(f.views.at(-1),'office');
});
