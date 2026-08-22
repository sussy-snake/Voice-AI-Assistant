"""Target configuration for evaluation suite."""
import os

GENERATION_BACKEND = os.environ.get("GENERATION_BACKEND", "api")
LATENCY_BUDGET_MS = int(os.environ.get("LATENCY_BUDGET_MS", "50"))
GENERATION_MODEL = os.environ.get("GENERATION_MODEL", "gemini-1.5-flash")
LOCAL_GENERATION_MODEL = os.environ.get("LOCAL_GENERATION_MODEL", "llama-3.1-8b-instant")
