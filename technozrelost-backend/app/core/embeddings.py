"""Офлайн семантические эмбеддинги RU (таск 12, R05i история 14).

ОГРАНИЧЕНИЕ ОКРУЖЕНИЯ: внешних LLM/embedding API нет (ключей нет, сеть
может отсутствовать). Поэтому вместо обучаемой внешней модели — лёгкий
детерминированный алгоритм лучше хеш-корзин токенов: нормализация (lower,
ё→е), RU-стоп-слова, стемминг Snowball-RU (упрощённый, без зависимостей),
канонизация синонимов техдомена, TF-взвешивание (1+log tf), биграммы,
L2-норма. Размерность 1536 сохранена — индекс pgvector и миграция
согласованы без пересоздания (переиндексация скриптом).

Синонимы — курируемый словарь канонических групп: запрос «дрон» и документ
«беспилотный летательный аппарат» делят канонический токен syn_bpla и один
бакет, поэтому косинус > 0, а у хеш-корзин был 0.0.
"""

from __future__ import annotations

import hashlib
import math
import re

VECTOR_DIM: int = 1536
EMBEDDING_DIM: int = 1536
EMBEDDING_MODEL: str = "semantic-ru-v2"

_TOKEN_RE = re.compile(r"[^a-zа-яё0-9\s]")

# Служебные слова: только функциональная лексика, контентные не трогаем.
RU_STOPWORDS: frozenset[str] = frozenset(
    {
        "и", "в", "на", "с", "по", "для", "как", "что", "это", "к", "о",
        "от", "из", "у", "же", "бы", "то", "так", "его", "ее", "её",
        "их", "мы", "вы", "они", "но", "а", "или", "если", "когда",
        "который", "которая", "которые", "был", "была", "было", "были",
        "есть", "быть", "может", "можно", "нужно", "также", "только",
        "уже", "даже", "между", "через", "при", "над", "под", "без",
        "до", "после", "во", "со", "об", "про", "ли", "ни", "не",
        "нет", "да", "все", "всё", "весь", "сам", "сама", "там",
        "тут", "здесь", "туда", "сюда", "где", "куда", "откуда",
        "почему", "зачем", "сколько", "такой", "такая", "такое",
        "этот", "эта", "эти", "тот", "та", "те", "весьма", "очень",
        "просто", "именно", "однако", "потому", "поэтому", "чтобы",
        "хотя", "пока", "еще", "ещё", "всего", "лишь",
        "the", "and", "or", "of", "for", "with",
    }
)

# Канонические группы синонимов техдомена: канон -> варианты-подстроки.
# Короткие (<=3) сверяются только точным совпадением, длинные — подстрокой,
# чтобы покрыть склонения без внешней лемматизации.
SYNONYM_GROUPS: dict[str, tuple[str, ...]] = {
    "syn_bpla": ("бпла", "дрон", "беспилот", "uav", "квадрокоптер", "коптер"),
    "syn_dvigatel": ("двигател", "мотор", "движок", "engine",),
    "syn_kompozit": ("композит", "композиц", "углепласт", "стеклопласт", "углеволок"),
    "syn_ii": (
        "искусствен", "интеллект", "нейросет", "нейрон", "машинн",
        "обучен", "глубокое обучение",
    ),
    "syn_ii_short": ("ии", "ai"),
    "syn_additiv": ("аддитив", "трехмер", "трёхмер", "послой", "слой"),
    "syn_additiv_short": ("3d", "печать"),
    "syn_ispytanie": ("испытан", "тестир", "провер", "валидац"),
    "syn_ispytanie_short": ("тест",),
}

_SHORT_CANONS = {"syn_ii_short", "syn_additiv_short", "syn_ispytanie_short"}


def normalize_token(token: str) -> str:
    """Нижний регистр + ё→е (единая норма для словаря и стеммера)."""
    return token.lower().replace("ё", "е").replace("Ё", "е")


def tokenize(text: str) -> list[str]:
    """Совместимый токенизатор: нормализация, стоп-слова, фильтр длины."""
    text = normalize_token(text)
    text = _TOKEN_RE.sub(" ", text)
    out: list[str] = []
    for raw in text.split():
        if len(raw) < 2:
            continue
        if raw in RU_STOPWORDS:
            continue
        out.append(raw)
    return out


_VOWELS = frozenset("аеиоуыэюя")


def _rv_index(word: str) -> int:
    for i, ch in enumerate(word):
        if ch in _VOWELS:
            return i + 1
    return len(word)


def _strip_in_rv(word: str, rv: int, suffixes: tuple[str, ...]) -> str:
    for suf in suffixes:
        if word.endswith(suf) and len(word) - len(suf) >= rv and len(word) - len(suf) >= 2:
            return word[: -len(suf)]
    return word


_ADJECTIVE = (
    "его", "ого", "ему", "ому", "ими", "ыми", "ее", "ие", "ые", "ое",
    "ей", "ий", "ый", "ой", "ем", "им", "ом", "их", "ых", "ую", "юю",
    "ая", "яя", "ою", "ею",
)
_PARTICIPLE = ("ивш", "ывш", "ующ", "ащ", "ящ", "вш", "ющ", "щ")
_VERB = (
    "ила", "ыла", "ена", "ейте", "уйте", "ите", "или", "ыли", "ей",
    "уй", "ил", "ыл", "им", "ым", "ен", "ило", "ыло", "ено", "ят",
    "ует", "уют", "ит", "ыт", "ены", "ить", "ыть", "ишь", "ую", "ю",
    "ла", "на", "ете", "йте", "ли", "й", "л", "ем", "н", "ло", "но",
    "ет", "ют", "ны", "ть", "ешь", "нно",
)
_NOUN = (
    "иями", "ями", "ами", "ией", "иям", "ям", "ием", "ем", "ам", "ом",
    "ах", "иях", "ях", "а", "ев", "ов", "ие", "ье", "е", "еи", "ии",
    "и", "ей", "ой", "ий", "й", "о", "у", "ы", "ь", "ию", "ью", "ю",
    "ия", "ья", "я",
)


def ru_stem(word: str) -> str:
    """Упрощённый Snowball-RU: RV-зона, шаги perfective/reflexive/adj/verb/noun.

    Короткие и латинские коды (ии, ai, 3d) возвращаются как есть.
    """
    w = normalize_token(word)
    if len(w) <= 3:
        return w
    if re.fullmatch(r"[a-z0-9]+", w) and len(w) <= 4:
        return w
    rv = _rv_index(w)
    if rv >= len(w):
        return w
    # Step 1: perfective-ground (длинные first — идемпотентно).
    for suf in ("ившись", "ывшись", "ивши", "ывши", "вшись", "ив", "ыв"):
        if w.endswith(suf) and len(w) - len(suf) >= rv:
            rest = w[: -len(suf)]
            if rest:
                return rest
    # Reflexive.
    base = w
    if w.endswith("ся") or w.endswith("сь"):
        cand = w[:-2]
        if len(cand) >= rv:
            base = cand
    # Adjective -> participle, иначе verb, иначе noun.
    adj = _strip_in_rv(base, rv, _ADJECTIVE)
    if adj != base:
        part = _strip_in_rv(adj, rv, _PARTICIPLE)
        w = part
    else:
        verb = _strip_in_rv(base, rv, _VERB)
        w = verb if verb != base else _strip_in_rv(base, rv, _NOUN)
    # Step 2: финальное «и».
    if w.endswith("и") and len(w) - 1 >= rv:
        w = w[:-1]
    # Step 3: деривационные «ость/ост».
    if w.endswith("ость") and len(w) - 4 >= rv:
        w = w[:-4]
    elif w.endswith("ост") and len(w) - 3 >= rv:
        w = w[:-3]
    # Step 4: «ейше/ейш», «нн»→«н», мягкий знак.
    if w.endswith("ейше") and len(w) - 5 >= rv:
        w = w[:-5]
    elif w.endswith("ейш") and len(w) - 4 >= rv:
        w = w[:-4]
    if w.endswith("нн"):
        w = w[:-1]
    if w.endswith("ь"):
        w = w[:-1]
    return w if len(w) >= 2 else normalize_token(word)


def token_to_canonical(token: str, stem: str | None = None) -> str | None:
    """Канон синонимической группы для токена (точное/подстрочное совпадение)."""
    t = normalize_token(token)
    s = normalize_token(stem) if stem else ru_stem(t)
    for canon, variants in SYNONYM_GROUPS.items():
        short_only = canon in _SHORT_CANONS
        for var in variants:
            v = normalize_token(var)
            if short_only or len(v) <= 3:
                if t == v or s == v:
                    return canon
            else:
                if v in t or v in s:
                    return canon
    return None


def expanded_terms(text: str) -> set[str]:
    """Стемы + канонические синонимы текста (для гибридного скоринга)."""
    terms: set[str] = set()
    for tok in tokenize(text):
        stem = ru_stem(tok)
        terms.add(stem)
        canon = token_to_canonical(tok, stem)
        if canon:
            terms.add(canon)
    return terms


def lexical_score(query: str, doc_text: str) -> float:
    """Косинус по множествам расширенных термов (0..1, синонимы учитываются)."""
    q = expanded_terms(query)
    d = expanded_terms(doc_text)
    if not q or not d:
        return 0.0
    inter = len(q & d)
    if not inter:
        return 0.0
    return inter / math.sqrt(len(q) * len(d))


def _features(text: str) -> dict[str, float]:
    toks = tokenize(text)
    if not toks:
        return {}
    stems: list[str] = []
    counts: dict[str, float] = {}
    for tok in toks:
        stem = ru_stem(tok)
        stems.append(stem)
        counts[stem] = counts.get(stem, 0.0) + 1.0
        canon = token_to_canonical(tok, stem)
        if canon:
            counts[canon] = counts.get(canon, 0.0) + 1.5
    for i in range(len(stems) - 1):
        bigram = stems[i] + "_" + stems[i + 1]
        counts[bigram] = counts.get(bigram, 0.0) + 0.5
    weighted: dict[str, float] = {}
    for feat, tf in counts.items():
        weighted[feat] = 1.0 + math.log(tf) if tf > 1.0 else 1.0
        if "_" in feat:
            weighted[feat] *= 0.5
        if feat.startswith("syn_"):
            weighted[feat] *= 1.5
    return weighted


def embed_text(text: str, dim: int = VECTOR_DIM) -> list[float]:
    feats = _features(text)
    if not feats:
        return [0.0] * dim
    vec = [0.0] * dim
    for feat, weight in feats.items():
        h = int(hashlib.sha256(feat.encode("utf-8")).hexdigest(), 16)
        vec[h % dim] += weight
    norm = math.sqrt(sum(v * v for v in vec))
    if norm > 0:
        vec = [v / norm for v in vec]
    return vec


def embed_texts(texts: list[str], dim: int = VECTOR_DIM) -> list[list[float]]:
    return [embed_text(t, dim) for t in texts]
