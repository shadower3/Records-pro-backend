import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server } from 'socket.io';
import app from './app.js';
import { setupSocketHandlers } from './socket/socketHandlers.js';
dotenv.config();

const PORT = process.env.PORT || 5000;
const server = createServer(app);

// Setup Socket.IO
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    methods: ["GET", "POST"]
  }
});

setupSocketHandlers(io);

// Make io available globally
global.io = io;

server.listen(PORT, () => {
  console.log(`API running on http://localhost:${PORT}`);
});
