import re
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Set, Optional
from sqlalchemy.orm import Session
from app.models.autoapply_models import JobMatch, DiscoveredJob, ActivityLog

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
        - penalty_locations: locations previously rejected for location mismatch
        - penalty_titles: job titles/levels previously rejected for experience or role mismatch
        - penalty_companies: companies skipped >= 2 times
        - exp_mismatch_count: number of experience mismatches
        - loc_mismatch_count: number of location mismatches
        - exp_strict_mode: true if user frequently skips for experience (tightens open-role acceptance)
        - loc_strict_mode: true if user frequently skips for location (tightens remote/generic acceptance)
        """
        cutoff_date = datetime.now(timezone.utc) - timedelta(days=days_window)

        # Query all skipped matches for this user in window
        skipped_matches = (
            db.query(JobMatch)
            .filter(
                JobMatch.user_id == user_id,
                JobMatch.status == "skipped",
                JobMatch.skip_reason.isnot(None),
                JobMatch.created_at >= cutoff_date
            )
            .all()
        )

        penalty_locations: Set[str] = set()
        penalty_titles: Set[str] = set()
        company_skip_counts: Dict[str, int] = {}
        
        exp_mismatch_count = 0
        loc_mismatch_count = 0
        skill_mismatch_count = 0

        for match in skipped_matches:
            reason = (match.skip_reason or "").lower()
            job = match.job
            if not job:
                continue

            comp = FeedbackLearner.normalize_str(job.company)
            if comp:
                company_skip_counts[comp] = company_skip_counts.get(comp, 0) + 1

            # 1. Location mismatch signals
            if any(k in reason for k in ["location", "city", "relocation", "remote", "onsite"]):
                loc_mismatch_count += 1
                raw_loc = FeedbackLearner.normalize_str(job.location)
                if raw_loc and raw_loc not in ["not specified", "unspecified", "none"]:
                    penalty_locations.add(raw_loc)
                    # Extract individual city/location tokens if comma-separated
                    if job.location:
                        parts = [FeedbackLearner.normalize_str(p) for p in job.location.split(",") if p.strip()]
                        for p in parts:
                            if len(p) >= 3 and p not in ["india", "usa", "us", "uk"]:
                                penalty_locations.add(p)

            # 2. Experience mismatch signals
            if any(k in reason for k in ["experience", "seniority", "years"]):
                exp_mismatch_count += 1
                norm_title = FeedbackLearner.normalize_str(job.title)
                if norm_title:
                    penalty_titles.add(norm_title)

            # 3. Skill / Role mismatch signals
            if any(k in reason for k in ["skill", "stack", "role", "tech"]):
                skill_mismatch_count += 1
                norm_title = FeedbackLearner.normalize_str(job.title)
                if norm_title:
                    penalty_titles.add(norm_title)

        # Companies skipped >= 2 times become soft blacklisted
        penalty_companies = {
            comp for comp, count in company_skip_counts.items() if count >= 2
        }

        # Strict mode heuristics: if user had to correct the system >= 2 times
        exp_strict_mode = exp_mismatch_count >= 2
        loc_strict_mode = loc_mismatch_count >= 2

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
