import json
from datetime import date, timedelta
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.models.speech import Speech
from app.models.user import User
from app.utils.security import get_current_user

router = APIRouter()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ── Badge Definitions ──
BADGE_DEFINITIONS = [
    {
        "id": "first_interview",
        "name": "First Steps",
        "description": "Complete your first mock interview",
        "icon": "🎯",
        "condition": lambda stats: stats["total_interviews"] >= 1,
    },
    {
        "id": "five_interviews",
        "name": "Warming Up",
        "description": "Complete 5 mock interviews",
        "icon": "🔥",
        "condition": lambda stats: stats["total_interviews"] >= 5,
    },
    {
        "id": "ten_interviews",
        "name": "Interview Veteran",
        "description": "Complete 10 mock interviews",
        "icon": "🏆",
        "condition": lambda stats: stats["total_interviews"] >= 10,
    },
    {
        "id": "eye_contact_master",
        "name": "Eye Contact Master",
        "description": "Score 80%+ eye contact in any interview",
        "icon": "👁️",
        "condition": lambda stats: stats["best_eye_contact"] >= 80,
    },
    {
        "id": "fluent_speaker",
        "name": "Fluent Speaker",
        "description": "Score 80%+ fluency in any interview",
        "icon": "🗣️",
        "condition": lambda stats: stats["best_fluency"] >= 80,
    },
    {
        "id": "confidence_king",
        "name": "Confidence King",
        "description": "Score 85%+ overall confidence",
        "icon": "👑",
        "condition": lambda stats: stats["best_confidence"] >= 85,
    },
    {
        "id": "streak_3",
        "name": "3-Day Streak",
        "description": "Practice for 3 consecutive days",
        "icon": "⚡",
        "condition": lambda stats: stats["streak"] >= 3,
    },
    {
        "id": "streak_7",
        "name": "Week Warrior",
        "description": "Practice for 7 consecutive days",
        "icon": "💎",
        "condition": lambda stats: stats["streak"] >= 7,
    },
    {
        "id": "all_round",
        "name": "All-Rounder",
        "description": "Complete Technical, HR, Behavioural, and DSA rounds",
        "icon": "🌟",
        "condition": lambda stats: stats["unique_types"] >= 4,
    },
    {
        "id": "negotiator",
        "name": "Master Negotiator",
        "description": "Complete a Salary Negotiation simulation",
        "icon": "💰",
        "condition": lambda stats: stats["has_negotiation"],
    },
]


def _update_streak(db: Session, user: User):
    """Update the user's daily streak based on their last active date."""
    today = date.today()
    last_active = user.last_active_date

    if last_active is None:
        user.streak_count = 1  # type: ignore
    elif last_active == today:
        pass  # Already active today, no change
    elif last_active == today - timedelta(days=1):
        user.streak_count = (user.streak_count or 0) + 1  # type: ignore
    else:
        user.streak_count = 1  # type: ignore  # Streak broken

    user.last_active_date = today  # type: ignore
    db.commit()


def _compute_badges(db: Session, user: User, speeches) -> list:
    """Compute which badges the user has earned based on their stats."""
    total = len(speeches)
    best_eye = max((s.eye_contact_percentage or 0 for s in speeches), default=0)
    best_fluency = max((s.fluency_score or 0 for s in speeches), default=0)
    best_confidence = max((s.confidence_score or 0 for s in speeches), default=0)
    unique_types = len(set(s.interview_type for s in speeches if s.interview_type))
    has_negotiation = any(s.interview_type == "negotiation" for s in speeches)

    stats = {
        "total_interviews": total,
        "best_eye_contact": best_eye,
        "best_fluency": best_fluency,
        "best_confidence": best_confidence,
        "streak": user.streak_count or 0,
        "unique_types": unique_types,
        "has_negotiation": has_negotiation,
    }

    earned = []
    for badge_def in BADGE_DEFINITIONS:
        try:
            if badge_def["condition"](stats):
                earned.append(badge_def["id"])
        except Exception:
            continue

    # Persist updated badges
    user.badges_unlocked = json.dumps(earned)  # type: ignore
    db.commit()

    return earned


@router.get("/")
def get_trends(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return historical performance trends, streak data, and badge progress."""

    # Update streak
    _update_streak(db, current_user)

    # Fetch all completed speeches
    speeches = (
        db.query(Speech)
        .filter(Speech.user_id == current_user.id, Speech.status == "completed")
        .order_by(Speech.created_at.asc())
        .all()
    )

    # Build trend data points (last 20 sessions)
    trend_points = []
    for s in speeches[-20:]:
        trend_points.append({
            "date": str(s.created_at)[:10] if s.created_at else None,
            "confidence": s.confidence_score,
            "eye_contact": s.eye_contact_percentage,
            "fluency": s.fluency_score,
            "filler_count": s.filler_count,
            "voice_stability": s.voice_stability_score,
            "interview_type": s.interview_type,
        })

    # Compute badges
    earned_badge_ids = _compute_badges(db, current_user, speeches)

    # Build full badge list with unlock status
    all_badges = []
    for badge_def in BADGE_DEFINITIONS:
        all_badges.append({
            "id": badge_def["id"],
            "name": badge_def["name"],
            "description": badge_def["description"],
            "icon": badge_def["icon"],
            "unlocked": badge_def["id"] in earned_badge_ids,
        })

    # Interview type breakdown
    type_counts = {}
    for s in speeches:
        t = s.interview_type or "unknown"
        type_counts[t] = type_counts.get(t, 0) + 1

    return {
        "streak": current_user.streak_count or 0,
        "total_interviews": len(speeches),
        "trend_data": trend_points,
        "badges": all_badges,
        "type_breakdown": type_counts,
    }
