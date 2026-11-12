// Run with: node tests/simulation.test.cjs
// Exercises production scripts in an isolated context; no browser dependencies.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const nodes={};
function element(s){return nodes[s]??={value:s==='#spd'?'1':s==='#wk'?'1':s==='#ws'?'L':'',innerHTML:'',textContent:'',classList:{toggle(){}},select(){}}}
const ctx=vm.createContext({console,document:{querySelector:element,body:{classList:{toggle(){}}}},location:{hash:''},addEventListener(){},setTimeout(){},clearTimeout(){},setInterval(){},navigator:{}});
for(const n of ['config','mockData','queue','history','parking','map','operations','office','student','app'])new vm.Script(fs.readFileSync(path.join(__dirname,'../js',n+'.js'),'utf8'),{filename:n+'.js'}).runInContext(ctx);
const run=s=>vm.runInContext(s,ctx);
let count=0;function check(name,fn){fn();count++;console.log('PASS',name)}
check('join, scan, cancel and shared views',()=>{run("resetDemo();joinMe('L');scanMe()");assert.equal(run("Q('L').includes(SIM.me)"),true);assert.equal(run("stopPanel('L').includes(String(Q('L').length))"),true);run('cancelMe()');assert.equal(run('SIM.me'),null)});
check('arbitrary queue depth',()=>{run('resetDemo()');assert.equal(run("estimate('L',161).time"),480);assert.equal(run("estimate('L',301).time"),500)});
check('repeatable congestion baseline',()=>{run('loadDemo()');assert.equal(run("Q('L').length"),161);assert.equal(run("Q('L').indexOf(SIM.me)+1"),101);assert.equal(run('SIM.demoBaseline'),490);assert.equal(run('playing'),false)});
check('dispatch preserves queue and models travel',()=>{run("dispatchBackup('L')");assert.equal(run("SIM.extra.L.arrival"),476);assert.equal(run("SIM.extra.L.departure"),480);assert.equal(run("Q('L').length"),161);assert.equal(run("estimate('L',101).time"),480);assert.equal(run("estimate('L',101).backup"),true);run("dispatchBackup('L')");assert.equal(run('SIM.extra.L.arrival'),476)});
check('arrival does not board early',()=>{run('advanceDemo()');assert.equal(run('t'),476);assert.equal(run("Q('L').length"),161);assert.match(run("backupStatus('L')"),/Arrived/)});
check('departure boards separate regular and backup passengers',()=>{run('advanceDemo()');assert.equal(run('t'),480);assert.equal(run("Q('L').length"),11);assert.equal(run('SIM.me.backup'),true);assert.equal(run('SIM.me.bus'),'Backup');assert.equal(run('SIM.me.done'),'boarded');assert.equal(run('SIM.extra.L'),0);assert.match(nodes['#demoProgress'].textContent,/10 simulated minutes saved/)});
check('without intervention same student waits ten extra minutes',()=>{run('loadDemo();advanceDemo()');assert.equal(run('t'),480);assert.equal(run('SIM.me.done'),undefined);run('advanceDemo()');assert.equal(run('SIM.me.tb'),490);assert.equal(run('SIM.me.backup'),false)});
check('late dispatch cannot boost an earlier departure',()=>{run('loadDemo();simTo(478);dispatchBackup("L")');assert.equal(run('SIM.extra.L.departure'),490);assert.equal(run('capacityAt("L",480)'),75);run('simTo(480)');assert.equal(run('SIM.extra.L.departure'),490);assert.equal(run('SIM.me.done'),undefined)});
check('scan expiry',()=>{run('resetDemo();joinMe("L");simTo(470)');assert.equal(run('SIM.me.done'),'expired');assert.equal(run('SIM.q.some(x=>x.me)'),false)});
check('parking closure and reset',()=>{run('closed.U=true;draw()');assert.match(nodes['#parkS'].innerHTML,/Closed by the campus office/);run('resetDemo()');assert.equal(run('Object.keys(closed).length'),0)});
check('rewind resets active trip',()=>{run('loadDemo();simTo(450)');assert.equal(run('SIM.me'),null);assert.equal(run('SIM.demo'),undefined)});
check('closing blocks requests and impossible backups',()=>{run('resetDemo();simTo(1318);dispatchBackup("L")');assert.equal(run('SIM.extra.L'),0);run('simTo(1320);joinMe("L");setPlaying(true);tick()');assert.equal(run('SIM.me'),null);assert.equal(run('estimate("L",1)'),null);assert.equal(run('playing'),false);assert.equal(run('t'),1320);assert.match(nodes['#alerts'].innerHTML,/Service closed/)});
check('preset CSV identifies its source and includes full week',()=>{run('report()');assert.match(nodes['#rep'].value,/PRESET_SIMULATION,AUTO_BACKUP/);assert.equal(nodes['#rep'].value.trim().split('\n').length,171)});
check('both weeks render and simulation runs to closing',()=>{for(const w of ['1','2']){element('#wk').value=w;run('buildReport()');assert.ok(nodes['#wsum'].innerHTML.includes('Fri'))}run('resetDemo();setPlaying(true);for(let i=0;i<900;i++)tick()');assert.equal(run('t'),1320)});
check('guided buttons execute the complete intervention',()=>{
 run('resetDemo()');
 const clickGuide=()=>{const handler=nodes['#guide'].innerHTML.match(/onclick="([^"]+)"/);assert.ok(handler);run(handler[1])};
 clickGuide();assert.match(nodes['#guide'].innerHTML,/Respond to the LRT queue/);
 clickGuide();assert.match(nodes['#responses'].innerHTML,/En route to stop/);assert.equal(run('SIM.actions.length'),1);
 clickGuide();assert.match(nodes['#responses'].innerHTML,/At stop \/ boarding/);assert.equal(run("Q('L').length"),161);
 clickGuide();assert.match(nodes['#responses'].innerHTML,/Departure completed/);
 assert.equal(run('SIM.actions[0].regularBoarded'),75);assert.equal(run('SIM.actions[0].backupBoarded'),75);assert.equal(run('SIM.actions[0].remaining'),11);
 clickGuide();assert.equal(ctx.location.hash,'#student');
 run('simTo(490);draw()');assert.match(nodes['#responses'].innerHTML,/Left after departure/);assert.equal(run('SIM.actions[0].remaining'),11);assert.equal(run("Q('L').length"),0);
 run('resetDemo()');assert.equal(run('SIM.actions.length'),0);assert.match(nodes['#responses'].innerHTML,/No backup dispatched yet/);
});
check('dispatch results distinguish unused and partially used backups',()=>{
 run('loadDemo();SIM.q=SIM.q.slice(0,90);SIM.me=null;dispatchBackup("L");simTo(480);draw()');
 assert.equal(run('SIM.actions[0].regularBoarded'),75);assert.equal(run('SIM.actions[0].backupBoarded'),15);assert.equal(run('SIM.actions[0].remaining'),0);
 run('resetDemo();SIM.q=[];SIM.demo=true;dispatchBackup("C");simTo(460);draw()');
 assert.equal(run('SIM.actions[0].backupBoarded'),0);assert.equal(run('SIM.actions[0].status'),'departed');
});
check('rendered button handlers and linked source files are valid',()=>{
 for(const node of Object.values(nodes))for(const m of node.innerHTML.matchAll(/onclick="([^"]+)"/g))new vm.Script(m[1]);
 const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
 for(const m of html.matchAll(/(?:src|href)="((?:js|css|assets)\/[^"]+)"/g))assert.ok(fs.existsSync(path.join(__dirname,'..',m[1])),m[1]);
 const ids=[...html.matchAll(/id="([^"]+)"/g)].map(m=>m[1]);assert.equal(new Set(ids).size,ids.length);
});
check('student journey shows only the current action',()=>{
 run('resetDemo()');assert.match(nodes['#busS'].innerHTML,/Where are you leaving from/);
 assert.match(nodes['#busS'].innerHTML,/disabled[^>]*onclick="joinMe/);
 run("selectStudentStop('C');joinMe(SIM.selectedStop)");assert.equal(run('SIM.me.stop'),'C');
 assert.match(nodes['#busS'].innerHTML,/Check in when you arrive/);assert.doesNotMatch(nodes['#busS'].innerHTML,/Where are you leaving from/);
 run('scanMe()');assert.match(nodes['#busS'].innerHTML,/Your place in the queue/);assert.match(nodes['#busS'].innerHTML,/Estimated wait/);
 run('cancelMe()');assert.match(nodes['#busS'].innerHTML,/Where are you leaving from/);
 run('loadDemo();dispatchBackup("L");simTo(480);draw()');assert.match(nodes['#busS'].innerHTML,/You are on board/);assert.match(nodes['#busS'].innerHTML,/Backup shuttle/);assert.doesNotMatch(nodes['#busS'].innerHTML,/Join queue from/);
 run('simTo(500);draw()');assert.match(nodes['#busS'].innerHTML,/You have arrived/);assert.match(nodes['#busS'].innerHTML,/Plan another ride/);
 run('cancelMe()');assert.match(nodes['#busS'].innerHTML,/Where are you leaving from/);
});
check('normal simulation resumes arrivals without losing dispatch history',()=>{
 run('loadDemo();dispatchBackup("L");simTo(500);draw()');assert.equal(run('SIM.q.length'),0);
 assert.match(nodes['#guide'].innerHTML,/Continue normal simulation/);
 const handler=nodes['#guide'].innerHTML.match(/onclick="(resumeTraffic\(\))"/);assert.ok(handler);run(handler[1]);
 assert.equal(run('playing'),true);assert.equal(run('SIM.demo'),false);assert.equal(run('SIM.actions.length'),1);
 run('for(let i=0;i<5;i++)tick()');assert.ok(run('SIM.q.length')>0);assert.equal(run('t'),505);
 assert.match(nodes['#demoProgress'].textContent,/Normal simulation \/ Running/);
 run('toggle()');assert.match(nodes['#studentStatus'].textContent,/Paused/);
});
check('shared toolbar controls playback and time in student view',()=>{
 run('resetDemo();view("student");toggle()');assert.equal(run('playing'),true);assert.match(nodes['#studentStatus'].textContent,/Running/);
 run('tick()');assert.equal(run('t'),451);
 run('toggle()');assert.equal(run('playing'),false);assert.match(nodes['#studentStatus'].textContent,/top bar/);
 element('#sl').oninput({target:{value:'460'}});assert.equal(run('t'),460);assert.equal(ctx.location.hash,'#student');
 element('#day').onchange({target:{value:'9'}});assert.equal(run('DAYI'),9);assert.equal(ctx.location.hash,'#student');
 const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');assert.ok(!html.includes('student-presenter'));
});
check('last bus reaches its destination using shared playback controls',()=>{
 run('resetDemo();simTo(1319);SIM.q=[];joinMe("L");scanMe()');element('#spd').value='20';run('setPlaying(true);tick()');
 assert.equal(run('SIM.me.tb'),1320);assert.equal(run('t'),1339);const queued=run('SIM.q.length');
 run('tick()');assert.equal(run('t'),1340);assert.equal(run('playing'),false);assert.equal(run('SIM.q.length'),queued);assert.match(nodes['#busS'].innerHTML,/You have arrived/);
});
check('repeated backups show the latest result',()=>{
 run('loadDemo();dispatchBackup("L");simTo(480);dispatchBackup("L");simTo(490);draw()');
 assert.match(nodes['#guide'].innerHTML,/At 08:10/);assert.equal(run('SIM.actions.length'),2);
});
check('changing report filters clears stale CSV',()=>{
 run('report()');assert.ok(nodes['#rep'].value.length>100);element('#wk').value='2';run('buildReport()');assert.equal(nodes['#rep'].value,'');
 run('report()');assert.match(nodes['#rep'].value,/AUTO_BACKUP,LRT station,2,/);
});
check('new journey does not inherit fixed-scenario savings',()=>{
 run('loadDemo();cancelMe();joinMe("C");scanMe()');assert.doesNotMatch(nodes['#demoProgress'].textContent,/minutes saved/);
});
check('all ten simulated days complete without errors',()=>{
 for(let d=0;d<10;d++){run(`reset(${d});simTo(1320);buildReport();draw()`);assert.equal(run('t'),1320);assert.ok(run('Q("L").length')>=0)}
});
console.log(`${count} checks passed.`);
