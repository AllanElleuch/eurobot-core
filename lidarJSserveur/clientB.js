console.log('1');
// Connect to server
var io = require('socket.io-client');
var socket = io.connect('http://localhost:8080', {reconnect: true});

console.log('2');

// Add a connect listener
socket.on('connect', function(data) {
  console.log('Connected!');
  socket.emit('data',{ hello: 'world' });
});

console.log('3');
