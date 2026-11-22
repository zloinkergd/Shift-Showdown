'use strict';
// SHIFT SHOWDOWN V59 — dependency-free proof-of-concept multiplayer server.
// Important: player movement is client-simulated; this is NOT cheat-resistant yet.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {performance} = require('node:perf_hooks');
const PORT = Math.max(1,Math.min(65535,Number(process.env.PORT)||3000));
const MAX_PLAYERS = Math.max(2,Math.min(6,Number(process.env.MAX_PLAYERS)||2));
const RACE_LIMIT = 200;
const COLORS = new Set(['purple','mint','coral','gold']);
const SHAPES = new Set(['block','puff','wedge']);
const FACES = new Set(['happy','focus','sleepy']);
const OUTFITS = new Set(['classic','racer','hoodie']);
const ALPHABET='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const rooms=new Map();
let uid=0;
const now=()=>performance.now();
const round=n=>Math.round(n*1000)/1000;
function code(){let c; do {c=''; for(let i=0;i<6;i++)c+=ALPHABET[crypto.randomInt(ALPHABET.length)];}while(rooms.has(c));return c;}
function name(v){return typeof v==='string' ? v.replace(/[^a-zA-Z0-9 _-]/g,'').trim().slice(0,16)||'PIXPATCH' : 'PIXPATCH';}
function jsonSend(c,obj){if(!c||c.closed)return; const payload=Buffer.from(JSON.stringify(obj)); if(payload.length>60000)return;const hd=Buffer.alloc(payload.length<126?2:4);hd[0]=0x81;if(payload.length<126)hd[1]=payload.length;else{hd[1]=126;hd.writeUInt16BE(payload.length,2);}try{c.socket.write(Buffer.concat([hd,payload]));}catch(e){leave(c);}}
function sendFrame(c,opcode,payload=Buffer.alloc(0)){if(c.closed)return;try{const h=Buffer.from([0x80|opcode,payload.length]);c.socket.write(Buffer.concat([h,payload]));}catch(e){leave(c);}}
function err(c,text){jsonSend(c,{type:'error',message:text});}
function players(room){return [...room.members].map(c=>({id:c.id,name:c.name,color:c.color,shape:c.shape,face:c.face,outfit:c.outfit,ready:c.ready,finished:!!c.finished,checkpoint:c.checkpoint}));}
function broadcast(room,obj){for(const c of room.members)jsonSend(c,obj);}
function lobby(room){broadcast(room,{type:'lobby',code:room.code,phase:room.phase,players:players(room),maxPlayers:MAX_PLAYERS});}
function leave(c){if(!c||c.leaving)return;c.leaving=true;let r=c.room;if(r){r.members.delete(c);c.room=null;if(r.phase==='racing'||r.phase==='countdown'){const entry=r.racers.find(x=>x.id===c.id);if(entry&&!entry.finish)entry.dnf=true;}if(r.members.size===0)rooms.delete(r.code);else {if(r.phase==='countdown'){r.phase='lobby';r.startAt=0;for(const x of r.members)x.ready=false;}lobby(r);}} c.leaving=false;}
function join(c,r,info){if(c.room)return err(c,'You are already in a room.');if(r.phase!=='lobby')return err(c,'That room is currently racing.');if(r.members.size>=MAX_PLAYERS)return err(c,'This room is full.');c.name=name(info.name);c.color=COLORS.has(info.color)?info.color:'purple';c.shape=SHAPES.has(info.shape)?info.shape:'block';c.face=FACES.has(info.face)?info.face:'happy';c.outfit=OUTFITS.has(info.outfit)?info.outfit:'classic';c.ready=false;c.finished=false;c.checkpoint=0;c.pos={x:0,y:0,z:-8,angle:0,slide:false,dive:false,grounded:true};c.lastPos=0;c.room=r;r.members.add(c);jsonSend(c,{type:'joined',id:c.id,code:r.code,maxPlayers:MAX_PLAYERS});lobby(r);}
function receive(c,m){if(!m||typeof m!=='object'||Array.isArray(m))return;const type=m.type;if(type==='ping'){return jsonSend(c,{type:'pong'});}
 if(type==='create'){if(c.room)return err(c,'Leave your current room before creating another.');if(rooms.size>=500)return err(c,'Too many active rooms. Try again later.');const r={code:code(),members:new Set(),phase:'lobby',startAt:0,racers:[],resultsAt:0};rooms.set(r.code,r);return join(c,r,m);}
 if(type==='join'){const r=rooms.get(String(m.code||'').toUpperCase().replace(/[^A-Z0-9]/g,''));if(!r)return err(c,'Room not found. Check the six-character code.');return join(c,r,m);}
 if(type==='leave'){leave(c);return jsonSend(c,{type:'left'});}
 const r=c.room;if(!r)return err(c,'Join a room first.');
 if(type==='ready'&&r.phase==='lobby'){c.ready=!!m.ready;lobby(r);if(r.members.size>=2&&[...r.members].every(x=>x.ready)){
   r.phase='countdown';r.startAt=now()+5000;r.racers=[...r.members].map(x=>({id:x.id,name:x.name,color:x.color,checkpoint:0,z:-8,finish:null,dnf:false}));for(const x of r.members){x.finished=false;x.checkpoint=0;x.pos={x:0,y:0,z:-8,angle:0,slide:false,dive:false,grounded:true};}broadcast(r,{type:'countdown',seconds:5});
 }return;}
 if(type==='position'&&r.phase==='racing'&&!c.finished){if(now()-c.lastPos<32)return;let values=['x','y','z','angle'];if(values.some(k=>typeof m[k]!=='number'||!Number.isFinite(m[k])))return;if(Math.abs(m.x)>150||m.y< -60||m.y>60||m.z< -30||m.z>350||Math.abs(m.angle)>100)return;
 c.lastPos=now();c.pos={x:round(m.x),y:round(m.y),z:round(m.z),angle:round(m.angle),slide:!!m.slide,dive:!!m.dive,grounded:!!m.grounded};return;}
 if(type==='checkpoint'&&r.phase==='racing'&&!c.finished){const n=Number(m.n);const targets=[0,48,92,131,190,238];if(!Number.isInteger(n)||n!==c.checkpoint+1||n>5)return;
 // The client reports exact contact coordinates; this is a prototype sanity check, not anticheat.
 if(typeof m.x!=='number'||typeof m.z!=='number'||!Number.isFinite(m.x)||!Number.isFinite(m.z)||Math.abs(m.x)>11.3||Math.abs(m.z-targets[n])>13)return;
 c.checkpoint=n;const rec=r.racers.find(x=>x.id===c.id);if(rec)rec.checkpoint=n;return;}
 if(type==='finish'&&r.phase==='racing'&&!c.finished){if(c.checkpoint!==5||typeof m.x!=='number'||typeof m.z!=='number'||!Number.isFinite(m.x)||!Number.isFinite(m.z)||m.z<312||Math.abs(m.x)>13.5||!c.pos||c.pos.z<306){return err(c,'Finish not validated. Reach checkpoints in order.');}const elapsed=(now()-r.startAt)/1000; if(elapsed<0||elapsed>RACE_LIMIT+2)return;c.finished=true;const rec=r.racers.find(x=>x.id===c.id);if(rec)rec.finish=round(elapsed);jsonSend(c,{type:'finished',time:round(elapsed)});return;}
 if(type==='rematch'&&r.phase==='results'){r.phase='lobby';r.startAt=0;r.racers=[];for(const x of r.members){x.ready=false;x.finished=false;x.checkpoint=0;x.pos={x:0,y:0,z:-8,angle:0,slide:false,dive:false,grounded:true};}lobby(r);return;}
}
function results(r){if(r.phase==='results')return;r.phase='results';const ranked=r.racers.map(x=>({...x})).sort((a,b)=>{if(a.finish!==null&&b.finish===null)return -1;if(a.finish===null&&b.finish!==null)return 1;if(a.finish!==null&&b.finish!==null)return a.finish-b.finish;return b.checkpoint-a.checkpoint||b.z-a.z;});broadcast(r,{type:'results',code:r.code,placements:ranked.map((x,i)=>({place:i+1,id:x.id,name:x.name,color:x.color,time:x.finish,dnf:x.dnf,checkpoint:x.checkpoint}))});}
const TYPES={'/':'text/html; charset=utf-8','/health':'application/json; charset=utf-8'};
const server=http.createServer((req,res)=>{
 let pathname;try{pathname=new URL(req.url,'http://localhost').pathname;}catch(_){res.writeHead(400);return res.end('Invalid URL');}
 if(req.method!=='GET'||!TYPES[pathname]){res.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'});return res.end('Not found');}
 if(pathname==='/health'){res.writeHead(200,{'Content-Type':TYPES['/health'],'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});return res.end(JSON.stringify({ok:true,version:'V59',rooms:rooms.size,maxPlayers:MAX_PLAYERS}));}
 fs.readFile(path.join(__dirname,'index.html'),(e,html)=>{if(e){res.writeHead(500);res.end('index.html missing');return;}res.writeHead(200,{'Content-Type':TYPES['/'],'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','X-Frame-Options':'DENY'});res.end(html);});
});
server.on('upgrade',(req,socket,head)=>{
 if(req.url!=='/ws'||req.headers.upgrade?.toLowerCase()!=='websocket'||typeof req.headers['sec-websocket-key']!=='string')return socket.destroy();
 const origin=req.headers.origin; if(origin){try{const o=new URL(origin);if(o.host!==req.headers.host)return socket.destroy();}catch(e){return socket.destroy();}}
 const key=req.headers['sec-websocket-key'];if(Buffer.from(key,'base64').length!==16)return socket.destroy();
 const accept=crypto.createHash('sha1').update(key+'258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
 socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: '+accept+'\r\n\r\n');
 const c={socket,id:String(++uid),room:null,closed:false,lastPos:0,lastMessage:0,name:'PIXPATCH',color:'purple',shape:'block',face:'happy',outfit:'classic',ready:false,finished:false,checkpoint:0,pos:null,buffer:Buffer.alloc(0),fragment:null};
 const cleanup=()=>{if(c.closed)return;c.closed=true;leave(c);};socket.on('close',cleanup);socket.on('error',cleanup);socket.setNoDelay(true);
 socket.on('data',chunk=>{if(c.closed)return;c.buffer=Buffer.concat([c.buffer,chunk]);if(c.buffer.length>16384)return socket.destroy();while(c.buffer.length>=2){const b=c.buffer;const fin=!!(b[0]&128),op=b[0]&15,masked=!!(b[1]&128);let len=b[1]&127,off=2;
   if(len===126){if(b.length<4)break;len=b.readUInt16BE(2);off=4;}else if(len===127){if(b.length<10)break;const high=b.readUInt32BE(2),low=b.readUInt32BE(6);if(high!==0||low>4096)return socket.destroy();len=low;off=10;}
   if(!masked||len>4096)return socket.destroy();if(b.length<off+4+len)break;const mask=b.subarray(off,off+4);let payload=Buffer.from(b.subarray(off+4,off+4+len));for(let i=0;i<len;i++)payload[i]^=mask[i%4];c.buffer=b.subarray(off+4+len);
   if(op===8){sendFrame(c,8);return socket.end();}if(op===9){sendFrame(c,10,payload.subarray(0,125));continue;}if(op===10)continue;
   if(op===0){if(!c.fragment)return socket.destroy();c.fragment.push(payload);if(!fin)continue;payload=Buffer.concat(c.fragment);c.fragment=null;}
   else if(op===1){if(!fin){c.fragment=[payload];continue;}}
   else return socket.destroy();
   if(payload.length>4096)return socket.destroy();let message;try{message=JSON.parse(payload.toString('utf8'));}catch(e){continue;}
   receive(c,message);
 } });if(head.length)socket.emit('data',head);
});
setInterval(()=>{for(const r of rooms.values()){
  const n=now();if(r.phase==='countdown'&&n>=r.startAt){r.phase='racing';broadcast(r,{type:'start'});}
  if(r.phase!=='racing'&&r.phase!=='countdown')continue;
  let elapsed=round((n-r.startAt)/1000);if(r.phase==='racing'){
    for(const c of r.members){const rec=r.racers.find(x=>x.id===c.id);if(rec&&c.pos){rec.checkpoint=c.checkpoint;rec.z=c.pos.z;}}
    if(elapsed>=RACE_LIMIT||r.racers.every(x=>x.finish!==null||x.dnf)){results(r);continue;}
  }
  broadcast(r,{type:'snapshot',phase:r.phase,elapsed,players:[...r.members].map(c=>({id:c.id,name:c.name,color:c.color,shape:c.shape,face:c.face,outfit:c.outfit,ready:c.ready,finished:c.finished,checkpoint:c.checkpoint,...c.pos}))});
}},100).unref();
server.listen(PORT,'0.0.0.0',()=>console.log(`SHIFT SHOWDOWN V59 on http://localhost:${PORT} — limit ${MAX_PLAYERS} players/room`));
