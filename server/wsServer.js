const { WebSocketServer } = require('ws');
const fs = require('fs');
const path = require('path');

const PORT = 8080;
const wss = new WebSocketServer({ port: PORT });
const attacksPath = path.join(__dirname, '../data/attacks.json');

let attacks = [];
try {
  const data = fs.readFileSync(attacksPath, 'utf8');
  attacks = JSON.parse(data);
  console.log(`Loaded ${attacks.length} attacks from data/attacks.json`);
} catch (e) {
  console.error("Could not load attacks.json.", e);
  process.exit(1);
}

let currentIndex = 0;
const REPLAY_INTERVAL_MS = 1500;

console.log(`WebSocket server started on ws://localhost:${PORT}`);

wss.on('connection', (ws) => {
  ws.isPaused = false;
  
  // Burst initial 8 events so globe isn't empty
  for(let i=0; i<8; i++) {
    const burstEvent = { 
      ...attacks[(currentIndex + i) % attacks.length], 
      timestamp: new Date(Date.now() - (8-i)*2000).toISOString() 
    };
    ws.send(JSON.stringify({ type: 'attack', data: burstEvent }));
  }
  currentIndex = (currentIndex + 8) % attacks.length;

  ws.on('message', (message) => {
    try {
      const parsed = JSON.parse(message.toString('utf8'));
      if (parsed.type === 'pause') {
        ws.isPaused = true;
        console.log("Client paused stream");
      }
      if (parsed.type === 'resume') {
        ws.isPaused = false;
        console.log("Client resumed stream");
      }
    } catch(e) {
      console.error("Message parse error:", e);
    }
  });
});

setInterval(() => {
  const event = attacks[currentIndex];
  event.timestamp = new Date().toISOString();
  const message = JSON.stringify({ type: 'attack', data: event });
  
  let sent = false;
  wss.clients.forEach(client => {
    if (client.readyState === 1 && !client.isPaused) {
      client.send(message);
      sent = true;
    }
  });

  if (sent) {
    currentIndex = (currentIndex + 1) % attacks.length;
  }
}, REPLAY_INTERVAL_MS);
