[User] --> [Web UI (HTML/JS + Socket.io)] 
           |
           v
[Express.js API Server]
  - Routes: /chat, /upload-docs (for knowledge base ingestion)
  |
  v
[Security Pipeline] (Multi-stage filter)
  - Stage 1: Regex Matching (JS RegExp)
  - Stage 2: Binary Classification (Lightweight LLM call w/ confidence score)
  - Stage 3: Policy Engine (Business logic rules)
  |
  If safe --> 
              [RAG Core]
                - Query Embedding (OpenAI or Local LLM)
                - Vector Search (Pinecone)
                - Context Augmentation
                - Response Generation (Main LLM)
              |
              +--> [Domain-Restricted Search Tool] (If vector DB miss; e.g., via custom web scraper or API like Google Custom Search restricted to company domains)
  |
  v
[Response] --> [UI]