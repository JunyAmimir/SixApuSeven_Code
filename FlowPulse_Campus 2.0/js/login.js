/* Standalone sign-in screen. Role comes from the authenticated server response. */
const loginUI={role:'student',accounts:[{role:'staff',username:'apu.staff'},{role:'driver',username:'bus.driver'},{role:'student',username:'student'}],busy:false};
const loginEl=id=>document.getElementById(id);
const roleCopy={staff:['Sign in as APU staff','Operations, observations and a clearer view of campus.'],driver:['Sign in as a bus driver','Your shuttle requests, arrival updates and next move.'],student:['Sign in as a student','Reservations, boarding passes and your next ride.']};
function selectLoginRole(role){
 if(loginUI.busy||!roleCopy[role])return;loginUI.role=role;
 const account=loginUI.accounts.find(a=>a.role===role);loginEl('accountUsername').value=account?.username||'';
 loginEl('accountPassword').value='';loginEl('accountPassword').type='password';loginEl('passwordToggle').setAttribute('aria-label','Show password');
 loginEl('submitText').textContent=roleCopy[role][0];loginEl('workspaceHint').lastElementChild.textContent=roleCopy[role][1];loginEl('accountLoginError').hidden=true;
}
function loginError(message){loginEl('accountLoginError').textContent=message;loginEl('accountLoginError').hidden=false;}
function connectionErrorMessage(error){
 if(error?.name==='TypeError'||/failed to fetch|networkerror|load failed/i.test(error?.message||'')){
  return 'Cannot reach the FlowPulse server. Run Start_FlowPulse.cmd in this project folder, keep that window open, then refresh this page.';
 }
 return error?.message||'Sign-in could not be completed. Please try again.';
}
async function submitAccount(event){
 event.preventDefault();if(loginUI.busy)return;
 const username=loginEl('accountUsername').value.trim(),password=loginEl('accountPassword').value;
 if(!username||!password){loginError('Enter your username and password to continue.');(!username?loginEl('accountUsername'):loginEl('accountPassword')).focus();return;}
 loginUI.busy=true;loginEl('accountSubmit').disabled=true;loginEl('accountLoginForm').classList.add('submitting');document.querySelector('.login-card').setAttribute('aria-busy','true');loginEl('accountLoginError').hidden=true;
 document.querySelectorAll('[name=accountRole]').forEach(r=>r.disabled=true);
 try{
  const response=await fetch('/api/login',{method:'POST',headers:{'Content-Type':'application/json','X-FlowPulse-Request':'1'},body:JSON.stringify({username,password,role:loginUI.role})});
  const data=await response.json();if(!response.ok)throw Error(data.error||'Sign-in could not be completed');
  loginEl('accountPassword').value='';const destinations={staff:'/staff',driver:'/driver',student:'/student'};
  if(!destinations[data.role])throw Error('Your account could not be loaded. Please try again.');
  window.location.replace(destinations[data.role]);
 }catch(error){loginError(connectionErrorMessage(error));}
 finally{loginUI.busy=false;loginEl('accountSubmit').disabled=false;loginEl('accountLoginForm').classList.remove('submitting');document.querySelector('.login-card').setAttribute('aria-busy','false');document.querySelectorAll('[name=accountRole]').forEach(r=>r.disabled=false);}
}
document.addEventListener('DOMContentLoaded',async()=>{
 loginEl('accountLoginForm').addEventListener('submit',submitAccount);
 document.querySelectorAll('[name=accountRole]').forEach(r=>r.addEventListener('change',()=>selectLoginRole(r.value)));
 loginEl('passwordToggle').addEventListener('click',()=>{const input=loginEl('accountPassword'),show=input.type==='password';input.type=show?'text':'password';loginEl('passwordToggle').setAttribute('aria-label',show?'Hide password':'Show password');loginEl('passwordToggle').title=show?'Hide password':'Show password';input.focus();});
 selectLoginRole('student');
 try{const response=await fetch('/api/session',{cache:'no-store'});if(!response.ok)throw Error();const data=await response.json();
  if(data.role){window.location.replace({staff:'/staff',driver:'/driver',student:'/student'}[data.role]);return;}
  if(data.accounts?.length){loginUI.accounts=data.accounts;if(!loginEl('accountPassword').value)selectLoginRole(loginUI.role);}
 }catch{loginError('The FlowPulse server is not running. Start Start_FlowPulse.cmd in this folder, keep it open, then refresh this page.');}
});
