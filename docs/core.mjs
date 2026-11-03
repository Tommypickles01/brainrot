export const TILE=3;
const grid=Array.from({length:15},()=>Array(17).fill(1));
function carve(x0,z0,x1,z1){for(let z=z0;z<=z1;z++)for(let x=x0;x<=x1;x++)grid[z][x]=0;}
carve(1,1,11,1);carve(1,1,1,13);carve(4,1,6,4);carve(1,5,13,5);carve(6,5,8,7);carve(10,3,13,5);carve(13,5,13,13);carve(1,13,15,13);carve(4,8,10,10);carve(6,5,6,13);
export const MAP=grid.map(row=>row.join(''));
export const START={x:4.5,z:4.5,yaw:Math.PI/2,pitch:0};
export const FREQUENCIES=[93.7,101.3,96.5,88.9];
export const CODES=['731','419','862','593'];
export function createState(seed=Date.now()%4){return{version:2,seed:Math.abs(seed|0)%4,player:{...START},fuse:false,power:false,signal:false,disk:false,escaped:false,notes:[],scares:[],elapsed:0,loops:0};}
export function config(state){return{frequency:FREQUENCIES[state.seed],code:CODES[state.seed]};}
export function objects(state){return[
 {id:'fuse',label:state.fuse?'READ MAINTENANCE TAG':'RECOVER MAINTENANCE FUSE',x:(state.seed%2?5.5:4.5)*TILE,z:1.14*TILE,yaw:0},
 {id:'breaker',label:state.power?'INSPECT POWER PANEL':'RESTORE POWER',x:1.14*TILE,z:5.5*TILE,yaw:Math.PI/2},
 {id:'radio',label:'TUNE PIRATE FREQUENCY',x:8.72*TILE,z:6.5*TILE,yaw:-Math.PI/2},
 {id:'disk',label:state.disk?'READ DISK LABEL':'RECOVER CORRUPTED DISK',x:(state.seed%2?11.5:12.5)*TILE,z:3.14*TILE,yaw:0},
 {id:'observer',label:'INSPECT OBSERVER FEED',x:10.14*TILE,z:4.3*TILE,yaw:Math.PI/2},
 {id:'note',label:'READ DISCARDED PAGE',x:9.5*TILE,z:10.72*TILE,yaw:Math.PI},
 {id:'false-exit',label:'OPEN EMERGENCY EXIT',x:1.14*TILE,z:13.5*TILE,yaw:Math.PI/2},
 {id:'door',label:'ACCESS DOOR 000',x:15.85*TILE,z:13.5*TILE,yaw:-Math.PI/2}
];}
export function solid(x,z){return MAP[Math.floor(z/TILE)]?.[Math.floor(x/TILE)]!=='0';}
export function movePlayer(player,dx,dz){const r=.24;const valid=(x,z)=>!solid(x-r,z-r)&&!solid(x+r,z-r)&&!solid(x-r,z+r)&&!solid(x+r,z+r);if(valid(player.x+dx,player.z))player.x+=dx;if(valid(player.x,player.z+dz))player.z+=dz;}
export function visibleBetween(x,z,tx,tz){const d=Math.hypot(tx-x,tz-z),steps=Math.ceil(d/.1);for(let i=1;i<steps;i++)if(solid(x+(tx-x)*i/steps,z+(tz-z)*i/steps))return false;return true;}
export function targetAt(state){const p=state.player,dx=Math.sin(p.yaw),dz=Math.cos(p.yaw);let best=null,bestScore=-Infinity;for(const o of objects(state)){const ox=o.x-p.x,oz=o.z-p.z,d=Math.hypot(ox,oz);if(d>2.55)continue;const dot=d<.2?1:(ox*dx+oz*dz)/d;if(dot<.44||!visibleBetween(p.x,p.z,o.x,o.z))continue;const score=dot-d*.15;if(score>bestScore){best=o;bestScore=score;}}return best;}
export function addNote(s,id){if(!s.notes.includes(id))s.notes.push(id);}
export function act(s,event,value){
 if(event==='fuse'){s.fuse=true;addNote(s,'maintenance');return 'FUSE RECOVERED';}
 if(event==='power'){if(!s.fuse)return 'FUSE REQUIRED';s.power=true;return 'POWER RESTORED';}
 if(event==='radio'){if(!s.power)return 'NO POWER';if(Math.abs(Number(value)-config(s).frequency)>.06)return 'NO SIGNAL';s.signal=true;addNote(s,'transmission');return 'SIGNAL LOCKED';}
 if(event==='disk'){s.disk=true;addNote(s,'disk');return 'DISK RECOVERED';}
 if(event==='observer'){addNote(s,'observer');return 'FEED RECOVERED';}
 if(event==='note'){addNote(s,'page');return 'PAGE RECOVERED';}
 if(event==='door'){if(!s.power)return 'NO POWER';if(!s.disk)return 'DISK REQUIRED';if(!s.signal)return 'SIGNAL REQUIRED';if(String(value)!==config(s).code)return 'ACCESS DENIED';s.escaped=true;return 'ACCESS GRANTED';}
 if(event==='false-exit'){s.loops++;s.player={...START};return 'YOU HAVE BEEN HERE BEFORE';}
 return 'UNKNOWN ACTION';
}
export function objective(s){if(!s.fuse)return['01 / NO SIGNAL','Restore the power.','Find the maintenance fuse.'];if(!s.power)return['01 / NO SIGNAL','Find the service panel.','Maintenance runs down the west corridor.'];if(!s.signal)return['02 / SOMETHING ANSWERED','Tune the receiver.','Follow the RADIO signs. Check your field notes.'];if(!s.disk)return['03 / THE WRONG EXIT','Recover the disk.','Search the archive east of the radio.'];return['04 / NO OUTSIDE','Find door 000.','Follow the south corridor. Ignore the red exit.'];}
export function hint(s){if(!s.fuse)return 'Walk straight down the first corridor. The fuse is in a wall cabinet on your left, beside the MAINTENANCE sign. Face it and press E or tap the prompt.';if(!s.power)return 'Return to the start of the first corridor. Turn left into the long passage. The service panel is on the west wall beside the SERVICE / 01 sign.';if(!s.signal)return `From the service panel, follow the corridor east to the RADIO sign. The receiver is in the alcove south of that junction. Your maintenance tag says ${config(s).frequency.toFixed(1)} MHz.`;if(!s.disk)return 'Return to the east-west corridor. Continue east, then turn north into ARCHIVE. The disk is on the shelf along the north wall.';return `Door 000 is at the far eastern end of the south corridor. The disk is its key. The radio gave you ${config(s).code}. The red emergency exit is a loop.`;}
export function noteContents(s){const c=config(s);return{
 maintenance:['01 / MAINTENANCE TAG',`12V cartridge. Insert into SERVICE / 01. Maintenance broadcasts on ${c.frequency.toFixed(1)} MHz. Somebody crossed out the word "emergency".`],
 transmission:['02 / PIRATE TRANSMISSION',`"If this is reaching you, the disk is in the archive. The last operator used ${c.code}. Find the door marked 000. The red exit only brings you back."`],
 disk:['03 / STORAGE MEDIUM','A 2MB disk labeled HOME. The label underneath says: NOT YOURS. Reader compatibility: DOOR 000.'],
 observer:['04 / OBSERVER FEED','The camera is pointing at this room. The footage is dated tomorrow. A figure on the monitor is wearing your clothes.'],
 page:['05 / DISCARDED PAGE','I counted the lights for three days. They hum in time with the music. When the music changes, something has heard you. — M.']
};}
export function restore(raw){try{const s=JSON.parse(raw);if(s.version!==2||!Number.isInteger(s.seed)||s.seed<0||s.seed>3||!s.player)return null;if(!Number.isFinite(s.player.x)||!Number.isFinite(s.player.z)||solid(s.player.x,s.player.z)||!Number.isFinite(s.player.yaw))return null;const n=createState(s.seed);for(const k of ['fuse','power','signal','disk','escaped'])n[k]=s[k]===true;n.notes=Array.isArray(s.notes)?s.notes.filter(x=>['maintenance','transmission','disk','observer','page'].includes(x)):[];n.scares=Array.isArray(s.scares)?s.scares.filter(x=>typeof x==='string'):[];n.player={x:s.player.x,z:s.player.z,yaw:s.player.yaw,pitch:0};n.elapsed=Number.isFinite(s.elapsed)?Math.max(0,s.elapsed):0;n.loops=Number.isInteger(s.loops)?Math.max(0,s.loops):0;if(n.signal&&!n.power)return null;if(n.power&&!n.fuse)return null;return n;}catch{return null;}}
