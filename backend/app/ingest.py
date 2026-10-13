"""Idempotently embed the sample Markdown articles and create the Atlas index."""
import hashlib
from pathlib import Path
from pymongo import MongoClient
from langchain_text_splitters import RecursiveCharacterTextSplitter
from app.ai import embeddings, vector_store
from app.config import settings

def main():
    root = Path(__file__).resolve().parents[1] / 'knowledge_base'
    splitter = RecursiveCharacterTextSplitter(chunk_size=1200, chunk_overlap=200)
    model = embeddings()
    with MongoClient(settings.mongodb_uri, serverSelectionTimeoutMS=10000, socketTimeoutMS=30000) as client:
        collection = client[settings.mongodb_database][settings.mongodb_collection]
        total = 0
        for path in sorted(root.glob('*.md')):
            if path.name == 'README.md':
                continue
            content = path.read_text(encoding='utf-8')
            chunks = splitter.split_text(content)
            ids = []
            for number, chunk in enumerate(chunks):
                identity = hashlib.sha256((path.name + str(number) + settings.embedding_model + chunk).encode()).hexdigest()
                ids.append(identity)
                if not collection.find_one({'_id': identity}, {'_id': 1}):
                    vector = model.embed_query(chunk)
                    collection.replace_one({'_id': identity}, {'_id': identity, 'text': chunk,
                        'source': path.name, 'title': content.splitlines()[0].lstrip('# '),
                        'embedding_model': settings.embedding_model, 'embedding': vector,
                        'managed_by': 'quickdesk-seed'}, upsert=True)
                total += 1
            # Remove stale chunks only from this script's own article records.
            collection.delete_many({'managed_by': 'quickdesk-seed', 'source': path.name, '_id': {'$nin': ids}})
        sample = collection.find_one({'embedding_model': settings.embedding_model, 'managed_by': 'quickdesk-seed'})
        if not sample:
            raise RuntimeError('No knowledge-base articles found')
        indexes = list(collection.list_search_indexes(settings.mongodb_vector_index))
        if not indexes:
            vector_store(client).create_vector_search_index(dimensions=len(sample['embedding']), filters=['embedding_model'])
            print('Vector index creation requested. It may take a few minutes to become queryable.')
        else:
            print('Existing vector index preserved. Verify its dimensions and embedding_model filter before querying.')
        print(f'Ingested {total} chunks. Embedding dimensions: {len(sample["embedding"])}.')

if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        raise SystemExit(f'Ingestion failed: {type(error).__name__}. Check provider quota and Atlas permissions; credentials suppressed.')
