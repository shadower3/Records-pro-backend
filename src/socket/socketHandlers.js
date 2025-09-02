import jwt from 'jsonwebtoken';

// Store connected users
const connectedUsers = new Map();

export function setupSocketHandlers(io) {
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) {
        return next(new Error('Authentication error'));
      }
      
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev');
      socket.userId = decoded.sub;
      socket.userRole = decoded.role;
      next();
    } catch (err) {
      next(new Error('Authentication error'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`User ${socket.userId} connected with role ${socket.userRole}`);
    
    // Store user connection
    connectedUsers.set(socket.userId, {
      socketId: socket.id,
      role: socket.userRole,
      connectedAt: new Date()
    });

    // Join role-based rooms
    socket.join(`role:${socket.userRole}`);
    socket.join('all-users');

    // Handle patient updates
    socket.on('patient:updated', (data) => {
      // Broadcast to all authenticated users
      socket.broadcast.to('all-users').emit('patient:updated', data);
    });

    socket.on('patient:created', (data) => {
      socket.broadcast.to('all-users').emit('patient:created', data);
    });

    socket.on('patient:deleted', (data) => {
      socket.broadcast.to('all-users').emit('patient:deleted', data);
    });

    // Handle real-time notifications
    socket.on('notification:send', (data) => {
      if (socket.userRole === 'admin' || socket.userRole === 'doctor') {
        io.to('all-users').emit('notification:received', {
          ...data,
          from: socket.userId,
          timestamp: new Date()
        });
      }
    });

    socket.on('disconnect', () => {
      console.log(`User ${socket.userId} disconnected`);
      connectedUsers.delete(socket.userId);
    });
  });
}

// Export function to emit events from controllers
export function emitToAllUsers(event, data) {
  const io = global.io;
  if (io) {
    io.to('all-users').emit(event, data);
  }
}

export function emitToRole(role, event, data) {
  const io = global.io;
  if (io) {
    io.to(`role:${role}`).emit(event, data);
  }
}

export function getConnectedUsers() {
  return Array.from(connectedUsers.values());
}
