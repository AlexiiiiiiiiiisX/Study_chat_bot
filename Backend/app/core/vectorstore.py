import chromadb
from chromadb.utils import embedding_functions

from config import settings

_client = chromadb.PersistentClient(path=settings.CHROMA_PERSIST_DIR)

# Embeddings locales por defecto (puedes cambiar a OpenAI/Ollama embeddings si quieres)
_embedding_fn = embedding_functions.SentenceTransformerEmbeddingFunction(
    model_name="all-MiniLM-L6-v2"
)


def get_or_create_collection(name: str = "study_documents"):
    return _client.get_or_create_collection(name=name, embedding_function=_embedding_fn)


def add_documents(collection_name: str, ids: list[str], documents: list[str], metadatas: list[dict]):
    collection = get_or_create_collection(collection_name)
    collection.add(ids=ids, documents=documents, metadatas=metadatas)


def query(collection_name: str, query_text: str, n_results: int = 4, where: dict | None = None):
    collection = get_or_create_collection(collection_name)
    return collection.query(query_texts=[query_text], n_results=n_results, where=where)


def delete_document_chunks(collection_name: str, document_id: str):
    collection = get_or_create_collection(collection_name)
    collection.delete(where={"document_id": document_id})


def get_document_chunks(collection_name: str, document_id: str, limit: int = 200):
    """Recupera todos los chunks de un documento (usado para generar flashcards/quizzes)."""
    collection = get_or_create_collection(collection_name)
    return collection.get(where={"document_id": document_id}, limit=limit)
