import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
// Database connection removed - using JSON file storage
import authRoutes from './routes/auth.routes.js';
import patientRoutes from './routes/patients.routes.js';
import reportsRoutes from './routes/reports.routes.js';
import usersRoutes from './routes/users.routes.js';

const app = express();
app.use(cors({ origin: process.env.CLIENT_URL || '*' }));
app.use(express.json());
app.use(morgan('dev'));

// Make io available globally for socket emissions
app.use((req, res, next) => {
  req.io = global.io;
  next();
});

app.get('/', (_req, res) => res.json({ ok: true, name: 'Records Pro API' }));
app.use('/api/auth', authRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/users', usersRoutes);

export default app;
