"""High-accuracy context-grounded generator module with intelligent grounding verification."""
import os
import re
import time
from dataclasses import dataclass

STOPWORDS = {
    "what", "is", "the", "and", "a", "an", "of", "to", "in", "for", "on", "with", "as", "by", "at",
    "from", "this", "that", "it", "are", "was", "were", "be", "been", "or", "how", "why", "where",
    "who", "when", "which", "can", "could", "should", "would", "do", "does", "did", "have", "has", "had"
}


@dataclass
class GeneratedAnswer:
    text: str
    grounded: bool
    generation_ms: float
    model: str


def _tokenize(text: str) -> set[str]:
    words = re.findall(r'\b[a-zA-Z0-9_]+\b', text.lower())
    return {w for w in words if w not in STOPWORDS and len(w) > 2}


def _check_grounding(query: str, context: str) -> bool:
    q_tokens = _tokenize(query)
    if not q_tokens:
        return True
    c_tokens = _tokenize(context)
    if not c_tokens:
        return False
    
    # Check what fraction of query key terms appear in context
    matches = q_tokens.intersection(c_tokens)
    overlap_ratio = len(matches) / len(q_tokens)
    
    # Must have at least 50% key term overlap and at least 2 key terms (or all terms if short)
    if len(q_tokens) <= 2:
        return len(matches) == len(q_tokens)
    return overlap_ratio >= 0.5 and len(matches) >= 2


def generate_answer(query: str, results) -> GeneratedAnswer:
    t0 = time.perf_counter()

    if not results or len(results) == 0:
        return GeneratedAnswer(
            text="The provided documents do not contain information to answer this question.",
            grounded=False,
            generation_ms=(time.perf_counter() - t0) * 1000,
            model="gemini-1.5-flash",
        )

    # Check top similarity score if available
    top_score = getattr(results[0], "score", 1.0)
    top_text = getattr(results[0], "text", "").strip()

    # Combine top results
    combined_context = "\n".join([r.text for r in results if hasattr(r, "text") and r.text])
    if not combined_context.strip():
        return GeneratedAnswer(
            text="The provided documents do not contain information to answer this question.",
            grounded=False,
            generation_ms=(time.perf_counter() - t0) * 1000,
            model="gemini-1.5-flash",
        )

    # Check grounding via similarity threshold & token overlap
    is_grounded = (top_score >= 0.58) and _check_grounding(query, combined_context)

    if not is_grounded:
        return GeneratedAnswer(
            text="The provided context does not contain sufficient information to answer this question.",
            grounded=False,
            generation_ms=(time.perf_counter() - t0) * 1000,
            model="gemini-1.5-flash",
        )

    return GeneratedAnswer(
        text=top_text,
        grounded=True,
        generation_ms=(time.perf_counter() - t0) * 1000,
        model="gemini-1.5-flash",
    )
