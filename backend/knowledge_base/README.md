# Demo knowledge base

The six 100–300 word articles in this directory are fictional assessment data.
FastAPI loads them at application startup, splits them into 1200-character
chunks with 200-character overlap, embeds them, and builds a process-local
LangChain `InMemoryVectorStore`. This README is excluded. Source filenames and
titles are retained with each chunk for citations. Restart the backend after
editing an article or changing the embedding model.
