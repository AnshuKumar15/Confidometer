import re

# ── Tier 1: Definite fillers — always counted ──
DEFINITE_FILLERS = [
    "um", "uh", "erm", "hmm", "uhm", "umm", "ah", "hm",
    "well uh", "um um",
]

# ── Tier 2: Contextual fillers — only at sentence boundaries ──
# These are only fillers when used as discourse markers at the start of a clause,
# not when embedded in normal grammar (e.g. "I like Python" ≠ filler).
CONTEXTUAL_FILLERS = [
    "so", "like", "well", "right", "basically", "actually",
    "literally", "honestly", "anyway",
]

# ── Tier 3: Phrase fillers — always counted (multi-word) ──
PHRASE_FILLERS = [
    "you know what i mean",
    "if that makes sense",
    "at the end of the day",
    "you know what",
    "you get me",
    "and stuff",
    "or whatever",
    "you know",
    "i mean",
    "i guess",
    "i suppose",
    "more or less",
    "to be fair",
    "let me think",
]


def count_fillers(transcript: str) -> int:
    """
    Count filler words in a transcript using tiered detection:
    - Tier 1 (definite): Always counted
    - Tier 2 (contextual): Only counted at sentence boundaries
    - Tier 3 (phrases): Always counted (multi-word)

    Returns total filler count.
    """
    if not transcript or not transcript.strip():
        return 0

    transcript_lower = transcript.lower().strip()

    count = 0
    found: list[tuple[str, int]] = []

    # ── Tier 3 first (longest match, avoid double-counting substrings) ──
    # Sort by length descending so "you know what i mean" matches before "you know"
    for phrase in sorted(PHRASE_FILLERS, key=len, reverse=True):
        pattern = r"\b" + re.escape(phrase) + r"\b"
        matches = re.findall(pattern, transcript_lower)
        if matches:
            found.append((phrase, len(matches)))
            count += len(matches)
            # Remove matched phrases to prevent double-counting with shorter phrases
            transcript_lower = re.sub(pattern, " ", transcript_lower)

    # ── Tier 1: Definite fillers (always count) ──
    for word in DEFINITE_FILLERS:
        pattern = r"\b" + re.escape(word) + r"\b"
        matches = re.findall(pattern, transcript_lower)
        if matches:
            found.append((word, len(matches)))
            count += len(matches)

    # ── Tier 2: Contextual fillers (only at sentence boundaries) ──
    # A word is a "boundary filler" if it appears:
    # - At the very start of the transcript
    # - After sentence-ending punctuation (. ? ! ,) followed by optional whitespace
    # - After a pause indicator (... or --)
    for word in CONTEXTUAL_FILLERS:
        # Match word at start of text or after sentence boundary
        boundary_pattern = (
            r"(?:^|(?<=[.?!,;:\n])\s*)"     # Start of text OR after punctuation + whitespace
            r"\b" + re.escape(word) + r"\b"
            r"(?:\s|[,.]|$)"                  # Followed by whitespace, comma, period, or end
        )
        matches = re.findall(boundary_pattern, transcript_lower, flags=re.MULTILINE)
        if matches:
            found.append((f"{word} (contextual)", len(matches)))
            count += len(matches)

    if found:
        print(f"[DEBUG] Fillers found: {found}")

    return count