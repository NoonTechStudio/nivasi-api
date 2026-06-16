import './config/env';
import express, { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env';
import { prisma } from './config/db';
import redis from './config/redis';

import authRoutes from './routes/auth.routes';
import directoryRoutes from './routes/directory.routes';
import maintenanceRoutes from './routes/maintenance.routes';
import noticesRoutes from './routes/notices.routes';
import complaintsRoutes from './routes/complaints.routes';
import visitorsRoutes from './routes/visitors.routes';
import syncRoutes from './routes/sync.routes';
import superAdminRoutes from './routes/superadmin.routes';
import subAdminRoutes from './routes/subadmin.routes';
import subscriptionRoutes from './routes/subscription.routes';

const app = express();
const PORT = process.env.PORT || 3000;

// This must be the FIRST thing after const app = express();
app.use((req: any, res: any, next: any) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', '*');
  res.header('Access-Control-Allow-Headers', '*');
  res.header('Access-Control-Allow-Credentials', 'true');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Step 3 — Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(helmet());
app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// Step 4 — Health check (no auth needed)
app.get('/', (_req: Request, res: Response) => res.json({ message: 'Nivasi API is running' }));
app.get('/health', (_req: Request, res: Response) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// Step 5 — All routes
app.use('/api/auth', authRoutes);
app.use('/api/directory', directoryRoutes);
app.use('/api/maintenance', maintenanceRoutes);
app.use('/api/notices', noticesRoutes);
app.use('/api/complaints', complaintsRoutes);
app.use('/api/visitors', visitorsRoutes);
app.use('/api/sync', syncRoutes);
app.use('/api/superadmin', superAdminRoutes);
app.use('/api/subadmin', subAdminRoutes);
app.use('/api/subscriptions', subscriptionRoutes);

app.use((_req: Request, res: Response) => res.status(404).json({ success: false, message: 'Route not found' }));

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ success: false, message: 'Internal server error' });
});

// Step 6 — Start server
const startServer = async () => {
  try {
    await prisma.$connect();
    console.log('[DB] Connected');

    // Redis connects automatically (lazyConnect: false); failures are non-fatal
    redis.on('error', () => {});

    app.listen(PORT, () => {
      console.log(`Nivasi API running on port ${PORT} [${env.NODE_ENV}]`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
