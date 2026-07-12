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


def calculate_stress_tolerance_score(
    fidgeting_index: float,
    speech_rate_variance: float,
    filler_count: int,
    eye_contact: float
) -> float:
    """
    Evaluate candidate's composure and stability under simulated stress.
    Returns a score from 0 to 100.
    """
    # Ideal eye contact is high, penalty if it drops significantly under stress
    eye_contact_penalty = max(0.0, 80.0 - eye_contact) * 0.5
    
    # Fidgeting index (excessive repetitive motion) directly penalizes stress score
    fidgeting_penalty = max(0.0, fidgeting_index - 30.0) * 0.4
    
    # Speaking rate variance (vocal shakiness) penalizes stress score
    speech_variance_penalty = max(0.0, speech_rate_variance - 20.0) * 0.4
    
    # Filler words penalty
    filler_penalty = min(20.0, filler_count * 1.5)

    score = 100.0 - (eye_contact_penalty + fidgeting_penalty + speech_variance_penalty + filler_penalty)
    return round(max(0.0, min(100.0, score)), 2)