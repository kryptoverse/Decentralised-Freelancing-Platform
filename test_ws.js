const WebSocket = require('ws');

const ws = new WebSocket('wss://testnet.spacetimedb.com/database/subscribe/worqs-a8jpe?token=mock');

ws.on('open', () => {
  console.log('Connected!');
  ws.send(JSON.stringify({ subscribe: ["SELECT * FROM ChatRoom", "SELECT * FROM Message"] }));
});

ws.on('message', (data) => {
  console.log('Received:', data.toString());
  ws.close();
});

ws.on('error', (err) => console.error(err));
