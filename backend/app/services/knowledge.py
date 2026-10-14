"""Build and expose the process-local knowledge-base vector index."""
from pathlib import Path
from threading import Lock

from langchain_core.documents import Document
from langchain_core.vectorstores import InMemoryVectorStore
from langchain_openai import OpenAIEmbeddings
from langchain_text_splitters import RecursiveCharacterTextSplitter

from app.core.config import settings

_store: InMemoryVectorStore | None = None
_chunk_count = 0
_lock = Lock()


def _embeddings():
    return OpenAIEmbeddings(
        model=settings.embedding_model,
        api_key=settings.embedding_api_key,
        request_timeout=30,
        max_retries=1,
    )


def load_documents() -> list[Document]:
    root = Path(__file__).resolve().parents[2] / "knowledge_base"
    splitter = RecursiveCharacterTextSplitter(chunk_size=1200, chunk_overlap=200)
    documents: list[Document] = []
    for path in sorted(root.glob("*.md")):
        if path.name == "README.md":
            continue
        content = path.read_text(encoding="utf-8")
        title = content.splitlines()[0].lstrip("# ").strip()
        for number, chunk in enumerate(splitter.split_text(content)):
            documents.append(Document(
                page_content=chunk,
                metadata={"source": path.name, "title": title, "chunk": number},
            ))
    if not documents:
        raise RuntimeError("No knowledge-base articles found")
    return documents


def initialize_knowledge_base() -> int:
    """Embed all Markdown articles and atomically publish a fresh in-memory index."""
    global _store, _chunk_count
    documents = load_documents()
    candidate = InMemoryVectorStore(_embeddings())
    candidate.add_documents(documents)
    with _lock:
        _store = candidate
        _chunk_count = len(documents)
    return len(documents)


def get_vector_store() -> InMemoryVectorStore:
    with _lock:
        store = _store
    if store is None:
        raise RuntimeError("Knowledge-base index is not ready")
    return store


def knowledge_status() -> dict[str, int | bool]:
    with _lock:
        return {"ready": _store is not None, "chunks": _chunk_count}
