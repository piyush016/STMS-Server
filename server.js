const express = require('express');
const cors = require('cors');
const http = require('http');
const socketIO = require('socket.io');
const axios = require('axios');

const app = express();

app.use(cors());

const server = http.createServer(app);
const io = socketIO(server, {
  cors: {
    origin: '*', // Replace with your frontend origin
    methods: ['GET', 'POST'],
  },
});

const GOOGLE_MAPS_API_KEY = 'AIzaSyDbenMSdy2YMf5GAQxlCIqwUA-O6wbeimE';

// Store the active routes and their associated socket IDs
const activeRoutes = {};

app.get('/directions', async (req, res) => {
  const { origin, destination, isEmergency } = req.query;
  const directionsAPI = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin}&destination=${destination}&key=${GOOGLE_MAPS_API_KEY}`;

  try {
    const response = await axios.get(directionsAPI);
    const data = response.data;
    res.json(data);

    if (isEmergency === 'true') {
      // Get the socket IDs of users on the same route
      const socketIds = activeRoutes[`${origin}_${destination}`];
      io.emit('emergency', { origin, destination });

      console.log('Emergency Vehicle Information:');
      console.log('Origin:', origin);
      console.log('Destination:', destination);
      
      if (socketIds) {
        // Emit an emergency event to users on the same route
        socketIds.forEach(socketId => {
          io.to(socketId).emit('emergencyAlert', { origin, destination });
        });
      }
    }
  } catch (error) {
    console.error('Error fetching directions:', error.message);
    res.status(500).json({ error: 'Error fetching directions' });
  }
});


io.on('connection', (socket) => {
  console.log('A user connected');

  socket.on('joinRoute', ({ origin, destination }) => {
    // Generate a unique route identifier
    const routeId = `${origin}_${destination}`;

    // Store the socket ID in the activeRoutes object for the corresponding route
    if (!activeRoutes[routeId]) {
      activeRoutes[routeId] = [socket.id];
    } else {
      activeRoutes[routeId].push(socket.id);
    }
  });

  socket.on('disconnect', () => {
    console.log('A user disconnected');

    // Remove the socket ID from the activeRoutes object when a user disconnects
    for (const routeId in activeRoutes) {
      const index = activeRoutes[routeId].indexOf(socket.id);
      if (index > -1) {
        activeRoutes[routeId].splice(index, 1);
      }
    }
  });
});

const port = process.env.PORT || 3000;
server.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
