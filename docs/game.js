import {createState,restore,config,objects,targetAt,movePlayer,act,objective,hint,noteContents,MAP,TILE,START,solid} from './core.mjs';
import {Sound} from './sound.js';
const $=id=>document.getElementById(id),KEY='brainrot.room.v2',SETTINGS='brainrot.settings.v2';
let stored=null;try{stored=restore(localStorage.getItem(KEY));}catch{}
let state=stored&&!stored.escaped?stored:createState(stored?(stored.seed+1)%4:Math.floor(Math.random()*4));
const sound=new Sound(),canvas=$('world'),panel=$('panel'),keys=new Set();
let world,ready=false,entered=false,finished=false,escapeAt=null,last=performance.now(),gameTime=0,moved=0,lastSave=0,currentTarget=null,drag=null,toastTimer,subtitleTimer,scareUntil=0,darkUntil=0,queue=[],volume=.35,muted=false,scares=true,lowMotion=matchMedia('(prefers-reduced-motion:reduce)').matches,radioValue=88,doorCode='',wrongCodes=0;
try{const p=JSON.parse(localStorage.getItem(SETTINGS)||'null');if(p){volume=Math.max(0,Math.min(1,Number.isFinite(Number(p.volume))?Number(p.volume):.35));muted=!!p.muted;scares=p.scares!==false;lowMotion=p.lowMotion===true||lowMotion;}}catch{}
sound.volume=volume;sound.muted=muted;document.body.classList.toggle('low-motion',lowMotion);
function save(){if(!entered)return false;try{localStorage.setItem(KEY,JSON.stringify(state));return true;}catch{return false;}}
function saveSettings(){try{localStorage.setItem(SETTINGS,JSON.stringify({volume,muted,scares,lowMotion}));}catch{}}
function toast(text){$('toast').textContent=text;$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),3000);}
function subtitle(text,duration=6500){$('subtitle').textContent=text;$('subtitle').classList.add('show');clearTimeout(subtitleTimer);subtitleTimer=setTimeout(()=>$('subtitle').classList.remove('show'),duration);}
const timeText=n=>`${String(Math.floor(n/60)).padStart(2,'0')}:${String(Math.floor(n)%60).padStart(2,'0')}`;
function hud(){const [chapter,title,detail]=objective(state);$('chapter').textContent=chapter;$('objective').textContent=title;$('objective-detail').textContent=detail;for(const id of ['fuse','signal','disk']){const e=$('item-'+id);e.classList.toggle('acquired',state[id]);e.querySelector('i').textContent=state[id]?'✓':'—';}$('note-count').textContent=String(state.notes.length).padStart(2,'0');sound.setStage(state.signal?2:state.power?1:0);}
function soundUI(){$('sound-state').textContent=muted?'OFF':'ON';$('sound-button').setAttribute('aria-label',muted?'Unmute audio':'Mute audio');$('sound-button').setAttribute('aria-pressed',String(muted));}
async function enter(){if(!ready||entered)return;entered=true;document.body.classList.remove('entry-mode');document.body.classList.add('playing');$('entry').classList.add('leaving');$('game-hud').hidden=false;hud();canvas.focus();try{await sound.start();}catch{toast('AUDIO UNAVAILABLE — YOU CAN STILL EXPLORE.');}subtitle(state.notes.length?'The room remembers where you left off.':"The lights are on. The exits aren't.");save();}
$('enter-button').addEventListener('click',enter);$('reload-button').addEventListener('click',()=>location.reload());
$('sound-button').addEventListener('click',()=>{muted=!muted;sound.mute(muted);soundUI();saveSettings();});soundUI();
function closePanel(){panel.close();}
function openPanel(kind,kicker,title,body){if(!entered||finished)return;keys.clear();drag=null;panel.dataset.kind=kind;$('panel-id').textContent='ARCHIVE / '+kind.toUpperCase();$('panel-kicker').textContent=kicker;$('panel-title').textContent=title;$('panel-body').innerHTML=body;if(!panel.open)panel.showModal();panel.querySelector('.close-panel').focus();document.body.classList.add('paused');sound.duck(true);$('interact').hidden=true;save();}
panel.querySelector('.close-panel').addEventListener('click',closePanel);
panel.addEventListener('close',()=>{keys.clear();drag=null;document.body.classList.remove('paused');sound.duck(false);if(!sound.active&&!document.hidden)sound.start().catch(()=>{});canvas.focus();});
function planScare(id,delay,type){if(!state.scares.includes(id)&&!queue.some(q=>q.id===id))queue.push({id,at:state.elapsed+delay,type});}
function triggerScare(q){state.scares.push(q.id);save();if(!scares){subtitle('The signal changed. Something else is connected.');return;}sound.scare(q.type==='jump');if(q.type==='jump'){scareUntil=state.elapsed+.7;$('scare').hidden=false;}else if(q.type==='blackout'){darkUntil=state.elapsed+1.1;$('blackout').classList.add('active');subtitle('Something moved while the lights were out.');}else{let p=state.player;const positions=[[p.x-Math.sin(p.yaw)*4,p.z-Math.cos(p.yaw)*4],[p.x+Math.sin(p.yaw)*5,p.z+Math.cos(p.yaw)*5]];for(const [x,z]of positions)if(!solid(x,z)){world.entityAt(x,z,gameTime);break;}subtitle('That was not the fluorescent light.');}}
function progress(event,value){const result=act(state,event,value);hud();save();return result;}
function interact(){if(!entered||panel.open||finished||escapeAt!==null)return;const o=targetAt(state);if(!o)return;sound.click();
 if(o.id==='fuse'){
  openPanel('maintenance','01 / RECOVERED HARDWARE',state.fuse?'The maintenance tag.':'A fuse. Still warm.',`<p>A single cartridge is clipped inside the cabinet. Somebody has scratched a frequency into the metal.</p><div class="clue">SERVICE / 01 — 12V<br>MAINTENANCE CHANNEL: <strong>${config(state).frequency.toFixed(1)} MHz</strong></div><p>The service panel is down the west corridor, near where you entered.</p><button class="button acid" id="take-fuse">${state.fuse?'RETURN TO THE ROOM':'TAKE THE FUSE'} <span>↗</span></button>`);
  $('take-fuse').onclick=()=>{if(!state.fuse){progress('fuse');sound.success();planScare('first-presence',4,'presence');toast('FUSE RECOVERED · FREQUENCY ADDED TO FIELD NOTES');}closePanel();};
 }else if(o.id==='breaker'){
  openPanel('power','02 / SERVICE PANEL',state.power?'The hum is louder.':'One empty socket.',`<p>${state.power?'The receiver and archive circuits are live. There is a second rhythm under the hum.':'Everything is connected. Nothing is working. A 12V fuse is missing from the center socket.'}</p><div class="clue">${state.power?'POWER RESTORED / RADIO CIRCUIT ACTIVE':state.fuse?'COMPATIBLE CARTRIDGE IN INVENTORY':'MISSING: 12V MAINTENANCE FUSE'}</div><button class="button acid" id="restore-power">${state.power?'RETURN TO THE ROOM':state.fuse?'INSERT FUSE / RESTORE POWER':'RETURN / FIND THE FUSE'} <span>↗</span></button>`);
  $('restore-power').onclick=()=>{if(!state.power&&state.fuse){progress('power');sound.success();planScare('power-drop',1.5,'blackout');subtitle('Power restored. Find the receiver. It is already playing.');}closePanel();};
 }else if(o.id==='radio')radioPanel();
 else if(o.id==='disk'){
  openPanel('disk','03 / RECOVERED STORAGE','It says “HOME.”',`<img class="item-art" src="assets/floppy.gif" alt="Corrupted floppy disk"><p>Under the label is another word: <em>NOT YOURS.</em> A scratch on the back matches the reader on door 000.</p><div class="clue">2MB / ACCESS MEDIA<br>READER: DOOR 000</div><button class="button acid" id="take-disk">${state.disk?'RETURN TO THE ROOM':'TAKE THE DISK'} <span>↗</span></button>`);
  $('take-disk').onclick=()=>{if(!state.disk){progress('disk');sound.success();toast('DISK RECOVERED · ADDED TO FIELD NOTES');planScare('archive-observer',2.5,'presence');}closePanel();};
 }else if(o.id==='observer'){
  progress('observer');openPanel('observer','04 / SURVEILLANCE ARCHIVE','That is not a recording.',`<img class="item-art" src="assets/brainrot.gif" alt="Cyber skull on a surveillance feed"><p>The camera is pointing at this room. The footage is dated tomorrow.</p><div class="clue">CAMERA 000<br>OCCUPANT: YOU<br>STATUS: STILL HERE</div><p>A trace has been saved in your field notes.</p>`);
 }else if(o.id==='note'){
  progress('note');openPanel('page','05 / DISCARDED PAGE','The music changed.',`<div class="clue">I counted the lights for three days.<br>They hum in time with the music.<br>When the music changes,<br>something has heard you.<br><br>— M.</div><p>This trace is now in your field notes.</p>`);
 }else if(o.id==='false-exit'){
  openPanel('exit','EMERGENCY ACCESS / UNVERIFIED','It looks like an exit.',`<p>There is daylight under the door. But the light is the wrong color.</p><div class="clue">EMERGENCY EXIT<br>RETURN ADDRESS: UNKNOWN</div><button class="button acid" id="false-exit-open">OPEN THE DOOR <span>↗</span></button>`);
  $('false-exit-open').onclick=()=>{closePanel();progress('false-exit');darkUntil=state.elapsed+1.2;$('blackout').classList.add('active');planScare('false-exit',.3,'jump');subtitle('You have been here before. Your progress is intact.',7000);};
 }else if(o.id==='door')doorPanel();
}
function radioPanel(){
 if(!state.power){openPanel('receiver','RECEIVER / NO POWER','Dead air.',`<p>The dial moves. Nothing answers.</p><div class="clue">POWER CIRCUIT OPEN<br>RESTORE SERVICE / 01</div>`);return;}
 if(state.signal){const c=config(state);openPanel('transmission','RECOVERED TRANSMISSION','Someone answered.',`<p>“The disk is in the archive. Find the door marked 000. The red exit only brings you back.”</p><div class="clue">LAST OPERATOR ACCESS: <strong>${c.code}</strong><br>LOCATION: SOUTH CORRIDOR / EAST END</div><p>The message is saved in your field notes.</p>`);return;}
 openPanel('receiver','02 / PIRATE FREQUENCY','Find the voice.',`<p>The maintenance tag had a frequency. Your field notes remember it.</p><div class="radio-readout"><strong id="frequency-readout">${radioValue.toFixed(1)}</strong><small>MHz / UNLISTED BAND</small><div class="radio-bars">${'<i></i>'.repeat(31)}</div></div><label class="slider-label" for="frequency"><span>TUNE RECEIVER</span><span>88.0 — 108.0</span></label><input id="frequency" type="range" min="88" max="108" step="0.1" value="${radioValue}" aria-label="Radio frequency"><p class="panel-status" id="radio-status" role="status">STATIC / NO CARRIER</p><button class="button acid" id="lock-signal">LOCK FREQUENCY <span>↗</span></button>`);
 $('frequency').oninput=e=>{radioValue=Number(e.target.value);$('frequency-readout').textContent=radioValue.toFixed(1);const d=Math.abs(radioValue-config(state).frequency);$('radio-status').textContent=d<.06?'CARRIER FOUND / VOICE DETECTED':d<.6?'WEAK CARRIER / KEEP TUNING':'STATIC / NO CARRIER';panel.querySelectorAll('.radio-bars i').forEach((bar,i)=>bar.style.background=d<.06?'#c4fd50':i<Math.max(0,31-d*12)?'#90ac52':'#46582d');sound.tune(d);};
 $('lock-signal').onclick=()=>{if(progress('radio',radioValue)==='SIGNAL LOCKED'){sound.success();planScare('radio-answer',2.4,'jump');radioPanel();}else{$('radio-status').textContent='NO VOICE AT THIS FREQUENCY. CHECK THE MAINTENANCE TAG.';sound.click();}};
}
function doorPanel(){
 const need=!state.power?'RESTORE THE POWER':!state.disk?'RECOVER THE DISK FROM THE ARCHIVE':!state.signal?'DECODE THE RADIO TRANSMISSION':null;
 if(need){openPanel('sealed','DOOR 000 / ACCESS CONTROL','The door knows you.',`<p>The reader is waiting. The door will not respond until the recovery sequence is complete.</p><div class="clue">${need}</div><p>Your field notes contain a hint for the next step.</p>`);return;}
 doorCode='';openPanel('door','DOOR 000 / ACCESS CONTROL','Last operator?',`<p>The disk fits. A three-digit terminal wakes up. Use the code from the radio transmission.</p><div class="keypad-display" id="code-display" aria-live="polite">_ _ _</div><div class="keypad">${['1','2','3','4','5','6','7','8','9','←','0','↵'].map(k=>`<button data-digit="${k}" aria-label="${k==='←'?'Delete digit':k==='↵'?'Submit code':'Digit '+k}">${k}</button>`).join('')}</div><p class="panel-status" id="code-status" role="status">DISK ACCEPTED / AWAITING CODE</p>`);
 panel.querySelectorAll('[data-digit]').forEach(b=>b.onclick=()=>keypad(b.dataset.digit));
}
function keypad(k){if(k==='←'){doorCode=doorCode.slice(0,-1);}else if(k==='↵'){
 if(doorCode.length!==3){$('code-status').textContent='ENTER ALL THREE DIGITS.';return;}
 const result=progress('door',doorCode);if(result==='ACCESS GRANTED'){closePanel();escapeAt=state.elapsed;sound.success();subtitle('The door was never locked from this side.',3500);keys.clear();return;}
 wrongCodes++;$('code-status').textContent=wrongCodes>1?'ACCESS DENIED. THE RADIO CODE IS IN YOUR FIELD NOTES.':'ACCESS DENIED / TRY THE LAST OPERATOR CODE.';doorCode='';sound.click();
 }else if(doorCode.length<3){doorCode+=k;sound.click();}
 if($('code-display'))$('code-display').textContent=(doorCode+'___').slice(0,3).split('').join(' ');
}
function mapMarkup(){const cells=MAP.map((row,z)=>[...row].map((v,x)=>v==='0'?`<rect x="${x*12}" y="${z*12}" width="11" height="11" fill="#35462a"/>`:'').join('')).join('');const dots=objects(state).map(o=>`<circle cx="${o.x/TILE*12}" cy="${o.z/TILE*12}" r="2" fill="${o.id==='door'?'#e977bd':'#93aa6f'}"/>`).join('');return `<svg viewBox="0 0 204 180" role="img" aria-label="Floorplan. You are the green dot. The pink dot is door zero." style="display:block;width:100%;max-height:240px;background:#10170b;margin-top:16px">${cells}${dots}<circle cx="${state.player.x/TILE*12}" cy="${state.player.z/TILE*12}" r="3" fill="#c4fd50"/></svg><p style="font-size:9px;margin-top:10px">GREEN: YOU · PINK: DOOR 000 · TOP: NORTH</p>`;}
function journal(){const notes=noteContents(state);openPanel('notes','RECOVERED MATERIAL / '+state.notes.length+' OF 5','Your field notes.',`<div class="notes-list">${state.notes.length?state.notes.map(id=>`<div class="note"><span>${notes[id][0]}</span><p>${notes[id][1]}</p></div>`).join(''):'<p>No traces recovered yet. Inspect the objects in the room. Useful clues are saved here automatically.</p>'}</div><details class="journal-hint"><summary>STUCK? REVEAL A DIRECTION ↗</summary><p>${hint(state)}</p></details><details class="journal-hint"><summary>UNFOLD THE RECOVERED FLOORPLAN ↗</summary>${mapMarkup()}</details>`);}
function pause(){if(!entered||finished)return;const saved=save();openPanel('pause','SESSION PAUSED / '+(saved?'CHECKPOINT SAVED':'LOCAL SAVE UNAVAILABLE'),'Still here.',`<p>WASD to walk. Arrow keys to turn. Drag to look. E to inspect. J opens your notes. On touch screens, use the movement pad and drag the view.</p><label class="slider-label" for="master-volume"><span>MASTER VOLUME</span><span id="volume-label">${Math.round(volume*100)}%</span></label><input id="master-volume" type="range" min="0" max="100" value="${volume*100}" aria-label="Master volume"><div class="settings-row"><span>Sudden scares</span><button id="scares-setting">${scares?'ON':'LOW INTENSITY'}</button></div><div class="settings-row"><span>Camera motion / texture</span><button id="motion-setting">${lowMotion?'REDUCED':'FULL'}</button></div><button class="button acid" id="resume-button">RETURN TO THE ROOM <span>↗</span></button><button class="secondary-button" id="restart-button">START A NEW LOOP</button>`);
 $('master-volume').oninput=e=>{volume=Number(e.target.value)/100;$('volume-label').textContent=Math.round(volume*100)+'%';sound.setVolume(volume);saveSettings();};
 $('scares-setting').onclick=()=>{scares=!scares;$('scares-setting').textContent=scares?'ON':'LOW INTENSITY';saveSettings();};
 $('motion-setting').onclick=()=>{lowMotion=!lowMotion;document.body.classList.toggle('low-motion',lowMotion);$('motion-setting').textContent=lowMotion?'REDUCED':'FULL';saveSettings();};
 $('resume-button').onclick=async()=>{closePanel();if(!sound.active)try{await sound.start();}catch{}};
 $('restart-button').onclick=()=>{openPanel('restart','RESET SESSION','Start another loop?',`<p>Your current run will be replaced. The new room has a different frequency and operator code.</p><button class="button acid" id="confirm-restart">START NEW LOOP <span>↗</span></button><button class="secondary-button" id="keep-run">KEEP THIS RUN</button>`);$('confirm-restart').onclick=newLoop;$('keep-run').onclick=pause;};
}
function newLoop(){state=createState((state.seed+1)%4);save();location.reload();}
function finish(){finished=true;save();$('game-hud').hidden=true;$('ending').hidden=false;$('blackout').classList.remove('active');$('end-time').textContent=timeText(state.elapsed);$('end-notes').textContent=state.notes.length+' / 5';$('end-loops').textContent=state.loops;sound.duck(true);$('replay-button').focus();}
$('replay-button').onclick=newLoop;$('interact').onclick=interact;$('journal-button').onclick=journal;$('pause-button').onclick=pause;document.querySelector('.brand').onclick=e=>{e.preventDefault();if(entered)pause();};
const movement={w:'forward',s:'back',a:'left',d:'right',ArrowUp:'forward',ArrowDown:'back',ArrowLeft:'turnLeft',ArrowRight:'turnRight'};
addEventListener('keydown',e=>{
 if(!entered){if(e.key==='Enter'&&!e.repeat){e.preventDefault();enter();}return;}
 if(panel.open){if(panel.dataset.kind==='door'){if(/^\d$/.test(e.key)){e.preventDefault();keypad(e.key);}if(e.key==='Backspace'){e.preventDefault();keypad('←');}if(e.key==='Enter'&&e.target===document.body){e.preventDefault();keypad('↵');}}return;}
 if(finished)return;const k=e.key.toLowerCase(),move=movement[e.key]||movement[k];if(move){e.preventDefault();keys.add(move);}if(k==='shift')keys.add('fast');if(!e.repeat){if(k==='e'){e.preventDefault();interact();}if(k==='j')journal();if(e.key==='Escape'){e.preventDefault();pause();}}
});
addEventListener('keyup',e=>{keys.delete(movement[e.key]||movement[e.key.toLowerCase()]);if(e.key==='Shift')keys.delete('fast');});
canvas.addEventListener('pointerdown',e=>{if(!entered||panel.open||finished)return;drag={x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId);});
canvas.addEventListener('pointermove',e=>{if(!drag)return;state.player.yaw+=(e.clientX-drag.x)*.0038;state.player.pitch=Math.max(-.65,Math.min(.65,(state.player.pitch||0)-(e.clientY-drag.y)*.0028));drag={x:e.clientX,y:e.clientY};});
const release=()=>drag=null;canvas.addEventListener('pointerup',release);canvas.addEventListener('pointercancel',release);canvas.addEventListener('lostpointercapture',release);
document.querySelectorAll('[data-move]').forEach(b=>{b.addEventListener('pointerdown',e=>{e.preventDefault();if(!entered||panel.open)return;b.setPointerCapture(e.pointerId);keys.add(b.dataset.move);b.classList.add('held');});const up=()=>{keys.delete(b.dataset.move);b.classList.remove('held');};b.addEventListener('pointerup',up);b.addEventListener('pointercancel',up);b.addEventListener('lostpointercapture',up);});
addEventListener('blur',()=>{keys.clear();drag=null;});
document.addEventListener('visibilitychange',()=>{keys.clear();drag=null;if(document.hidden&&entered&&!finished){save();sound.suspend();if(!panel.open)pause();}});addEventListener('pagehide',save);addEventListener('resize',()=>world?.resize());
function frame(now){requestAnimationFrame(frame);const realDt=Math.min(1,(now-last)/1000),dt=Math.min(.1,realDt);last=now;if(!world||document.hidden)return;gameTime+=realDt;let moving=false;
 if(entered&&!panel.open&&!finished){
  state.elapsed+=realDt;
  if(escapeAt===null){const p=state.player;const turn=(keys.has('turnRight')?1:0)-(keys.has('turnLeft')?1:0);p.yaw+=turn*dt*1.65;const f=(keys.has('forward')?1:0)-(keys.has('back')?1:0),s=(keys.has('right')?1:0)-(keys.has('left')?1:0);const mag=Math.hypot(f,s)||1,speed=(keys.has('fast')?3.4:2.25)*dt;const dx=(Math.sin(p.yaw)*f+Math.cos(p.yaw)*s)/mag*speed,dz=(Math.cos(p.yaw)*f-Math.sin(p.yaw)*s)/mag*speed;const x=p.x,z=p.z;movePlayer(p,dx,dz);const distance=Math.hypot(p.x-x,p.z-z);moving=distance>.001;moved+=distance;if(moved>.85){sound.footstep();moved=0;}
   currentTarget=targetAt(state);$('interact').hidden=!currentTarget;if(currentTarget)$('interact-label').textContent=currentTarget.label;document.body.classList.toggle('targeting',!!currentTarget);
  }else{if(state.elapsed-escapeAt>1.3)$('blackout').classList.add('active');if(state.elapsed-escapeAt>3.1)finish();}
  for(const q of queue.filter(q=>q.at<=state.elapsed)){triggerScare(q);queue=queue.filter(x=>x!==q);}
  if(scareUntil&&state.elapsed>scareUntil){$('scare').hidden=true;scareUntil=0;}
  if(darkUntil&&state.elapsed>darkUntil){darkUntil=0;$('blackout').classList.remove('active');}
  if(state.elapsed-lastSave>8){save();lastSave=state.elapsed;}
 }
 $('elapsed').textContent=timeText(state.elapsed);$('coordinates').textContent=(state.player.x/TILE).toFixed(2)+' / '+(state.player.z/TILE).toFixed(2);
 const view=entered?state.player:{...START,yaw:Math.PI/2-.11+(lowMotion?0:Math.sin(gameTime*.13)*.025),pitch:0};world.render(view,gameTime,{moving,lowMotion,dark:darkUntil>state.elapsed,escape:escapeAt!==null?state.elapsed-escapeAt:0});
}
async function initialize(){try{const {World}=await import('./world.js');world=new World(canvas,state);ready=true;$('enter-button').disabled=false;$('enter-text').textContent=stored&&!stored.escaped&&(stored.elapsed>0||stored.notes.length)?'RESUME THE TRANSMISSION':'ENTER THE BACKROOMS';$('enter-shortcut').textContent='PRESS ENTER / TAP TO CONNECT';requestAnimationFrame(frame);}catch(error){console.error('Environment initialization failed',error);$('enter-error')?.removeAttribute('hidden');$('entry-error').hidden=false;$('enter-text').textContent='SIGNAL INTERRUPTED';$('enter-shortcut').textContent='This experience requires WebGL.';}}
initialize();
