from __future__ import annotations

import hashlib
import math
import re

VECTOR_DIM: int = 1536


def tokenize(text: str) -> list[str]:
    text = text.lower()
    text = re.sub(r"[^a-zа-яё0-9\s]", " ", text)
    return [t for t in text.split() if len(t) > 1]


def embed_text(text: str, dim: int = VECTOR_DIM) -> list[float]:
    tokens = tokenize(text)
    if not tokens:
        return [0.0] * dim

    vec = [0.0] * dim
    for token in tokens:
        h = int(hashlib.sha256(token.encode("utf-8")).hexdigest(), 16)
        idx = h % dim
        vec[idx] += 1.0

    norm = math.sqrt(sum(v * v for v in vec))
    if norm > 0:
        vec = [v / norm for v in vec]
    return vec


def embed_texts(texts: list[str], dim: int = VECTOR_DIM) -> list[list[float]]:
    return [embed_text(t, dim) for t in texts]
