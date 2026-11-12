const {fixture}=require('./live.test.cjs');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
function setup(){const f=fixture();vm.runInContext(fs.readFileSync(path.join(__dirname,'../js/studio.js'),'utf8'),f.context);f.run('live.connected=true');return f;}
let count=0;
async function check(name,fn){await fn();console.log('PASS '+name);count++;}
(async()=>{
 await check('missing observations never imply an empty queue',()=>{
  const f=setup();f.run('drawLiveOffice()');assert.match(f.element('stops').innerHTML,/no queue estimate yet/);assert.match(f.element('stops').innerHTML,/Awaiting data/);assert.match(f.element('alerts').innerHTML,/meaningful queue forecast/);
 });
 await check('student route filter excludes the other stop',()=>{
  const f=setup();f.run('live.state.departures.push({id:2,stop:"C",departs_at:"2026-11-13T08:10:00+08:00",capacity:75,booked:10});selectRoute("C")');assert.match(f.element('liveDeparture').innerHTML,/value="2"/);assert.doesNotMatch(f.element('liveDeparture').innerHTML,/value="1"/);assert.match(f.element('departureChoices').innerHTML,/65 seats/);
 });
 await check('already-reserved departure cannot be booked twice in the UI',()=>{
  const f=setup();f.run('live.booking={stop:"L",departs_at:"2026-11-13T08:00:00+08:00",status:"reserved"};renderStudentDepartures()');assert.equal(f.element('reserveButton').disabled,true);assert.match(f.element('reserveButton').innerHTML,/already reserved/);
 });
 await check('calendar reminder has correct UTC times and excludes private credentials',()=>{
  const f=setup();const result=f.run('calendarText({stop:"L",departs_at:"2026-11-13T08:00:00+08:00",reservation_id:"PRIVATE-CODE",student_id:"TP999999"})');assert.match(result,/DTSTART:20261113T000000Z/);assert.match(result,/DTEND:20261113T002000Z/);assert.match(result,/TRIGGER:-PT15M/);assert.doesNotMatch(result,/PRIVATE-CODE|TP999999/);
 });
 await check('schedule CSV labels its source and excludes student identities',()=>{
  const f=setup();f.run('live.state.reservations=[{student_id:"TP999999",id:"PRIVATE-CODE"}]');const csv=f.run('scheduleCsv()');assert.match(csv,/RECORDED_LIVE_SCHEDULE/);assert.match(csv,/insufficient observations/);assert.doesNotMatch(csv,/TP999999|PRIVATE-CODE/);
 });
 await check('protected tabs open sign-in and preserve the current workspace',()=>{
  const f=setup();f.run('live.role=null;setWorkspace("checkin")');assert.equal(f.element('accessDialog').open,true);assert.equal(f.run('studio.workspace'),'overview');assert.equal(f.run('studio.pending'),'checkin');
 });
 await check('notice text is rendered safely and public users cannot resolve it',()=>{
  const f=setup();f.run('live.role=null;live.state.notices=[{id:"notice",title:"<script>alert(1)</script>",message:"<b>Unsafe markup</b>",severity:"warning",expires_at:"2026-11-13T09:00:00+08:00"}];renderNotices()');assert.match(f.element('serviceNotices').innerHTML,/&lt;script&gt;/);assert.doesNotMatch(f.element('serviceNotices').innerHTML,/<script>|onclick=/);
 });
 await check('empty trend chart contains no invented data points',()=>{
  const f=setup();f.run('renderTrend()');assert.match(f.element('demandChart').innerHTML,/No sample data/);assert.doesNotMatch(f.element('demandChart').innerHTML,/chart-svg/);
 });
 await check('recorded observations produce an accessible demand chart',()=>{
  const f=setup();f.run('live.state.sensor_history=[{stop:"L",people:40,created_at:"2026-11-13T07:15:00+08:00"},{stop:"L",people:52,created_at:"2026-11-13T07:25:00+08:00"}];renderTrend()');assert.match(f.element('demandChart').innerHTML,/role="img"/);assert.match(f.element('demandChart').innerHTML,/52 people/);assert.match(f.element('demandChart').innerHTML,/40 people/);
 });
 await check('booking cancellation waits for an explicit confirmation',()=>{
  const f=setup();f.run('live.booking={reservation_id:"private",student_id:"TP100001"};requestCancelBooking()');assert.equal(f.element('cancelDialog').open,true);assert.equal(f.calls.length,0);
 });
 await check('theme choice is saved locally',()=>{
  const f=setup();f.run('toggleTheme()');assert.equal(f.storage.get('flowpulse.theme'),'dark');assert.equal(f.element('themeToggle').attributes['aria-label'],'Switch to light theme');
 });
 await check('planning another ride retains the existing booking for recovery',()=>{
  const f=setup();f.run('rememberBooking({reservation_id:"private",student_id:"TP100001",stop:"L",status:"reserved",departs_at:"2026-11-13T08:00:00+08:00"});planAnotherRide()');assert.equal(f.run('live.booking'),null);assert.equal(f.storage.get('flowpulse.activeBooking'),undefined);assert.equal(JSON.parse(f.storage.get('flowpulse.bookings')).length,1);assert.equal(f.calls.length,0);
 });
 console.log(`${count} studio checks passed.`);
})().catch(err=>{console.error(err);process.exitCode=1;});
