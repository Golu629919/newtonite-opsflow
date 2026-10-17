import express from 'express';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { authMiddleware } from './auth.js';
import { seedDatabase } from './seed.js';
import { outboxWorker } from './outboxWorker.js';
import routes from './routes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// CORS & JSON parsing
app.use(cors());
app.use(express.json());

// Initialize Database & Seed
seedDatabase();

// Start Background Asynchronous Outbox Worker (if not in test mode)
if (process.env.NODE_ENV !== 'test') {
  outboxWorker.start(2500);
}

const distPath = path.join(__dirname, '..', 'dist');

// Serve static frontend assets if built
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
}

// Attach Authentication Middleware & API Routes
app.use('/api', authMiddleware, routes);

// SPA Fallback for client-side routing
if (fs.existsSync(distPath)) {
  app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api')) {
      return res.sendFile(path.join(distPath, 'index.html'));
    }
    next();
  });
}

// Global Centralized Error Handler
app.use((err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const isExpected = statusCode < 500;

  if (!isExpected) {
    console.error('[ServerError]', err);
  }

  res.status(statusCode).json({
    error: err.code || (statusCode === 409 ? 'CONCURRENCY_CONFLICT' : (statusCode === 403 ? 'FORBIDDEN' : 'OPERATION_ERROR')),
    message: err.message || 'An unexpected internal server error occurred',
    currentVersion: err.currentVersion,
    serverItem: err.serverItem
  });
});

let server = null;
if (process.env.NODE_ENV !== 'test') {
  server = app.listen(PORT, () => {
    console.log(`=======================================================`);
    console.log(`🚀 Newtonite OpsFlow Server running on http://localhost:${PORT}`);
    console.log(`   Database: SQLite WAL enabled`);
    console.log(`   Outbox Worker: ACTIVE`);
    console.log(`=======================================================`);
  });
}

// Graceful shutdown
process.on('SIGTERM', () => {
  outboxWorker.stop();
  if (server) server.close();
});

export { app, server };
