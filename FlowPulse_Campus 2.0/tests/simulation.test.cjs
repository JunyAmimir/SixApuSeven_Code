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
 for(const m of html.matchAll(/(?:src|href)="((?:js|css|assets)\/[^"]+)"/g))assert.ok(fs.existsSync(path.join(__dirname,'..',m[1].split('?')[0])),m[1]);
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

new vm.Script(fs.readFileSync(path.join(__dirname,'../js/experience.js'),'utf8')).runInContext(ctx);
check('continuous experience generates arrivals while views change',()=>{
 run('startExperience()');assert.equal(run('playing'),true);assert.equal(run('SIM.immersive'),true);
 run('view("student");for(let i=0;i<8;i++)tick()');assert.equal(run('t'),473);assert.ok(run('SIM.arrivals')>0);assert.ok(run('SIM.checkins')>0);
 const before=run('SIM.arrivals');run('view("office");tick()');assert.equal(run('t'),474);assert.ok(run('SIM.arrivals')>=before);assert.equal(run('playing'),true);
 assert.match(nodes['#experienceCrowds'].innerHTML,/crowd-people/);assert.match(nodes['#experienceFeed'].innerHTML,/requested rides/);
});
check('next event and backup actions preserve continuous playback',()=>{
 run('startExperience();dispatchBackup("L");respondDemoDriver(1,"accepted");advanceDemo()');assert.equal(run('playing'),true);assert.equal(run('t'),470);
 run('advanceDemo()');assert.equal(run('t'),480);assert.ok(run('SIM.boarded')>0);assert.equal(run('SIM.actions.length'),1);
 run('toggle()');const clock=run('t');run('tick()');assert.equal(run('t'),clock);assert.equal(run('playing'),false);
});
check('traffic choice preserves existing queue and simulation identity',()=>{
 run('startExperience()');const queued=run('SIM.q.length');run('setExperienceTraffic("0.55")');assert.equal(run('SIM.traffic'),0.55);assert.equal(run('SIM.q.length'),queued);
 run('setExperienceTraffic("100")');assert.equal(run('SIM.traffic'),0.55);run('for(let i=0;i<90;i++)tick()');assert.ok(run('SIM.activity.length')<=8);
});

check('simulated driver must accept before backup capacity increases',()=>{
 run('startExperience();dispatchBackup("L");dispatchBackup("L")');assert.equal(run('SIM.requests.length'),1);assert.equal(run('SIM.extra.L'),0);assert.equal(run('capacityAt("L",470)'),75);
 run('respondDemoDriver(1,"accepted")');assert.equal(run('capacityAt("L",470)'),150);assert.equal(run('SIM.actions.length'),1);
 run('respondDemoDriver(1,"accepted")');assert.equal(run('SIM.actions.length'),1);
 run('simTo(470);draw()');assert.equal(run('SIM.requests[0].status'),'departed');assert.equal(run('SIM.extra.L'),0);
});
check('declining a simulated request allows staff to request again',()=>{
 run('startExperience();dispatchBackup("C");respondDemoDriver(1,"declined");dispatchBackup("C")');
 assert.equal(run('SIM.requests.length'),2);assert.equal(run('SIM.requests[0].status'),'declined');assert.equal(run('SIM.extra.C'),0);
});
check('lecture dismissal adds exactly sixty requests without stopping playback',()=>{
 run('startExperience()');const before=run('SIM.q.length');element('#eventStop').value='L';run('triggerCampusEvent("lecture")');
 assert.equal(run('SIM.q.length'),before+60);assert.equal(run('SIM.arrivals'),60);assert.equal(run('playing'),true);assert.match(nodes['#demoStudentUpdates'].innerHTML,/60 students/);
});
check('delayed bus boards at the delayed time and not the original departure',()=>{
 run('startExperience();SIM.traffic=0.55');element('#eventStop').value='L';run('triggerCampusEvent("delay")');
 assert.equal(run('capacityAt("L",470)'),0);assert.equal(run('estimate("L",1).time'),475);
 run('simTo(470)');assert.equal(run('SIM.dep.some(x=>x.s==="L"&&x.t===470)'),false);
 run('simTo(475)');assert.equal(run('SIM.dep.some(x=>x.s==="L"&&x.t===475)'),true);assert.equal(run('SIM.disruptions.L.delayTo'),undefined);
});
check('stop closure holds boarding until reopened without losing students',()=>{
 run('startExperience()');element('#eventStop').value='C';run('triggerCampusEvent("closure");dispatchBackup("C")');
 assert.equal(run('SIM.requests.length'),0);assert.equal(run('capacityAt("C",470)'),0);
 run('simTo(470)');assert.equal(run('SIM.dep.some(x=>x.s==="C"&&x.t===470)'),false);assert.ok(run('Q("C").length')>0);
 run('simTo(480)');assert.equal(run('stopClosed("C")'),false);assert.equal(run('SIM.dep.some(x=>x.s==="C"&&x.t===480)'),true);
});
check('session wait and backup metrics use actual boarded passengers',()=>{
 run('startExperience();SIM.q=[];for(let i=0;i<100;i++)SIM.q.push({id:"test"+i,stop:"L",st:"q",ts:460,tj:459});dispatchBackup("L");respondDemoDriver(1,"accepted");SIM.now=t=470;depart("L",470);draw()');
 assert.equal(run('SIM.stats.served'),100);assert.equal(run('SIM.stats.backupBoarded'),25);assert.equal(run('SIM.stats.wait'),1000);
 assert.match(nodes['#experienceResults'].innerHTML,/10.0/);assert.match(nodes['#experienceMap'].innerHTML,/Simulated bus rotation map/);
});
check('accepted backup and delayed departure never board passengers twice',()=>{
 run('startExperience();dispatchBackup("L");respondDemoDriver(1,"accepted")');element('#eventStop').value='L';run('triggerCampusEvent("delay");simTo(470)');
 assert.equal(run('SIM.requests[0].status'),'arrived');assert.equal(run('SIM.extra.L.departure'),480);
 run('simTo(475)');assert.equal(run('SIM.stats.backupBoarded'),0);run('simTo(480)');assert.equal(run('SIM.requests[0].status'),'departed');
});

check('delayed regular bus keeps its original vehicle identity',()=>{
 run('startExperience();SIM.q=[];joinMe("L");scanMe()');element('#eventStop').value='L';run('triggerCampusEvent("delay")');
 const expected=run('busOf("L",470)+1');run('simTo(475)');assert.equal(run('SIM.me.bus'),expected);
});
check('crowd display agrees with delayed departure estimate',()=>{
 run('startExperience()');element('#eventStop').value='L';run('triggerCampusEvent("delay");draw()');
 assert.match(nodes['#experienceCrowds'].innerHTML,/Next departure 07:55/);
});
check('leaving immersive simulation clears simulated driver data',()=>{
 run('startExperience();dispatchBackup("L");draw()');assert.match(nodes['#demoDriverPanel'].innerHTML,/request #1/);
 run('resetDemo()');assert.equal(nodes['#demoDriverPanel'].innerHTML,'');assert.equal(nodes['#demoStudentUpdates'].innerHTML,'');
});
check('driver inbox is not rebuilt on an unchanged simulation draw',()=>{
 run('startExperience();dispatchBackup("L");draw()');
 const old=nodes['#demoDriverPanel'].innerHTML;let writes=0;
 Object.defineProperty(nodes['#demoDriverPanel'],'innerHTML',{configurable:true,get(){return old},set(){writes++}});
 run('draw()');assert.equal(writes,0);
 delete nodes['#demoDriverPanel'].innerHTML;nodes['#demoDriverPanel'].innerHTML=old;
});

check('three full service days with mixed disruptions preserve accounting',()=>{
 run(`for(let day=0;day<3;day++){
  startExperience();DAYI=day;let iteration=0;
  while(t<END){
   document.querySelector('#eventStop').value=iteration%2?'L':'C';
   if(iteration%47===0)triggerCampusEvent('lecture');
   if(iteration%59===0)triggerCampusEvent('delay');
   if(iteration%83===0)triggerCampusEvent('closure');
   if(iteration%31===0){dispatchBackup(iteration%2?'L':'C');const job=SIM.requests.find(x=>x.status==='requested');if(job)respondDemoDriver(job.id,iteration%3?'accepted':'declined');}
   step();
   if(SIM.stats.served!==SIM.boarded)throw Error('Boarding accounting diverged at '+t);
   if(!Number.isFinite(SIM.stats.wait)||SIM.stats.wait<0)throw Error('Invalid wait total');
   if(SIM.stats.backupBoarded>SIM.stats.served)throw Error('Invalid backup usage');
   for(const s of ['L','C'])if(SIM.requests.filter(x=>x.s===s&&['requested','accepted','arrived'].includes(x.status)).length>1)throw Error('Duplicate active request');
   iteration++;
  }
  draw();
 }`);
 assert.equal(run('t'),1320);assert.ok(run('SIM.stats.served')>0);
});
