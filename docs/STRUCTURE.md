knowrag-chatbot/
├── src/                        # All source code lives here
│   ├── config/                 # Centralized configuration & env handling
│   │   ├── index.ts
│   │   ├── env.ts              # typed env vars + validation (zod or similar)
│   │   └── llm-providers.ts    # LLM provider factory / switch logic
│   │
│   ├── middleware/             # Express middleware (global + feature-specific)
│   │   ├── security/
│   │   │   ├── regexFilter.ts
│   │   │   ├── llmClassifier.ts       # lightweight LLM call for binary safe/unsafe
│   │   │   └── policyEngine.ts
│   │   ├── errorHandler.ts
│   │   └── rateLimiter.ts             # optional but recommended
│   │
│   ├── modules/                # Feature-based organization (core of the app)
│   │   ├── auth/               # If you add user login later (optional now)
│   │   │   └── ...
│   │   ├── chat/               # Main chat endpoint + RAG logic
│   │   │   ├── chat.controller.ts     # Express route handlers
│   │   │   ├── chat.service.ts        # Business logic: security → rag → generate
│   │   │   ├── rag/
│   │   │   │   ├── embedding.service.ts
│   │   │   │   ├── retrieval.service.ts     # Pinecone query
│   │   │   │   ├── augmentation.ts          # build context prompt
│   │   │   │   └── generation.service.ts    # call main LLM
│   │   │   └── fallbackSearch.service.ts    # domain-restricted web search fallback
│   │   │
│   │   ├── ingest/             # Document upload & knowledge base building
│   │   │   ├── ingest.controller.ts
│   │   │   ├── ingest.service.ts
│   │   │   ├── documentParser.ts     # pdf, docx, txt → text chunks
│   │   │   └── chunker.ts            # text → overlapping chunks
│   │   │
│   │   └── security/           # Reusable security helpers (used across modules)
│   │       └── securityPipeline.ts   # orchestrates the 3-stage pipeline
│   │
│   ├── services/               # Cross-cutting / infrastructure services
│   │   ├── vector-db/
│   │   │   │   ├── qdrant
│   │   │   │   │   ├── qdrant.client.ts
│   │   │   │   │   └── qdrant.service.ts     # upsert, query, list indexes, etc.
│   │   │   │   ├── vector-db.interface.ts
│   │   │   │   └── vector-db.factory.ts
│   │   ├── llm/
│   │   │   ├── openai/
│   │   │   │   ├── openaiEmbedding.ts
│   │   │   │   └── openaiChat.ts
│   │   │   ├── ollama/
│   │   │   │   ├── ollamaEmbedding.ts
│   │   │   │   └── ollamaChat.ts
│   │   │   └── llm.interface.ts        # Unified interface (abstraction)
│   │   └── logger.ts                   # winston or pino
│   │
│   ├── types/                  # Shared TypeScript types
│   │   ├── index.ts
│   │   ├── config.ts
│   │   ├── rag.ts              # Chunk, RetrievalResult, etc.
│   │   └── security.ts
│   │
│   ├── utils/                  # Pure helpers (no dependencies)
│   │   ├── string.ts           # chunking helpers, sanitization
│   │   ├── http.ts             # axios wrappers for external calls
│   │   └── validators.ts       # zod schemas for input
│   │
│   └── server.ts               # Express app setup, routes mounting, start
│
├── public/                     # Static files (for simple frontend)
│   ├── index.html
│   ├── css/
│   └── js/
│       └── chat.js             # vanilla JS or minimal framework
│
├── scripts/                    # One-off or dev scripts
│   └── seed-index.ts           # Optional: bootstrap Pinecone with sample data
│
├── tests/                      # Jest / Vitest
│   ├── unit/
│   ├── integration/
│   └── e2e/
│
├── .env                        # Never commit
├── .env.example                # Template for others
├── .eslintrc.cjs               # or eslint.config.js (flat config 2025+)
├── .prettierrc
├── tsconfig.json
├── package.json
├── Dockerfile                  # For local + Ollama container
├── docker-compose.yml          # Optional: app + Ollama + Pinecone proxy if needed
└── README.md