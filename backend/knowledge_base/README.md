# Demo knowledge base

The six 100–300 word articles in this directory are fictional assessment data.
Run `python -m app.ingest` from `backend` to split them into 1200-character
chunks with 200-character overlap and embed them into the configured Atlas
collection. This README is excluded. Source filenames and titles are stored
with each chunk for citations. The command reuses unchanged chunk embeddings.

Changing the embedding model requires matching the vector index dimensions
and re-ingesting the source documents. The configured model is also a query
filter, preventing retrieval from a different embedding model's records.
