"""
Hallucination Filter module for Confidometer STT.

Detects and filters out Whisper model hallucinations (phantom text generated
during silence, fan noise, microphone hum, or background chatter).
Whisper often hallucinates YouTube outro credits, subtitle artifacts, music notes,
or infinite repetitive loops when exposed to non-speech audio.
"""

import re
from typing import Optional, Sequence

# Canonical hallucination phrases (case-insensitive substring or full-match check)
HALLUCINATION_PHRASES = {
    # YouTube / video credits
    "thank you for watching",
    "thanks for watching",
    "thank you for watching!",
    "thank you very much for watching",
    "thank you very much",
    "thank you so much for watching",
    "please subscribe",
    "subscribe to my channel",
    "like and subscribe",
    "don't forget to subscribe",
    "see you next time",
    "see you in the next video",
    "until next time",
    "see you soon",
    "have a good day",
    "have a great day",
    "welcome back to my channel",
    # Subtitle / caption artifacts
    "subtitles by",
    "translated by",
    "captions by",
    "transcribed by",
    "subtitles created by",
    "all rights reserved",
    # Prompt leakage artifacts
    "technical interview conversation",
    "teechnical interview conversation",
    "technical interview",
    "candidate speaking",
    "candidate speaking clearly",
    # Phantom noise / sound cues
    "music",
    "[music]",
    "(music)",
    "[applause]",
    "(applause)",
    "[laughter]",
    "(laughter)",
    "[silence]",
    "(silence)",
    "[cough]",
    "(cough)",
    "[screaming]",
    "[whispering]",
    "[snicker]",
    "[cheering]",
    "applause",
    "laughter",
    "foreign language",
    "foreign",
    "whispering",
}

# Whitelist of legitimate single-word answers common in interviews
LEGITIMATE_SINGLE_WORDS = {
    "yes", "yeah", "yep", "sure", "okay", "ok", "right", "correct", "exactly",
    "definitely", "absolutely", "agreed", "agree", "true", "false", "no", "nope",
    "hello", "hi", "hey", "thanks", "thank", "done", "understood", "sorry",
    "continue", "next", "ready", "start", "stop", "please", "fine", "cool",
    "alright", "perfect", "good", "bye", "goodbye", "none", "neither", "either",
    "both", "maybe", "perhaps", "certainly", "indeed", "clear", "gotcha"
}

# Common single-word Whisper phantom hallucinations (rejected if isolated)
PHANTOM_SINGLE_WORDS = {
    "you", "the", "i", "a", "it", "so", "and", "or", "in", "to", "we", "he",
    "she", "they", "that", "this", "is", "was", "be", "do", "ah", "uh", "um",
    "oh", "huh", "shh", "hmm", "hm", "mhm", "mm"
}

# Characters indicative of non-speech artifacts
MUSIC_SYMBOLS = {"♪", "♫", "♬", "♩", "ø", "§"}


def _normalize_for_matching(text: str) -> str:
    """Normalize text: lowercase, remove punctuation, collapse whitespace."""
    text = text.lower().strip()
    text = re.sub(r"[^\w\s]", "", text)
    return re.sub(r"\s+", " ", text).strip()


def is_hallucination(text: str, recent_texts: Optional[Sequence[str]] = None) -> bool:
    """
    Evaluate whether a transcribed text segment is a Whisper hallucination.

    Args:
        text: The transcribed text to check.
        recent_texts: Optional sequence of recent chunk transcriptions to detect repetition loops.

    Returns:
        True if the text is identified as a hallucination, False if legitimate speech.
    """
    if not text:
        return True

    trimmed = text.strip()
    if not trimmed:
        return True

    # 1. Check for music symbols or brackets only
    if any(sym in trimmed for sym in MUSIC_SYMBOLS):
        cleaned = re.sub(r"[♪♫♬♩ø§]+", "", trimmed).strip()
        if not cleaned:
            return True

    normalized = _normalize_for_matching(trimmed)
    if not normalized:
        return True

    # 2. Match known hallucination phrases
    for phrase in HALLUCINATION_PHRASES:
        if phrase in normalized:
            # Outro, subtitle, or prompt leakage phrases are never legitimate candidate speech
            if len(normalized) <= max(len(phrase) + 35, 80):
                return True

    # 3. Single-word evaluation
    words = normalized.split()
    if len(words) == 1:
        single_word = words[0]
        # If it's a known phantom or not in legitimate interview answers and very short
        if single_word in PHANTOM_SINGLE_WORDS:
            return True
        if single_word not in LEGITIMATE_SINGLE_WORDS and len(single_word) <= 3:
            return True

    # 4. Intra-segment repetition loop (e.g. "you you you you" or "thank you thank you thank you")
    if len(words) >= 4:
        # Check single-word loop
        word_counts = {}
        for w in words:
            word_counts[w] = word_counts.get(w, 0) + 1
        most_common_count = max(word_counts.values())
        if most_common_count / len(words) >= 0.75 and len(word_counts) <= 2:
            return True

        # Check 2-word phrase loop
        if len(words) >= 6 and len(words) % 2 == 0:
            bigrams = [f"{words[i]} {words[i+1]}" for i in range(0, len(words) - 1, 2)]
            if len(set(bigrams)) == 1:
                return True

    # 5. Inter-chunk repetition loop (same phrase repeated consecutively across 3+ chunks)
    if recent_texts and len(recent_texts) >= 2:
        norm_recent = [_normalize_for_matching(t) for t in recent_texts[-2:] if t.strip()]
        if len(norm_recent) >= 2 and norm_recent[-1] == normalized and norm_recent[-2] == normalized:
            return True

    return False


def clean_transcript_text(text: str) -> str:
    """
    Clean minor hallucination markers (like [music] or ♪) from text while preserving
    actual speech if present.
    """
    if not text:
        return ""

    cleaned = text
    # Remove music notes
    cleaned = re.sub(r"[♪♫♬♩ø§]+", "", cleaned)
    # Remove bracketed artifacts
    cleaned = re.sub(r"\[(music|applause|laughter|silence|cough|screaming|cheering)\]", "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\((music|applause|laughter|silence|cough|screaming|cheering)\)", "", cleaned, flags=re.IGNORECASE)
    # Collapse multiple whitespace
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    return cleaned
