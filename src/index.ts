import './config/env'; // validate env vars first
import express from 'express';
import cors from 'cors';
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

const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    if (!origin) return callback(null, true);
    const allowed = [
      'http://localhost:3000',
      'http://localhost:3001',
      'https://nivasi-commad-centre.vercel.app',
      'https://nivasi-command-centre.vercel.app',
    ];
    if (origin.endsWith('.vercel.app') || allowed.includes(origin)) {
      return callback(null, true);
    }
    return callback(null, true); // allow all during development
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  optionsSuccessStatus: 200,
};

app.options('*', cors(corsOptions));
app.use(cors(corsOptions));
app.use(helmet());
app.use(express.json({ limit: '10mb' }));
app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));

app.get('/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

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

app.use((_req, res) => res.status(404).json({ success: false, message: 'Route not found' }));

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ success: false, message: 'Internal server error' });
});

async function bootstrap() {
  try {
    await prisma.$connect();
    console.log('[DB] Connected');
  } catch (err) {
    console.error('[DB] Failed to connect:', err);
    process.exit(1);
  }

  // Redis connects automatically (lazyConnect: false); failures are non-fatal
  redis.on('error', () => {});

  app.listen(Number(env.PORT), () => {
    console.log(`Nivasi API running on port ${env.PORT} [${env.NODE_ENV}]`);
  });
}

bootstrap().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
