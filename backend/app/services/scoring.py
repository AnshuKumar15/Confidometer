def calculate_confidence_score(
    filler_count: int,
    eye_contact: float,
    gesture: float,
    voice: float
):

    filler_score = max(0, 100 - filler_count * 2)

    # Confidence Score Breakdown:
    # - Eye Contact: 30% (most important for interviews)
    # - Voice Stability: 25% (consistent delivery)
    # - Filler Score: 25% (minimal ums/ahs/likes)
    # - Gesture: 5% (reduced; future replacement planned)
    # - Baseline: 15% (buffer for other factors)
    confidence = (
        0.30 * eye_contact +
        0.25 * voice +
        0.25 * filler_score +
        0.05 * gesture +
        0.15 * 75
    )

    return round(confidence, 2)