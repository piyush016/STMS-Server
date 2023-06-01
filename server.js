const axios = require('axios');
const express = require('express');
const cors = require('cors');
const http = require('http');
const socketIO = require('socket.io');
require('dotenv').config();

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = socketIO(server, {
  cors: {
    origin: 'https://roaring-gelato-152a0b.netlify.app/', // Replace with your Netlify app URL
    methods: ['GET', 'POST'],
  },
});

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;

// Store the active routes and their associated socket IDs
const activeRoutes = {};

app.get("/", (req, res) => {
  res.send("<h1> Working Fine</h1>")
});

app.get('/directions', async (req, res) => {
  const { origin, destination } = req.query;
  const directionsAPI = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin}&destination=${destination}&key=${GOOGLE_MAPS_API_KEY}`;

  try {
    const response = await axios.get(directionsAPI);
    const data = response.data;
    res.json(data);

    const isEmergency = req.query.isEmergency === 'true';

    if (isEmergency) {
      // Get the socket IDs of users on the same route
      const socketIds = activeRoutes[`${origin}_${destination}`];
      io.emit('emergency', { origin, destination });

      if (socketIds) {
        // Emit an emergency event to users on the same route
        socketIds.forEach((socketId) => {
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

const port = process.env.PORT || 3001;
server.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
