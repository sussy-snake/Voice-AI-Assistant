"""High-performance embedding module for MSMARCO-XI evaluation and Voice AI Assistant."""
import numpy as np

_model = None
MODEL_NAME = "all-MiniLM-L6-v2"
DIM = 384


def get_model():
    global _model
    if _model is None:
        try:
            from sentence_transformers import SentenceTransformer
            _model = SentenceTransformer(MODEL_NAME)
        except Exception as e:
            # Fallback if sentence_transformers is not available
            print(f"[embedder] Warning: loading sentence_transformers failed ({e}), using deterministic fallback")
            _model = "fallback"
    return _model


def embed_one(text: str) -> np.ndarray:
    model = get_model()
    if model != "fallback" and hasattr(model, "encode"):
        vec = model.encode(text, normalize_embeddings=True, show_progress_bar=False)
        return np.asarray(vec, dtype=np.float32)
    
    # Deterministic fallback
    import hashlib
    h = hashlib.sha256(text.encode("utf-8")).digest()
    rng = np.random.default_rng(int.from_bytes(h[:8], "big"))
    v = rng.standard_normal(DIM).astype(np.float32)
    return v / np.linalg.norm(v)


def embed(texts: list[str]) -> np.ndarray:
    if not texts:
        return np.zeros((0, DIM), dtype=np.float32)
    model = get_model()
    if model != "fallback" and hasattr(model, "encode"):
        vecs = model.encode(texts, normalize_embeddings=True, show_progress_bar=False, batch_size=32)
        return np.asarray(vecs, dtype=np.float32)
    
    return np.vstack([embed_one(t) for t in texts])
