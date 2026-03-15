# knowrag
Knowrag is a secure RAG-powered AI chatbot framework that delivers controlled, context-aware responses using curated knowledge sources and vector databases. It combines guardrails, trusted web retrieval, and continuous knowledge updating to enable safe and reliable enterprise AI interactions.

---
### Local Qdrant Setup (one-time)
Run Qdrant in Docker with persistent storage:

``bash

docker pull qdrant/qdrant:latest

docker run -d \
  -p 6333:6333 \
  -p 6334:6334 \
  -v $(pwd)/qdrant_storage:/qdrant/storage:z \
  --name qdrant-local \
  qdrant/qdrant

``
Access dashboard: http://localhost:6333/dashboard
API: http://localhost:6333
Data persists in ./qdrant_storage folder next to your project.

---

