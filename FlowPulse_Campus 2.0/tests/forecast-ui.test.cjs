const {fixture}=require('./live.test.cjs');
const assert=require('node:assert/strict');
(async()=>{
 const f=fixture();
 f.run(`live.role='staff';live.state.forecasts=[{departure_id:1,stop:'L',departs_at:'2026-11-13T08:00:00+08:00',demand:100,capacity:75,reserved_floor:10,evidence:'observations',planning_low:75,planning_high:125,confidence:'low',historical_days:0,recent_readings:1,sources:['<script>'],basis:'Manual count',demo_data:true,range_note:'Planning band only'}];live.state.dispatch_advice=[{departure_id:1,status:'review',can_request:true,suggested_buses:1,reason:'Review the count'}]`);
 const html=f.run('renderForecastAdvice(live.state)');
 assert.match(html,/Planning band: 75–125/);assert.match(html,/demonstration data/);
 assert.match(html,/Review and request one backup/);assert.match(html,/&lt;script&gt;/);assert.doesNotMatch(html,/<script>/);
 f.run('live.role="student"');assert.doesNotMatch(f.run('renderForecastAdvice(live.state)'),/<button/);
 f.run('live.role="staff";live.state.dispatch_advice[0].status="pending";live.state.dispatch_advice[0].can_request=false');assert.doesNotMatch(f.run('renderForecastAdvice(live.state)'),/<button/);
 f.context.confirm=()=>false;
 await f.run('dispatchLive(1,"live")');assert.equal(f.calls.length,0);
 console.log('PASS forecast evidence, safe text, staff-only actions, active request and cancelled confirmation');
})().catch(e=>{console.error(e);process.exitCode=1});
