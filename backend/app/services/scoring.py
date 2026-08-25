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


def calculate_blended_score(
    interview_type: str,
    filler_count: int,
    eye_contact: float,
    gesture: float,
    voice: float,
    speaking_rate: float = 75.0,
    technical_knowledge: float = 50.0,
    explanation_quality: float = 50.0,
    use_of_words: float = 50.0,
    negotiation_score: float = None,
    code_quality: float = None,
    optimization: float = None,
    thinking_process: float = None,
    communication: float = None,
) -> float:
    """
    Calculate unified interview readiness score blending content quality and delivery poise.
    Weights are customized according to interview round type:
    - Technical: 70% Content (Tech 40%, Expl 35%, Words 25%) + 30% Delivery
    - DSA: 70% Content (Code 35%, Opt 25%, Thinking 25%, Comm 15%) + 30% Delivery
    - Behavioural: 50% Content (Expl 45%, Words 30%, Tech 25%) + 50% Delivery
    - HR: 40% Content (Words 40%, Expl 40%, Tech 20%) + 60% Delivery
    - Negotiation: 55% Content (Neg 50%, Words 25%, Expl 25%) + 45% Delivery
    """
    # 1. Delivery score (behavioral poise, camera presence, speech fluency)
    delivery_score = calculate_confidence_score(
        filler_count=filler_count,
        eye_contact=eye_contact,
        gesture=gesture,
        voice=voice,
        speaking_rate=speaking_rate
    )

    itype = (interview_type or "technical").lower().strip()

    # 2. Content score & weights based on interview round type
    if itype == "technical":
        # 70% Content, 30% Delivery
        content_score = (
            0.40 * technical_knowledge +
            0.35 * explanation_quality +
            0.25 * use_of_words
        )
        content_weight = 0.70
        delivery_weight = 0.30

    elif itype == "dsa":
        # 70% Content, 30% Delivery
        if code_quality is not None and optimization is not None and thinking_process is not None:
            comm = communication if communication is not None else use_of_words
            content_score = (
                0.35 * code_quality +
                0.25 * optimization +
                0.25 * thinking_process +
                0.15 * comm
            )
        else:
            content_score = (
                0.40 * technical_knowledge +
                0.35 * explanation_quality +
                0.25 * use_of_words
            )
        content_weight = 0.70
        delivery_weight = 0.30

    elif itype == "behavioural":
        # 50% Content, 50% Delivery
        content_score = (
            0.45 * explanation_quality +
            0.30 * use_of_words +
            0.25 * technical_knowledge
        )
        content_weight = 0.50
        delivery_weight = 0.50

    elif itype == "hr":
        # 40% Content, 60% Delivery
        content_score = (
            0.40 * use_of_words +
            0.40 * explanation_quality +
            0.20 * technical_knowledge
        )
        content_weight = 0.40
        delivery_weight = 0.60

    elif itype == "negotiation":
        # 55% Content, 45% Delivery
        neg_val = negotiation_score if negotiation_score is not None else 60.0
        content_score = (
            0.50 * neg_val +
            0.25 * use_of_words +
            0.25 * explanation_quality
        )
        content_weight = 0.55
        delivery_weight = 0.45

    else:
        # Default 50/50 fallback
        content_score = (
            0.40 * technical_knowledge +
            0.35 * explanation_quality +
            0.25 * use_of_words
        )
        content_weight = 0.50
        delivery_weight = 0.50

    blended = (content_weight * content_score) + (delivery_weight * delivery_score)
    return round(max(0.0, min(100.0, blended)), 2)