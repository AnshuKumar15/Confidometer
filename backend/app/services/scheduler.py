import asyncio
import logging
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.models.autoapply_models import (
    AutoApplyConfig, CandidateProfile, UserPreferences, DiscoveredJob,
    JobMatch, Application, ActivityLog, AutoApplyNotification, ResumeVersion
)
from app.services.job_discovery import JobDiscoveryEngine
from app.services.job_matcher import JobMatcher
from app.services.feedback_learner import FeedbackLearner
from app.services.cover_letter_generator import generate_cover_letter
from app.services.form_filler import generate_form_answers

logger = logging.getLogger("autoapply.scheduler")

_scheduler_task = None
_running = False

async def run_autoapply_cycle_for_user(db: Session, config: AutoApplyConfig):
    """Run job discovery and matching cycle for a single user."""
    user_id = config.user_id

    # Fetch user candidate profile & preferences
    profile_model = db.query(CandidateProfile).filter(CandidateProfile.user_id == user_id).first()
    prefs_model = db.query(UserPreferences).filter(UserPreferences.user_id == user_id).first()

    if not profile_model or not prefs_model:
        logger.info(f"[AutoApply] User {user_id} incomplete profile/preferences. Skipping.")
        return

    profile_dict = {
        "name": profile_model.name,
        "skills": profile_model.skills or [],
        "technical_skills": profile_model.technical_skills or [],
        "soft_skills": profile_model.soft_skills or [],
        "work_experience": profile_model.work_experience or [],
        "projects": profile_model.projects or [],
        "education": profile_model.education or []
    }

    prefs_dict = {
        "job_titles": prefs_model.job_titles or ["Software Engineer", "AI Engineer", "Developer"],
        "locations": prefs_model.locations or ["Remote"],
        "work_modes": prefs_model.work_modes or [],
        "min_salary": prefs_model.min_salary,
        "preferred_salary": prefs_model.preferred_salary,
        "blacklisted_companies": prefs_model.blacklisted_companies or [],
        "blocked_keywords": prefs_model.blocked_keywords or [],
        "experience_level": prefs_model.experience_level or "0-1 year",
        "min_match_score": 0.0
    }

    # 1. Job Discovery
    engine = JobDiscoveryEngine(user_api_keys=prefs_model.api_keys or {})
    discovered_jobs = await engine.discover_jobs(prefs_dict["job_titles"], prefs_dict["locations"])

    new_jobs_count = 0
    matched_count = 0

    all_fps = [j["fingerprint"] for j in discovered_jobs if j.get("fingerprint")]
    if not all_fps:
        return

    # 2. Batch lookup: Find all existing jobs in one query
    existing_jobs = db.query(DiscoveredJob).filter(DiscoveredJob.fingerprint.in_(all_fps)).all()
    existing_jobs_by_fp = {job.fingerprint: job for job in existing_jobs}

    # 3. Bulk insert new jobs in batches of 50, and enrich existing job locations
    new_job_instances = []
    seen_fps_in_batch = set()
    for job_data in discovered_jobs:
        fp = job_data["fingerprint"]
        if fp not in existing_jobs_by_fp and fp not in seen_fps_in_batch:
            seen_fps_in_batch.add(fp)
            new_job_instances.append(DiscoveredJob(**job_data))
        elif fp in existing_jobs_by_fp:
            existing_job = existing_jobs_by_fp[fp]
            new_loc = job_data.get("location") or ""
            curr_loc = existing_job.location or ""
            if "not specified" in curr_loc.lower() and "not specified" not in new_loc.lower():
                existing_job.location = new_loc
            elif "remote" in curr_loc.lower() and "remote" not in new_loc.lower() and len(new_loc.strip()) > 1 and "not specified" not in new_loc.lower():
                existing_job.location = f"{new_loc}, Remote"
            elif "remote" not in curr_loc.lower() and "remote" in new_loc.lower() and "not specified" not in curr_loc.lower() and "remote" not in curr_loc.lower():
                existing_job.location = f"{curr_loc}, Remote"

    if new_job_instances:
        for i in range(0, len(new_job_instances), 50):
            chunk = new_job_instances[i:i+50]
            db.add_all(chunk)
            db.commit()
            for j in chunk:
                existing_jobs_by_fp[j.fingerprint] = j
        new_jobs_count = len(new_job_instances)
    else:
        db.commit()

    # 4. Batch lookup: Find all existing matches for this user in one query
    all_job_ids = [job.id for job in existing_jobs_by_fp.values() if job.id]
    existing_matched_job_ids = set()
    if all_job_ids:
        existing_matches = db.query(JobMatch.job_id).filter(
            JobMatch.user_id == user_id,
            JobMatch.job_id.in_(all_job_ids)
        ).all()
        existing_matched_job_ids = {r[0] for r in existing_matches}

    # 5. Evaluate matches in-memory and batch insert (guided by candidate skip feedback)
    skip_signals = FeedbackLearner.get_user_feedback_signals(user_id, db)
    new_match_instances = []
    for job_data in discovered_jobs:
        fp = job_data["fingerprint"]
        db_job = existing_jobs_by_fp.get(fp)
        if not db_job or db_job.id in existing_matched_job_ids:
            continue

        existing_matched_job_ids.add(db_job.id)

        match_res = JobMatcher.evaluate_match_fast(profile_dict, prefs_dict, job_data, skip_signals=skip_signals)
        # If the matcher explicitly skipped the job (e.g. location/experience mismatch), preserve skipped
        if match_res.get("status") == "skipped":
            pass
        elif match_res["overall_score"] > 0:
            match_res["status"] = "matched"
            match_res["skip_reason"] = None

        job_match = JobMatch(
            user_id=user_id,
            job_id=db_job.id,
            overall_score=match_res["overall_score"],
            confidence_score=match_res["confidence_score"],
            skill_match_score=match_res["skill_match_score"],
            experience_match_score=match_res["experience_match_score"],
            missing_skills=match_res["missing_skills"],
            strengths=match_res["strengths"],
            match_reasons=match_res["match_reasons"],
            rejection_reasons=match_res["rejection_reasons"],
            status=match_res["status"],
            skip_reason=match_res["skip_reason"]
        )
        new_match_instances.append(job_match)
        if match_res["status"] == "matched":
            matched_count += 1

    if new_match_instances:
        for i in range(0, len(new_match_instances), 50):
            db.add_all(new_match_instances[i:i+50])
            db.commit()

    if matched_count > 0 or new_jobs_count > 0:
        log = ActivityLog(
            user_id=user_id,
            action="cycle_completed",
            details={
                "new_jobs_found": new_jobs_count,
                "jobs_matched": matched_count,
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
        )
        db.add(log)
        db.commit()

async def scheduler_loop():
    """Background loop that executes every N minutes."""
    global _running
    logger.info("[AutoApply] Scheduler loop started.")
    while _running:
        try:
            db = SessionLocal()
            active_configs = db.query(AutoApplyConfig).filter(AutoApplyConfig.enabled == True).all()
            for config in active_configs:
                await run_autoapply_cycle_for_user(db, config)
            db.close()
        except Exception as e:
            logger.error(f"[AutoApply] Error in scheduler loop: {e}")

        await asyncio.sleep(60 * 15) # Run cycle every 15 minutes

def start_scheduler():
    global _running, _scheduler_task
    if not _running:
        _running = True
        try:
            loop = asyncio.get_running_loop()
            _scheduler_task = loop.create_task(scheduler_loop())
        except RuntimeError:
            pass

def stop_scheduler():
    global _running
    _running = False
