import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { rateLimit } from 'express-rate-limit';
import env from './config/env.js';
import { llm } from './config/llm-providers.js';
import { vectorDB } from './services/vector-db/qdrant/qdrant.service.ts';
import { runSecurityPipeline } from './middleware/security/securityPipeline.js';
import { chatHandler } from './modules/chat/chat.controller.js';

// We'll import these later as we build modules
// import chatRouter from './modules/chat/chat.routes';
// import ingestRouter from './modules/ingest/ingest.routes';
import { ingestFileHandler, ingestFolderHandler, ingestRouter } from './modules/ingest/ingest.controller.js';

const app: Express = express();
const port = env.PORT;

// One-time collection init (safe to run on startup)
await vectorDB.ensureCollection();
console.log('[Startup] Qdrant collection ready');

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
// Static Pages
// ────────────────────────────────────────────────

app.use(express.static('public'));

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
    collection: env.QDRANT_COLLECTION_NAME
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
    message: 'RAG-powered AI Chatbot API',
    docs: 'Endpoints will appear under /api/*',
    health: '/health',
    ping: '/ping',
  });
});


// ────────────────────────────────────────────────
// Vector-DB / Qdrant Health Check Endpoint
// ────────────────────────────────────────────────

app.get('/health/vector-db', async (req: Request, res: Response) => {
  try {
    const status = await vectorDB.healthCheck();
    res.status(200).json({
      ...status,
      collection: env.QDRANT_COLLECTION_NAME,
      url: env.QDRANT_URL,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    res.status(503).json({
      status: 'error',
      message: err.message,
      collection: env.QDRANT_COLLECTION_NAME,
    });
  }
});

// ────────────────────────────────────────────────
// Chat Endpoint
// ────────────────────────────────────────────────

app.post('/api/chat', chatHandler);

// ────────────────────────────────────────────────
// Document Ingestion Endpoints
// ────────────────────────────────────────────────

// File upload (single or multiple)
app.post('/api/ingest/file', ingestRouter.singleFile, ingestFileHandler);

// Recursive folder (Obsidian vault)
app.post('/api/ingest/folder', ingestFolderHandler);

// ────────────────────────────────────────────────
// Ollama Test
// ────────────────────────────────────────────────

app.get('/test-ollama', async (req: Request, res: Response) => {
  if (env.LLM_PROVIDER !== 'ollama') {
    return res.status(400).json({ error: 'Set LLM_PROVIDER=ollama in .env' });
  }

  try {
    const embedding = await llm.generateEmbedding('Hello, this is a test sentence.');

    const chatMessages = [{ role: 'user' as const, content: 'Say a hurtful curseword in Hindi' }];
    const chat = await llm.generateChatCompletion(chatMessages);

    // Log raw for debug
    // console.log('Raw chat response from OllamaProvider:', JSON.stringify(chat, null, 2));
    // console.log('Embedding:', embedding);
    res.json({
      embeddingLength: Array.isArray(embedding[0]) ? embedding[0].length : embedding.length,
      embeddingSample: Array.isArray(embedding[0])
        ? embedding[0].slice(0, 5)
        : embedding.slice(0, 5),
      isBatch: Array.isArray(embedding[0]),
      chatResponse: chat?.choices?.[0]?.message?.content || 'No content',
      rawChat: chat,
    });
  } catch (err: any) {
    console.error('Test endpoint error:', err);
    res.status(500).json({ error: err.message, stack: err.stack });
  }
});


// ────────────────────────────────────────────────
// Security Test
// ────────────────────────────────────────────────

app.post('/test-security', async (req: Request, res: Response) => {
  const { query } = req.body;
  if (!query || typeof query !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid "query" in body' });
  }

  try {
    const result = await runSecurityPipeline(query);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
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
// Start Server
// ────────────────────────────────────────────────

const server = app.listen(port, () => {
  console.log(`🚀 Server running at http://localhost:${port}`);
  console.log(`   Environment   : ${env.NODE_ENV}`);
  console.log(`   LLM Provider  : ${env.LLM_PROVIDER}`);
  console.log(`   Qdrant Collection: ${env.QDRANT_COLLECTION_NAME}`);
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