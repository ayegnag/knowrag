import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { rateLimit } from 'express-rate-limit';
import env from './config/env.js';
import { llm } from './config/llm-providers.js';
import { pineconeService } from './services/pinecone/pinecone.service.js';

// We'll import these later as we build modules
// import chatRouter from './modules/chat/chat.routes';
// import ingestRouter from './modules/ingest/ingest.routes';

const app: Express = express();
const port = env.PORT;

// ────────────────────────────────────────────────
// Middleware
// ────────────────────────────────────────────────

app.use(cors({
  origin: env.NODE_ENV === 'production'
    ? ['https://your-frontend-domain.com'] // ← update later
    : ['http://localhost:3000', 'http://127.0.0.1:3000'],
  credentials: true,
}));

app.use(express.json({ limit: '10mb' })); // increase if large doc uploads expected
app.use(express.urlencoded({ extended: true }));

// Basic rate limiting (very permissive for dev; tighten in prod)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500,                 // limit each IP to 500 requests per window
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// ────────────────────────────────────────────────
// Health & debug endpoints
// ────────────────────────────────────────────────

app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    environment: env.NODE_ENV,
    llmProvider: env.LLM_PROVIDER,
    pineconeIndex: env.PINECONE_INDEX_NAME,
  });
});

app.get('/ping', (req: Request, res: Response) => {
  res.status(200).json({ message: 'pong' });
});

// Simple version endpoint (useful for deployments)
app.get('/version', (req: Request, res: Response) => {
  res.status(200).json({
    version: process.env.npm_package_version || '1.0.0',
    buildTime: new Date().toISOString(),
  });
});

// ────────────────────────────────────────────────
// API Routes (to be mounted as we build modules)
// ────────────────────────────────────────────────

// app.use('/api/chat', chatRouter);
// app.use('/api/ingest', ingestRouter);

// Placeholder route to confirm server is running
app.get('/', (req: Request, res: Response) => {
  res.status(200).json({
    message: 'RAG Onboarding Chatbot API',
    docs: 'Endpoints will appear under /api/*',
    health: '/health',
    ping: '/ping',
  });
});

// ────────────────────────────────────────────────
// 404 Handler
// ────────────────────────────────────────────────

app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: 'Not Found',
    path: req.originalUrl,
    method: req.method,
  });
});

// ────────────────────────────────────────────────
// Global Error Handler
// ────────────────────────────────────────────────

app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('[Global Error]', {
    message: err.message,
    stack: err.stack,
    path: req.originalUrl,
    method: req.method,
  });

  const status = err.status || 500;
  const message = env.NODE_ENV === 'production'
    ? 'Internal Server Error'
    : err.message || 'Something went wrong';

  res.status(status).json({
    error: message,
    ...(env.NODE_ENV !== 'production' && { stack: err.stack }),
  });
});

// ────────────────────────────────────────────────
// Pinecone Health Check Endpoint
// ────────────────────────────────────────────────

app.get('/health/pinecone', async (req: Request, res: Response) => {
  try {
    const status = await pineconeService.healthCheck();
    res.status(200).json({
      ...status,
      llmProvider: env.LLM_PROVIDER,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    res.status(503).json({
      status: 'error',
      message: err.message,
      indexName: env.PINECONE_INDEX_NAME,
    });
  }
});

// ────────────────────────────────────────────────
// Start Server
// ────────────────────────────────────────────────

const server = app.listen(port, () => {
  console.log(`🚀 Server running at http://localhost:${port}`);
  console.log(`   Environment   : ${env.NODE_ENV}`);
  console.log(`   LLM Provider  : ${env.LLM_PROVIDER}`);
  console.log(`   Pinecone Index: ${env.PINECONE_INDEX_NAME}`);
});

// Graceful shutdown
const shutdown = (signal: string) => {
  console.log(`\nReceived ${signal}. Shutting down gracefully...`);
  server.close(() => {
    console.log('HTTP server closed.');
    process.exit(0);
  });

  // Force exit after 10s if cleanup is stuck
  setTimeout(() => {
    console.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

export default app; // for testing / supertest if needed later