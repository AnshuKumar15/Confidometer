"""
Smart Speech-to-Text service using Whisper with self-correction capabilities.

This module provides real-time transcription with intelligent correction:
- Maintains a rolling history of transcribed segments
- Detects when users repeat misheard phrases
- Automatically corrects earlier segments when higher-confidence alternatives arrive
- Uses phonetic similarity matching and Whisper confidence scores
"""

import math
from difflib import SequenceMatcher
from dataclasses import dataclass, field


@dataclass
class TranscriptSegment:
    """A single transcribed segment with metadata for correction decisions."""
    text: str
    confidence: float  # 0.0 (worst) to 1.0 (best), derived from Whisper log probs
    timestamp: float  # monotonic timestamp when this segment was created
    corrected: bool = False  # whether this segment was corrected by a later one
    original_text: str = ""  # if corrected, what it was before


def _normalize_text(text: str) -> str:
    """Normalize text for comparison: lowercase, strip punctuation, collapse whitespace."""
    import re
    text = text.lower().strip()
    text = re.sub(r"[^\w\s]", "", text)  # remove punctuation
    text = re.sub(r"\s+", " ", text)  # collapse whitespace
    return text


def _phonetic_similarity(a: str, b: str) -> float:
    """
    Compute phonetic similarity between two strings.
    Uses SequenceMatcher ratio on normalized text as a proxy for phonetic closeness.
    Returns 0.0 (completely different) to 1.0 (identical).
    """
    norm_a = _normalize_text(a)
    norm_b = _normalize_text(b)

    if not norm_a or not norm_b:
        return 0.0

    return SequenceMatcher(None, norm_a, norm_b).ratio()


def _word_overlap_ratio(a: str, b: str) -> float:
    """
    Compute word-level overlap (Jaccard) between two texts.
    Helps detect partial repetitions like "I think it's sure" vs "sure sure".
    """
    words_a = set(_normalize_text(a).split())
    words_b = set(_normalize_text(b).split())

    if not words_a or not words_b:
        return 0.0

    intersection = words_a & words_b
    union = words_a | words_b

    return len(intersection) / len(union) if union else 0.0


def _extract_confidence(result: dict) -> float:
    """
    Extract an overall confidence score from a Whisper transcription result.
    Whisper provides avg_logprob per segment; we convert to a 0-1 probability.
    """
    segments = result.get("segments", [])
    if not segments:
        return 0.5  # neutral confidence if no segments

    # Average the avg_logprob across all segments
    log_probs = [seg.get("avg_logprob", -1.0) for seg in segments]
    avg_log_prob = sum(log_probs) / len(log_probs)

    # Convert log probability to 0-1 scale
    # Whisper log probs are typically between -2.0 (bad) and 0.0 (perfect)
    # We map this to 0.0 - 1.0
    confidence = math.exp(avg_log_prob)  # e^logprob gives probability
    return max(0.0, min(1.0, confidence))


class SmartTranscriber:
    """
    Maintains transcript history and performs intelligent self-correction.

    When a new segment arrives that is phonetically similar to a recent segment
    but has higher confidence, it replaces the old one — simulating the
    "I said SURE SURE not so so" behavior.
    """

    # How many recent segments to check for corrections
    CORRECTION_WINDOW = 5

    # Minimum phonetic similarity to consider two segments as "same intent"
    SIMILARITY_THRESHOLD = 0.45

    # Minimum confidence improvement required to trigger a correction
    CONFIDENCE_IMPROVEMENT_THRESHOLD = 0.05

    def __init__(self):
        self.segments: list[TranscriptSegment] = []
        self._monotonic_counter = 0.0

    def _next_timestamp(self) -> float:
        self._monotonic_counter += 1.0
        return self._monotonic_counter

    def add_segment(self, text: str, confidence: float) -> dict:
        """
        Add a new transcribed segment and check for corrections.

        Returns:
            dict with keys:
            - "text": the (possibly corrected) text
            - "corrections": list of {index, old_text, new_text} if any corrections were made
            - "full_transcript": the complete corrected transcript so far
        """
        text = text.strip()
        if not text:
            return {
                "text": "",
                "corrections": [],
                "full_transcript": self.get_full_transcript(),
            }

        corrections = []
        new_segment = TranscriptSegment(
            text=text,
            confidence=confidence,
            timestamp=self._next_timestamp(),
        )

        # Check recent segments for potential corrections
        window_start = max(0, len(self.segments) - self.CORRECTION_WINDOW)
        best_match_idx = -1
        best_similarity = 0.0

        for i in range(window_start, len(self.segments)):
            old_seg = self.segments[i]
            if old_seg.corrected:
                continue  # skip already-corrected segments

            similarity = _phonetic_similarity(old_seg.text, text)
            word_overlap = _word_overlap_ratio(old_seg.text, text)

            # Combined similarity score: phonetic + word overlap
            combined = (similarity * 0.7) + (word_overlap * 0.3)

            if combined > self.SIMILARITY_THRESHOLD and combined > best_similarity:
                best_similarity = combined
                best_match_idx = i

        if best_match_idx >= 0:
            old_seg = self.segments[best_match_idx]
            confidence_improvement = confidence - old_seg.confidence

            if confidence_improvement > self.CONFIDENCE_IMPROVEMENT_THRESHOLD:
                # The new segment is a higher-confidence version of the old one
                # Correct the old segment
                old_text = old_seg.text
                old_seg.original_text = old_text
                old_seg.text = text
                old_seg.confidence = confidence
                old_seg.corrected = True

                corrections.append({
                    "index": best_match_idx,
                    "old_text": old_text,
                    "new_text": text,
                })

                # Don't add the new segment as a duplicate — we've merged it
                return {
                    "text": text,
                    "corrections": corrections,
                    "full_transcript": self.get_full_transcript(),
                }

        # No correction — just append the new segment
        self.segments.append(new_segment)

        return {
            "text": text,
            "corrections": corrections,
            "full_transcript": self.get_full_transcript(),
        }

    def get_full_transcript(self) -> str:
        """Get the complete transcript with all corrections applied."""
        parts = [seg.text for seg in self.segments if seg.text.strip()]
        return " ".join(parts)

    def get_segment_count(self) -> int:
        return len(self.segments)

    def reset(self):
        """Clear all segments and start fresh."""
        self.segments.clear()
        self._monotonic_counter = 0.0
