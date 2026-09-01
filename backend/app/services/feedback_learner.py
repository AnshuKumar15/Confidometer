import re
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Set, Optional
from sqlalchemy.orm import Session
from app.models.autoapply_models import JobMatch, DiscoveredJob, ActivityLog, UserPreferences

class FeedbackLearner:
    """
    Analyzes candidate skip feedback history to dynamically adapt
    and improve matching accuracy for experience, location, company, and role preferences.
    """

    @staticmethod
    def normalize_str(s: Optional[str]) -> str:
        if not s:
            return ""
        # Lowercase, strip punctuation and extra whitespace
        cleaned = re.sub(r'[^a-zA-Z0-9\s]', ' ', s.lower())
        return re.sub(r'\s+', ' ', cleaned).strip()

    @staticmethod
    def get_user_feedback_signals(user_id: int, db: Session, days_window: int = 30) -> Dict[str, Any]:
        """
        Aggregate recent skip feedback (default 30 days) and extract strong signals:
        - penalty_locations: locations previously rejected for location mismatch (excluding candidate's chosen cities)
        - penalty_titles: job titles/levels previously rejected for experience or role mismatch (excluding candidate's target roles)
        - penalty_companies: companies skipped >= 2 times
        - exp_mismatch_count: number of experience mismatches
        - loc_mismatch_count: number of location mismatches
        - exp_strict_mode: true if user frequently skips for experience (tightens open-role acceptance)
        - loc_strict_mode: true if user frequently skips for location (tightens remote/generic acceptance)
        """
        cutoff_date = datetime.now(timezone.utc) - timedelta(days=days_window)

        # Retrieve user preferences to protect candidate's chosen locations and titles
        prefs_model = db.query(UserPreferences).filter(UserPreferences.user_id == user_id).first()
        protected_locations: Set[str] = set()
        protected_titles: Set[str] = set()
        if prefs_model:
            for l in (prefs_model.locations or []):
                if l and l.strip():
                    protected_locations.add(FeedbackLearner.normalize_str(l))
            for t in (prefs_model.job_titles or []):
                if t and t.strip():
                    protected_titles.add(FeedbackLearner.normalize_str(t))

        is_remote_preferred = (
            any("remote" in l or "worldwide" in l or "anywhere" in l for l in protected_locations) or
            any("remote" in (m or "").lower() for m in (prefs_model.work_modes if prefs_model else []))
        )
        if is_remote_preferred:
            protected_locations.update(["remote", "worldwide", "anywhere", "work from home", "wfh"])

        # Query actual candidate feedback events from ActivityLog
        feedback_logs = (
            db.query(ActivityLog)
            .filter(
                ActivityLog.user_id == user_id,
                ActivityLog.action.in_([
                    "feedback_location_mismatch",
                    "feedback_experience_mismatch",
                    "feedback_skill_mismatch",
                    "job_deactivated_expired",
                    "job_skipped_general"
                ]),
                ActivityLog.created_at >= cutoff_date
            )
            .all()
        )

        penalty_locations: Set[str] = set()
        penalty_titles: Set[str] = set()
        company_skip_counts: Dict[str, int] = {}
        
        exp_mismatch_count = 0
        loc_mismatch_count = 0
        skill_mismatch_count = 0

        for log in feedback_logs:
            details = log.details or {}
            action = log.action

            comp = FeedbackLearner.normalize_str(details.get("company"))
            if comp:
                company_skip_counts[comp] = company_skip_counts.get(comp, 0) + 1

            # 1. Location mismatch signals
            if action == "feedback_location_mismatch":
                loc_mismatch_count += 1
                raw_loc = FeedbackLearner.normalize_str(details.get("location"))
                if raw_loc and raw_loc not in ["not specified", "unspecified", "none", ""]:
                    # Never penalize candidate's explicitly chosen locations
                    if not any(pl in raw_loc or raw_loc in pl for pl in protected_locations if len(pl) >= 3):
                        penalty_locations.add(raw_loc)
                    if details.get("location"):
                        parts = [FeedbackLearner.normalize_str(p) for p in details.get("location", "").split(",") if p.strip()]
                        for p in parts:
                            if len(p) >= 3 and p not in ["india", "usa", "us", "uk", "karnataka", "maharashtra", "delhi ncr"]:
                                if not any(pl == p or (len(pl) >= 4 and (pl in p or p in pl)) for pl in protected_locations):
                                    penalty_locations.add(p)

            # 2. Experience mismatch signals
            elif action == "feedback_experience_mismatch":
                exp_mismatch_count += 1
                norm_title = FeedbackLearner.normalize_str(details.get("title"))
                if norm_title:
                    # Never penalize candidate's target job titles or sub-titles
                    is_protected = any(pt == norm_title or (len(pt) >= 4 and (pt in norm_title or norm_title in pt)) for pt in protected_titles)
                    if not is_protected:
                        penalty_titles.add(norm_title)

            # 3. Skill / Role mismatch signals
            elif action == "feedback_skill_mismatch":
                skill_mismatch_count += 1
                norm_title = FeedbackLearner.normalize_str(details.get("title"))
                if norm_title:
                    is_protected = any(pt == norm_title or (len(pt) >= 4 and (pt in norm_title or norm_title in pt)) for pt in protected_titles)
                    if not is_protected:
                        penalty_titles.add(norm_title)

        # Companies skipped >= 2 times become soft blacklisted
        penalty_companies = {
            comp for comp, count in company_skip_counts.items() if count >= 2
        }

        # Strict mode heuristics: if user had to correct the system >= 3 times on unaligned roles
        exp_strict_mode = exp_mismatch_count >= 3
        loc_strict_mode = loc_mismatch_count >= 3

        return {
            "penalty_locations": list(penalty_locations),
            "penalty_titles": list(penalty_titles),
            "penalty_companies": list(penalty_companies),
            "exp_mismatch_count": exp_mismatch_count,
            "loc_mismatch_count": loc_mismatch_count,
            "skill_mismatch_count": skill_mismatch_count,
            "exp_strict_mode": exp_strict_mode,
            "loc_strict_mode": loc_strict_mode,
        }
