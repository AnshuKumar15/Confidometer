def calculate_confidence_score(
    filler_count: int,
    eye_contact: float,
    gesture: float,
    voice: float
):

    filler_score = max(0, 100 - filler_count * 2)

    confidence = (
        0.25 * eye_contact +
        0.20 * voice +
        0.20 * filler_score +
        0.20 * gesture +
        0.15 * 75
    )

    return round(confidence, 2)