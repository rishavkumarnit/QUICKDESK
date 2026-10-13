# Knowledge base

Add 5–10 Markdown articles (100–300 words each) here during RAG implementation.
The ingestion command will exclude this README, split articles, generate
embeddings, and upsert chunks with source metadata into MongoDB Atlas.

Use the same embedding model for ingestion and queries. Configure the Atlas
Vector Search index dimensions to match the selected embedding model.
Ingestion and index creation are not implemented in this initial setup.
