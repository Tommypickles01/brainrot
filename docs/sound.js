export class Sound {
 constructor(){this.ctx=null;this.volume=.35;this.muted=false;this.stage=0;this.next=0;this.step=0;this.timer=null;this.active=false;this.ducked=false;}
 init(){
  if(this.ctx)return;this.ctx=new(window.AudioContext||window.webkitAudioContext)();const c=this.ctx;
  this.bus=c.createGain();this.bus.gain.value=.65;this.filter=c.createBiquadFilter();this.filter.type='lowpass';this.filter.frequency.value=3800;
  this.limiter=c.createDynamicsCompressor();Object.assign(this.limiter.threshold,{value:-17});this.limiter.knee.value=12;this.limiter.ratio.value=12;this.limiter.attack.value=.003;this.limiter.release.value=.18;
  this.master=c.createGain();this.master.gain.value=this.volume*.6;this.bus.connect(this.filter).connect(this.limiter).connect(this.master).connect(c.destination);
  this.delay=c.createDelay(.8);this.delay.delayTime.value=60/152*.75;this.echo=c.createGain();this.echo.gain.value=.18;this.feedback=c.createGain();this.feedback.gain.value=.28;this.delay.connect(this.echo).connect(this.bus);this.delay.connect(this.feedback).connect(this.delay);
  this.noiseBuffer=c.createBuffer(1,c.sampleRate,c.sampleRate);const b=this.noiseBuffer.getChannelData(0);for(let i=0;i<b.length;i++)b[i]=Math.random()*2-1;
  for(const f of [55,110.3]){const osc=c.createOscillator(),g=c.createGain();osc.type='sine';osc.frequency.value=f;g.gain.value=f<60?.035:.012;osc.connect(g).connect(this.bus);osc.start();}
 }
 async start(){this.init();await this.ctx.resume();this.active=true;this.next=this.ctx.currentTime+.04;clearInterval(this.timer);this.schedule();this.timer=setInterval(()=>this.schedule(),30);this.updateGain();}
 async suspend(){clearInterval(this.timer);this.active=false;if(this.ctx)await this.ctx.suspend();}
 updateGain(){if(this.master)this.master.gain.setTargetAtTime(this.muted?0:this.volume*.6*(this.ducked?.65:1),this.ctx.currentTime,.1);}
 setVolume(v){this.volume=v;this.updateGain();}
 mute(v){this.muted=v;this.updateGain();}
 duck(v){this.ducked=v;this.updateGain();}
 setStage(v){this.stage=v;if(this.filter)this.filter.frequency.setTargetAtTime(3600+v*900,this.ctx.currentTime,.5);}
 tone(midi,time,length,type='sine',volume=.05,detune=0,echo=false){const c=this.ctx,o=c.createOscillator(),g=c.createGain();o.type=type;o.frequency.value=440*2**((midi-69)/12);o.detune.value=detune;g.gain.setValueAtTime(.0001,time);g.gain.exponentialRampToValueAtTime(Math.max(.0002,volume),time+.012);g.gain.exponentialRampToValueAtTime(.0001,time+length);o.connect(g).connect(this.bus);if(echo)g.connect(this.delay);o.start(time);o.stop(time+length+.03);o.onended=()=>{o.disconnect();g.disconnect();};}
 noise(time,length,frequency,volume,type='highpass'){const c=this.ctx,n=c.createBufferSource(),f=c.createBiquadFilter(),g=c.createGain();n.buffer=this.noiseBuffer;f.type=type;f.frequency.value=frequency;g.gain.setValueAtTime(volume,time);g.gain.exponentialRampToValueAtTime(.0001,time+length);n.connect(f).connect(g).connect(this.bus);n.start(time);n.stop(time+length+.02);n.onended=()=>{n.disconnect();f.disconnect();g.disconnect();};}
 kick(time){const c=this.ctx,o=c.createOscillator(),g=c.createGain();o.frequency.setValueAtTime(140,time);o.frequency.exponentialRampToValueAtTime(42,time+.13);g.gain.setValueAtTime(.55,time);g.gain.exponentialRampToValueAtTime(.0001,time+.26);o.connect(g).connect(this.bus);o.start(time);o.stop(time+.28);o.onended=()=>{o.disconnect();g.disconnect();};}
 schedule(){if(!this.active||this.ctx.state!=='running')return;const now=this.ctx.currentTime;if(this.next<now-.2)this.next=now+.03;const length=60/152/4,roots=[54,59,57,61],melody=[24,19,15,19,27,24,19,15,24,31,27,24,19,15,19,27];
  while(this.next<now+.12){const s=this.step%16,bar=Math.floor(this.step/16)%4,phrase=Math.floor(this.step/64)%4,r=roots[bar],t=this.next;
   if(s%4===0&&!(phrase===3&&s===12))this.kick(t);
   if(s===4||s===12){this.noise(t,.16,1900,.13,'bandpass');this.noise(t+.012,.09,6000,.055);}
   if(s%2===0)this.noise(t,s%4===2?.09:.035,8500,.035);
   if(s%2===0){this.tone(r-12,t+.03,length*1.75,'sine',.23);this.tone(r-12,t+.03,length*1.4,'sawtooth',.025);}
   if(s%2===0||this.stage>1){this.tone(r+melody[s],t+.01,length*1.45,'triangle',.045,8,true);this.tone(r+melody[s],t+.01,length*1.4,'sine',.035,-8,true);if(this.stage>0)this.tone(r+melody[s],t+.013,length,'sawtooth',.012,0,true);}
   if(s===0||s===8)[0,3,7].forEach((v,i)=>this.tone(r+v,t+i*.02,length*7,'triangle',.035,0,true));
   if(this.stage>1&&s===15)this.noise(t,.04,9000,.05);
   this.step++;this.next+=length;
  }
 }
 footstep(){if(this.active)this.noise(this.ctx.currentTime+.001,.13,240,.055,'lowpass');}
 success(){if(!this.active)return;const t=this.ctx.currentTime;[78,82,85].forEach((n,i)=>this.tone(n,t+i*.1,.4,'sine',.055,0,true));}
 click(){if(this.active)this.tone(90,this.ctx.currentTime+.001,.055,'sine',.035);}
 scare(strong=true){if(!this.active)return;const t=this.ctx.currentTime+.005;this.noise(t,strong?.7:.4,1200,strong?.19:.09,'bandpass');[31,32,43].forEach(n=>this.tone(n,t,.85,'sawtooth',strong?.055:.025));}
 tune(distance){if(!this.active)return;const t=this.ctx.currentTime+.001;this.noise(t,.08,2000,Math.min(.07,.01+distance*.008),'bandpass');if(distance<.15)this.tone(83,t,.13,'sine',.045);}
}
