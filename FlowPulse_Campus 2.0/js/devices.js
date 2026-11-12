/* Explicit camera consent, reviewed counts, and station QR/keyboard-reader input. */
let cameraReview=null,cameraVersion=0,cameraBusy=false,cameraStream=null,cameraTimer=null,cameraStarting=false;
function requestCamera(constraints){
 return new Promise((resolve,reject)=>{
  let finished=false;
  const timer=setTimeout(()=>{finished=true;reject(Error('Camera permission timed out. Allow camera access in your browser, then try again.'));},15000);
  navigator.mediaDevices.getUserMedia(constraints).then(stream=>{
   if(finished){stream.getTracks().forEach(t=>t.stop());return;}
   finished=true;clearTimeout(timer);resolve(stream);
  },err=>{if(!finished){finished=true;clearTimeout(timer);reject(err);}});
 });
}
function clearCameraReview(){cameraReview=null;cameraVersion++;el('cameraSave').disabled=true;}
async function analyzeFrame(encoded,mime){
 if(cameraBusy)return;
 if(!live.state?.camera_configured){el('cameraResult').textContent='Configure GEMINI_API_KEY before analysis. Preview and manual counting still work.';return;}
 if(cameraReview){el('cameraRunStatus').textContent='A count awaits review. Save or discard it before another analysis.';return;}
 const version=++cameraVersion,stop=el('liveSensorStop').value;cameraBusy=true;el('cameraAnalyze').disabled=true;el('cameraResult').textContent='Analyzing snapshot…';
 try{const r=await liveCall('camera/analyze',{image:encoded,mime_type:mime});if(version!==cameraVersion)return;
  cameraReview={...r,stop};el('livePeople').value=r.people;el('cameraResult').textContent=`${stopName(stop)}: ${r.people} people · ${r.confidence} confidence. ${r.notes} Review/edit People, then save. No reading saved yet.`;el('cameraSave').disabled=false;
 }catch(err){if(version===cameraVersion)el('cameraResult').textContent=err.message;}finally{cameraBusy=false;el('cameraAnalyze').disabled=false;}
}
async function analyzeCamera(){
 const file=el('cameraFile').files[0];if(!file||file.size>3*1024*1024||!['image/jpeg','image/png','image/webp'].includes(file.type)){el('cameraResult').textContent='Choose a JPEG, PNG or WebP image up to 3 MB.';return;}
 const version=cameraVersion;
 try{const encoded=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result.split(',')[1]);r.onerror=()=>reject(Error('Could not read image'));r.readAsDataURL(file);});if(version===cameraVersion)await analyzeFrame(encoded,file.type);}catch(err){el('cameraResult').textContent=err.message;}
}
async function saveCamera(){
 if(!cameraReview)return;const review=cameraReview;el('cameraSave').disabled=true;
 const result=await liveAction('sensor',{stop:review.stop,people:Number(el('livePeople').value),source:'gemini-reviewed',observed_at:review.observed_at});
 if(result&&cameraReview===review){clearCameraReview();el('cameraResult').textContent='Reviewed count saved to shared history.';}else if(cameraReview===review)el('cameraSave').disabled=false;
}
function discardCamera(){clearCameraReview();el('cameraResult').textContent='Count discarded.';}
async function startLaptopCamera(){
 if(cameraStream||cameraStarting)return;if(live.role!=='staff'){liveMessage('Staff login required',true);return;}
 if(!navigator.mediaDevices?.getUserMedia){el('cameraRunStatus').textContent='Camera requires localhost or HTTPS. You can still upload a snapshot.';return;}
 stopQrScanner();cameraStarting=true;const version=cameraVersion;
 el('cameraRunStatus').textContent='Waiting for camera permission. Allow camera access in your browser to show the preview.';
 try{const stream=await requestCamera({video:{width:{ideal:1280},height:{ideal:720}},audio:false});
  if(version!==cameraVersion){stream.getTracks().forEach(t=>t.stop());return;}
  cameraStream=stream;el('cameraVideo').srcObject=stream;el('cameraVideo').hidden=false;await el('cameraVideo').play();el('cameraRunStatus').textContent='Preview on. Frames stay local until you analyze or start periodic analysis.';
 }catch(err){stopLaptopCamera();el('cameraRunStatus').textContent=err.message||'Camera unavailable or permission denied. Try a snapshot upload.';}finally{cameraStarting=false;}
}
async function captureLaptop(){
 const v=el('cameraVideo');if(!cameraStream||!v.videoWidth){el('cameraRunStatus').textContent='Start the laptop camera and wait for its preview first.';return;}
 const c=document.createElement('canvas'),scale=Math.min(1,1280/v.videoWidth);c.width=Math.round(v.videoWidth*scale);c.height=Math.round(v.videoHeight*scale);c.getContext('2d').drawImage(v,0,0,c.width,c.height);await analyzeFrame(c.toDataURL('image/jpeg',0.8).split(',')[1],'image/jpeg');
}
function toggleAutoCamera(){
 if(cameraTimer){clearInterval(cameraTimer);cameraTimer=null;el('cameraAuto').textContent='Start 30-second analysis';el('cameraRunStatus').textContent='Periodic analysis stopped. Preview remains on.';return;}
 if(!cameraStream||!live.state?.camera_configured){el('cameraRunStatus').textContent='Start camera and configure Gemini before periodic analysis.';return;}
 el('cameraAuto').textContent='Stop periodic analysis';el('cameraRunStatus').textContent='Periodic analysis on: sends a frame every 30 seconds when no count awaits review.';captureLaptop();cameraTimer=setInterval(()=>{if(!cameraReview&&!cameraBusy)captureLaptop();},30000);
}
function stopLaptopCamera(){cameraVersion++;if(cameraTimer)clearInterval(cameraTimer);cameraTimer=null;if(cameraStream)cameraStream.getTracks().forEach(t=>t.stop());cameraStream=null;el('cameraVideo').srcObject=null;el('cameraVideo').hidden=true;el('cameraAuto').textContent='Start 30-second analysis';el('cameraRunStatus').textContent='Camera off. No more frames will be sent.';}
let qrStream=null,qrTimer=null,qrGeneration=0;
async function submitScan(raw){
 const text=(typeof raw==='string'?raw:el('kioskScan').value).trim();
 try{let data;
  if(text.startsWith('{')){data=JSON.parse(text);if(data.type!=='flowpulse'||typeof data.reservation_id!=='string'||typeof data.student_id!=='string')throw Error('Not a FlowPulse booking QR');}
  else{const row=live.state?.reservations.find(x=>x.id===el('kioskBooking').value);if(!row)throw Error('Select a reservation before scanning a student card');data={student_id:text,reservation_id:row.id};}
  const result=await liveCall('checkin',data);el('kioskScan').value='';el('scanStatus').textContent=`${data.student_id}: ${statusName(result.status)}`;await liveRefresh();
 }catch(err){el('scanStatus').textContent=err.message;}
}
async function startQrScanner(){
 if(live.role!=='staff'){liveMessage('Staff login required',true);return;}
 if(!window.BarcodeDetector||!navigator.mediaDevices?.getUserMedia){el('scanStatus').textContent='QR camera scanning is unavailable here. Use a USB barcode reader or paste the ticket payload.';return;}
 stopLaptopCamera();stopQrScanner();const generation=qrGeneration;
 try{const formats=(await BarcodeDetector.getSupportedFormats()).filter(x=>['qr_code','code_128','code_39','pdf417','aztec','data_matrix','ean_13'].includes(x));if(!formats.length)throw Error('This browser cannot detect supported barcodes. Use the scan field.');
  const detector=new BarcodeDetector({formats});el('scanStatus').textContent='Waiting for browser camera permission…';const stream=await requestCamera({video:{facingMode:'environment'},audio:false});
  if(generation!==qrGeneration){stream.getTracks().forEach(t=>t.stop());return;}
  qrStream=stream;el('qrVideo').srcObject=stream;el('qrVideo').hidden=false;await el('qrVideo').play();el('scanStatus').textContent='Hold a FlowPulse booking QR in front of the camera.';
  async function detect(){if(!qrStream||generation!==qrGeneration)return;try{const codes=await detector.detect(el('qrVideo'));if(codes.length){const raw=codes[0].rawValue;stopQrScanner();await submitScan(raw);return;}}catch{el('scanStatus').textContent='Waiting for a readable QR…';}if(generation===qrGeneration)qrTimer=setTimeout(detect,400);}detect();
 }catch(err){stopQrScanner();el('scanStatus').textContent=err.message||'Scanner unavailable';}
}
function stopQrScanner(){qrGeneration++;if(qrTimer)clearTimeout(qrTimer);qrTimer=null;if(qrStream)qrStream.getTracks().forEach(t=>t.stop());qrStream=null;el('qrVideo').srcObject=null;el('qrVideo').hidden=true;}
window.onFlowViewChange=v=>{if(v!=='office'){stopLaptopCamera();stopQrScanner();}};
window.addEventListener('pagehide',()=>{stopLaptopCamera();stopQrScanner();});
document.addEventListener('visibilitychange',()=>{if(document.hidden){stopLaptopCamera();stopQrScanner();}});
