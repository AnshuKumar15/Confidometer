def calculate_confidence_score(
    filler_count: int,
    eye_contact: float,
    gesture: float,
    voice: float,
    speaking_rate: float = 75.0
):
    """
    Calculate overall confidence score from individual metrics.

    All inputs should be 0-100 except filler_count (raw integer).
    Returns a 0-100 float.
    """
    filler_score = max(0, 100 - filler_count * 3)

    # Confidence Score Breakdown:
    # - Eye Contact: 30% (most important for interviews)
    # - Voice Stability: 25% (consistent delivery)
    # - Filler Score: 25% (minimal ums/ahs/likes)
    # - Speaking Rate: 15% (replaces old hardcoded baseline)
    # - Gesture: 5% (supplementary signal)
    confidence = (
        0.30 * eye_contact +
        0.25 * voice +
        0.25 * filler_score +
        0.15 * speaking_rate +
        0.05 * gesture
    )

    return round(confidence, 2)