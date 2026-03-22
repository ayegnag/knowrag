# KnowRAG : Personal & Onboarding Knowledge Chatbot

**KnowRAG** is a **local-first**, privacy-focused RAG (Retrieval-Augmented Generation) chatbot that lets you chat naturally with your own documents — Obsidian vaults, personal notes, office docs, PDFs, etc.

### What makes it special

- Completely **local** (runs on your machine — no cloud, no data leaves your device)
- Supports **hybrid retrieval** (dense embeddings + BM25 keyword search)
- Works with **any folder of documents** you point it at (Markdown, PDF, txt, docx…)
- Built-in safety filters (regex + lightweight classification)
- Beautiful, modern React UI with dark mode, streaming responses, sidebar chat switching

It's intentionally **generic** — change the folder path and it becomes your personal knowledge assistant, team wiki chat, research companion, or second brain.

### Quick Start

#### Backend (Node.js + Express + Qdrant + Ollama)

#### 1. Clone & install
```bash
git clone https://github.com/yourusername/knowrag.git
cd knowrag
npm install

#### 2. Start Ollama + pull models (in separate terminals)
```bash
ollama serve
ollama pull sam860/dolphin3-qwen2.5:3b-Q5_K_M
ollama pull qwen2.5:3b-embedding
```

#### 3. Start Qdrant (Docker recommended)
```bash
docker run -d -p 6333:6333 -p 6334:6334 \
  -v $(pwd)/qdrant_storage:/qdrant/storage \
  qdrant/qdrant
```

#### 4. Run backend
```bash
npm run dev
```

#### 5. Run Frontend (React + Vite)
```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173

#### To Ingest your documents
```bash
curl -X POST http://localhost:3000/api/ingest/folder \
  -H "Content-Type: application/json" \
  -d '{"folderPath": "/path/to/your/Obsidian Vault"}'
```

Now chat with your notes!