import os
import uuid
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query, Request
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timezone, timedelta
from app.rate_limiter import limiter, RATE_SEARCH, RATE_UPLOAD, RATE_STANDARD

from app.database import get_db
from app.utils.security import get_current_user, get_optional_current_user
from app.models.user import User
from app.models.autoapply_models import (
    CandidateProfile, UserPreferences, ResumeVersion, DiscoveredJob,
    JobMatch, Application, AutoApplyConfig, ActivityLog, AutoApplyNotification, SavedAnswer
)
from app.schema.autoapply_schema import (
    CandidateProfileCreate, CandidateProfileUpdate, CandidateProfileResponse,
    UserPreferencesCreate, UserPreferencesUpdate, UserPreferencesResponse,
    ResumeVersionResponse, DiscoveredJobResponse, JobMatchResponse, MatchStatusUpdate,
    ApplicationResponse, ApplicationStatusUpdate, AutoApplyConfigUpdate,
    AutoApplyConfigResponse, DashboardStatsResponse, ActivityLogResponse,
    NotificationResponse, OnboardingCompleteRequest
)
from app.services.resume_parser import parse_resume_file
from app.services.scheduler import run_autoapply_cycle_for_user
from app.services.job_discovery import generate_job_fingerprint
from app.services.job_matcher import JobMatcher
from app.services.feedback_learner import FeedbackLearner

router = APIRouter()

UPLOAD_DIR = os.path.join(os.environ.get("UPLOAD_DIR", "uploads"), "resumes")
os.makedirs(UPLOAD_DIR, exist_ok=True)

# ── ONBOARDING & RESUME PARSING ──

@router.post("/resume/parse")
@limiter.limit(RATE_UPLOAD)
async def parse_resume_endpoint(
    request: Request,
    file: UploadFile = File(...),
    current_user: Optional[User] = Depends(get_optional_current_user)
):
    """Upload resume file and parse into structured profile JSON for user review."""
    prefix = f"user_{current_user.id}" if current_user else f"guest_{uuid.uuid4().hex[:8]}"
    file_path = os.path.join(UPLOAD_DIR, f"{prefix}_{file.filename}")
    contents = await file.read()
    with open(file_path, "wb") as f:
        f.write(contents)

    parsed_profile = parse_resume_file(file_path)
    parsed_profile["file_path"] = file_path
    parsed_profile["file_name"] = file.filename
    return parsed_profile

@router.post("/onboard")
@limiter.limit(RATE_STANDARD)
def complete_onboarding(
    request: Request,
    payload: OnboardingCompleteRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Complete one-time onboarding by saving CandidateProfile, UserPreferences, and Config."""
    try:
        profile_data = payload.profile.model_dump()
        prefs_data = payload.preferences.model_dump()
        config_data = payload.config.model_dump() if payload.config else {}

        # 1. Candidate Profile
        profile = db.query(CandidateProfile).filter(CandidateProfile.user_id == current_user.id).first()
        if not profile:
            profile = CandidateProfile(user_id=current_user.id, **profile_data)
            db.add(profile)
        else:
            for k, v in profile_data.items():
                if v is not None:
                    setattr(profile, k, v)

        # 2. Preferences
        prefs = db.query(UserPreferences).filter(UserPreferences.user_id == current_user.id).first()
        if not prefs:
            prefs = UserPreferences(user_id=current_user.id, **prefs_data)
            db.add(prefs)
        else:
            for k, v in prefs_data.items():
                if v is not None:
                    setattr(prefs, k, v)

        # 3. Config
        config_data["enabled"] = True
        config = db.query(AutoApplyConfig).filter(AutoApplyConfig.user_id == current_user.id).first()
        if not config:
            config = AutoApplyConfig(user_id=current_user.id, **config_data)
            db.add(config)
        else:
            for k, v in config_data.items():
                if v is not None:
                    setattr(config, k, v)

        # 4. Audit Log
        log = ActivityLog(user_id=current_user.id, action="onboarded", details={"status": "completed"})
        db.add(log)

        db.commit()
        return {"message": "Onboarding completed successfully", "user_id": current_user.id}
    except Exception as e:
        db.rollback()
        print(f"[ERROR] Onboarding failed: {e}")
        raise HTTPException(status_code=500, detail=f"Onboarding failed: {str(e)}")


# ── PROFILE & PREFERENCES ──

@router.get("/profile")
@limiter.limit(RATE_STANDARD)
def get_profile(request: Request, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    profile = db.query(CandidateProfile).filter(CandidateProfile.user_id == current_user.id).first()
    if not profile:
        return None
    return profile

@router.put("/profile", response_model=CandidateProfileResponse)
@limiter.limit(RATE_STANDARD)
def update_profile(
    request: Request,
    payload: CandidateProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    profile = db.query(CandidateProfile).filter(CandidateProfile.user_id == current_user.id).first()
    if not profile:
        profile = CandidateProfile(user_id=current_user.id, **payload.model_dump())
        db.add(profile)
    else:
        for k, v in payload.model_dump(exclude_unset=True).items():
            setattr(profile, k, v)
    db.commit()
    db.refresh(profile)
    return profile

@router.get("/preferences")
@limiter.limit(RATE_STANDARD)
def get_preferences(request: Request, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    prefs = db.query(UserPreferences).filter(UserPreferences.user_id == current_user.id).first()
    if not prefs:
        return None
    return prefs

@router.put("/preferences", response_model=UserPreferencesResponse)
@limiter.limit(RATE_STANDARD)
def update_preferences(
    request: Request,
    payload: UserPreferencesUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    prefs = db.query(UserPreferences).filter(UserPreferences.user_id == current_user.id).first()
    if not prefs:
        prefs = UserPreferences(user_id=current_user.id, **payload.model_dump())
        db.add(prefs)
    else:
        for k, v in payload.model_dump(exclude_unset=True).items():
            setattr(prefs, k, v)
    db.commit()
    db.refresh(prefs)
    return prefs


# ── DISCOVERED JOBS & MATCHES ──

@router.get("/jobs", response_model=List[JobMatchResponse])
@limiter.limit(RATE_STANDARD)
def get_discovered_jobs(
    request: Request,
    status: Optional[str] = None,
    platform: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = 100,
    offset: int = 0,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(JobMatch).join(DiscoveredJob).filter(JobMatch.user_id == current_user.id)
    if status and status != "all":
        query = query.filter(JobMatch.status == status)
    if platform and platform.lower() != "all":
        p = platform.strip().lower()
        if p == "foundit":
            query = query.filter((DiscoveredJob.source_platform.ilike("%foundit%")) | (DiscoveredJob.source_platform.ilike("%monster%")))
        elif p == "indeed":
            query = query.filter((DiscoveredJob.source_platform.ilike("%indeed%")) | (DiscoveredJob.source_platform == "jsearch"))
        else:
            query = query.filter(DiscoveredJob.source_platform.ilike(f"%{p}%"))
    if search and search.strip():
        s = f"%{search.strip()}%"
        query = query.filter(
            (DiscoveredJob.title.ilike(s)) |
            (DiscoveredJob.company.ilike(s)) |
            (DiscoveredJob.location.ilike(s))
        )
    return query.order_by(JobMatch.overall_score.desc(), DiscoveredJob.id.desc()).offset(offset).limit(limit).all()

@router.post("/jobs/search")
@limiter.limit(RATE_SEARCH)
async def trigger_job_search(request: Request, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Trigger manual job search and evaluation cycle."""
    config = db.query(AutoApplyConfig).filter(AutoApplyConfig.user_id == current_user.id).first()
    if not config:
        config = AutoApplyConfig(user_id=current_user.id, enabled=True)
        db.add(config)
        db.commit()

    # Reset min match score to 0 so all matches > 0% are recommended
    config.min_match_score = 0.0  # type: ignore
    db.commit()

    # Re-evaluate all existing non-applied matches against updated matcher rules
    prefs_model = db.query(UserPreferences).filter(UserPreferences.user_id == current_user.id).first()
    profile_model = db.query(CandidateProfile).filter(CandidateProfile.user_id == current_user.id).first()
    if prefs_model and profile_model:
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
            "job_titles": prefs_model.job_titles or ["Software Engineer", "AI Engineer"],
            "locations": prefs_model.locations or ["Remote"],
            "work_modes": prefs_model.work_modes or [],
            "min_salary": prefs_model.min_salary,
            "preferred_salary": prefs_model.preferred_salary,
            "blacklisted_companies": prefs_model.blacklisted_companies or [],
            "blocked_keywords": prefs_model.blocked_keywords or [],
            "experience_level": prefs_model.experience_level or "0-1 year",
            "min_match_score": 0.0
        }
        skip_signals = FeedbackLearner.get_user_feedback_signals(current_user.id, db)
        old_matches = db.query(JobMatch).filter(JobMatch.user_id == current_user.id).all()
        for m in old_matches:
            if m.job and m.status != "applied":
                job_dict = {
                    "title": m.job.title,
                    "company": m.job.company,
                    "location": m.job.location,
                    "description": m.job.description or "",
                    "required_skills": m.job.required_skills or []
                }
                eval_res = JobMatcher.evaluate_match_fast(profile_dict, prefs_dict, job_dict, skip_signals=skip_signals)
                m.overall_score = eval_res["overall_score"]
                m.confidence_score = eval_res["confidence_score"]
                m.skill_match_score = eval_res["skill_match_score"]
                m.experience_match_score = eval_res["experience_match_score"]
                m.missing_skills = eval_res["missing_skills"]
                m.strengths = eval_res["strengths"]
                m.match_reasons = eval_res["match_reasons"]
                m.rejection_reasons = eval_res["rejection_reasons"]
                m.status = eval_res["status"]
                m.skip_reason = eval_res["skip_reason"]
        db.commit()

    await run_autoapply_cycle_for_user(db, config)
    return {"message": "Job discovery cycle completed"}


@router.put("/jobs/{match_id}/status", response_model=JobMatchResponse)
@limiter.limit(RATE_STANDARD)
def update_job_match_status(
    request: Request,
    match_id: int,
    payload: MatchStatusUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    match_record = db.query(JobMatch).filter(JobMatch.id == match_id, JobMatch.user_id == current_user.id).first()
    if not match_record:
        raise HTTPException(status_code=404, detail="Job match not found")

    match_record.status = payload.status
    if payload.skip_reason:
        if isinstance(payload.skip_reason, list):
            match_record.skip_reason = ", ".join(payload.skip_reason)
            reasons_list = payload.skip_reason
        else:
            match_record.skip_reason = str(payload.skip_reason)
            reasons_list = [r.strip() for r in payload.skip_reason.split(",") if r.strip()]

    # Handle Candidate Skip Feedback & Adaptive Improvement (Multi-Option Support)
    if payload.status == "skipped" and payload.skip_reason:
        full_reasons_str = match_record.skip_reason.lower()
        job = match_record.job
        triggered_any = False

        # 1. No longer accepting applications / Expired link
        if any(k in full_reasons_str for k in ["no longer", "accepting", "expired", "closed", "broken", "inactive"]):
            triggered_any = True
            if job:
                job.status = "expired"
                # Automatically skip any other active matches for this dead job
                other_matches = db.query(JobMatch).filter(
                    JobMatch.job_id == job.id,
                    JobMatch.id != match_record.id,
                    JobMatch.status == "matched"
                ).all()
                for om in other_matches:
                    om.status = "skipped"
                    om.skip_reason = "Expired posting (reported by candidate)"

            log = ActivityLog(
                user_id=current_user.id,
                action="job_deactivated_expired",
                details={
                    "job_id": match_record.job_id,
                    "title": job.title if job else "",
                    "company": job.company if job else "",
                    "reasons": reasons_list,
                    "learning_action": "Marked job posting as expired; suppressed from future discovery"
                }
            )
            db.add(log)

        user_prefs = db.query(UserPreferences).filter(UserPreferences.user_id == current_user.id).first()
        pref_locs_clean = [FeedbackLearner.normalize_str(l) for l in (user_prefs.locations or []) if l] if user_prefs else []
        pref_titles_clean = [FeedbackLearner.normalize_str(t) for t in (user_prefs.job_titles or []) if t] if user_prefs else []
        is_remote_pref = any("remote" in l or "worldwide" in l or "anywhere" in l for l in pref_locs_clean) or any("remote" in (m or "").lower() for m in (user_prefs.work_modes if user_prefs else []))

        # 2. Location mismatch
        if any(k in full_reasons_str for k in ["location", "city", "relocation", "remote", "onsite"]):
            triggered_any = True
            job_loc = (job.location or "").strip() if job else ""
            cascaded_count = 0

            # Immediate cascade: Auto-skip other active matched jobs ONLY IF location is truly an unselected foreign location
            if job and job.location:
                norm_loc = FeedbackLearner.normalize_str(job.location)
                is_loc_target = (
                    any(pl in norm_loc or norm_loc in pl for pl in pref_locs_clean if len(pl) >= 3) or
                    (is_remote_pref and any(rk in norm_loc for rk in ["remote", "worldwide", "anywhere"]))
                )
                if norm_loc and not is_loc_target and norm_loc not in ["not specified", "unspecified", "none", "remote", "worldwide"]:
                    other_loc_matches = db.query(JobMatch).join(DiscoveredJob).filter(
                        JobMatch.user_id == current_user.id,
                        JobMatch.id != match_record.id,
                        JobMatch.status == "matched"
                    ).all()
                    for om in other_loc_matches:
                        om_loc = FeedbackLearner.normalize_str(om.job.location if om.job else "")
                        if om_loc and (om_loc == norm_loc or (len(norm_loc) >= 5 and (norm_loc in om_loc or om_loc in norm_loc))):
                            om.status = "skipped"
                            om.skip_reason = f"Location mismatch: Cascade skipped based on candidate feedback for '{job.location}'"
                            cascaded_count += 1

            log = ActivityLog(
                user_id=current_user.id,
                action="feedback_location_mismatch",
                details={
                    "job_id": match_record.job_id,
                    "title": job.title if job else "",
                    "location": job_loc,
                    "reasons": reasons_list,
                    "cascaded_skipped_count": cascaded_count,
                    "learning_action": f"Recorded location mismatch for '{job_loc}'. Auto-cleaned {cascaded_count} other active matches."
                }
            )
            db.add(log)

        # 3. Job / Skill mismatch
        if any(k in full_reasons_str for k in ["skill", "stack", "role", "tech"]):
            triggered_any = True
            job_title = job.title if job else ""
            job_skills = (job.required_skills or [])[:5] if job else []
            log = ActivityLog(
                user_id=current_user.id,
                action="feedback_skill_mismatch",
                details={
                    "job_id": match_record.job_id,
                    "title": job_title,
                    "skills": job_skills,
                    "reasons": reasons_list,
                    "learning_action": f"Recorded candidate skill/role mismatch for '{job_title}'"
                }
            )
            db.add(log)

        # 4. Experience mismatch
        if any(k in full_reasons_str for k in ["experience", "seniority", "years"]):
            triggered_any = True
            job_title = job.title if job else ""
            cascaded_exp_count = 0

            # Immediate cascade: Auto-skip only unaligned senior or leadership title patterns
            if job and job.title:
                norm_title = FeedbackLearner.normalize_str(job.title)
                is_title_target = any(pt == norm_title or (len(pt) >= 5 and pt == norm_title) for pt in pref_titles_clean)
                if norm_title and not is_title_target:
                    other_exp_matches = db.query(JobMatch).join(DiscoveredJob).filter(
                        JobMatch.user_id == current_user.id,
                        JobMatch.id != match_record.id,
                        JobMatch.status == "matched"
                    ).all()
                    for om in other_exp_matches:
                        om_title = FeedbackLearner.normalize_str(om.job.title if om.job else "")
                        if om_title and om_title == norm_title:
                            om.status = "skipped"
                            om.skip_reason = f"Experience mismatch: Cascade skipped based on candidate feedback for '{job.title}'"
                            cascaded_exp_count += 1

            log = ActivityLog(
                user_id=current_user.id,
                action="feedback_experience_mismatch",
                details={
                    "job_id": match_record.job_id,
                    "title": job_title,
                    "reasons": reasons_list,
                    "cascaded_skipped_count": cascaded_exp_count,
                    "learning_action": f"Calibrating experience tier boundaries for '{job_title}'. Auto-cleaned {cascaded_exp_count} other active matches."
                }
            )
            db.add(log)

        # 5. General fallback
        if not triggered_any:
            log = ActivityLog(
                user_id=current_user.id,
                action="job_skipped_general",
                details={
                    "job_id": match_record.job_id,
                    "title": job.title if job else "",
                    "reasons": reasons_list
                }
            )
            db.add(log)

    # If marked as applied, create or update Application record to 'submitted'
    if payload.status == "applied":
        app_record = db.query(Application).filter(
            Application.user_id == current_user.id,
            Application.job_id == match_record.job_id
        ).first()
        if not app_record:
            app_record = Application(
                user_id=current_user.id,
                job_id=match_record.job_id,
                match_id=match_record.id,
                status="submitted",
                applied_at=datetime.now(timezone.utc)
            )
            db.add(app_record)
        else:
            app_record.status = "submitted"
            if not app_record.applied_at:
                app_record.applied_at = datetime.now(timezone.utc)

        log = ActivityLog(
            user_id=current_user.id,
            action="job_applied_manually",
            details={"job_id": match_record.job_id, "title": match_record.job.title if match_record.job else ""}
        )
        db.add(log)

    db.commit()
    db.refresh(match_record)
    return match_record


# ── APPLICATIONS ──

@router.get("/applications", response_model=List[ApplicationResponse])
@limiter.limit(RATE_STANDARD)
def get_applications(
    request: Request,
    status: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(Application).filter(Application.user_id == current_user.id)
    if status:
        query = query.filter(Application.status == status)
    return query.order_by(Application.created_at.desc()).offset(offset).limit(limit).all()

@router.put("/applications/{app_id}/status", response_model=ApplicationResponse)
@limiter.limit(RATE_STANDARD)
def update_application_status(
    request: Request,
    app_id: int,
    payload: ApplicationStatusUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    app_record = db.query(Application).filter(Application.id == app_id, Application.user_id == current_user.id).first()
    if not app_record:
        raise HTTPException(status_code=404, detail="Application not found")

    app_record.status = payload.status
    if payload.notes:
        app_record.notes = payload.notes
    if payload.status == "submitted" and not app_record.applied_at:
        app_record.applied_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(app_record)
    return app_record


# ── AUTOMATION CONFIG & CONTROLS ──

@router.get("/config", response_model=AutoApplyConfigResponse)
@limiter.limit(RATE_STANDARD)
def get_config(request: Request, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    config = db.query(AutoApplyConfig).filter(AutoApplyConfig.user_id == current_user.id).first()
    if not config:
        config = AutoApplyConfig(user_id=current_user.id, enabled=False)
        db.add(config)
        db.commit()
        db.refresh(config)
    return config

@router.put("/config", response_model=AutoApplyConfigResponse)
@limiter.limit(RATE_STANDARD)
def update_config(
    request: Request,
    payload: AutoApplyConfigUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    config = db.query(AutoApplyConfig).filter(AutoApplyConfig.user_id == current_user.id).first()
    if not config:
        config = AutoApplyConfig(user_id=current_user.id, **payload.model_dump())
        db.add(config)
    else:
        for k, v in payload.model_dump(exclude_unset=True).items():
            setattr(config, k, v)
    db.commit()
    db.refresh(config)
    return config

@router.post("/config/pause")
@limiter.limit(RATE_STANDARD)
def pause_automation(request: Request, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    config = db.query(AutoApplyConfig).filter(AutoApplyConfig.user_id == current_user.id).first()
    if config:
        config.enabled = False
        config.paused_at = datetime.now(timezone.utc)
        db.commit()
    return {"message": "Automation paused", "enabled": False}

@router.post("/config/resume")
@limiter.limit(RATE_STANDARD)
def resume_automation(request: Request, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    config = db.query(AutoApplyConfig).filter(AutoApplyConfig.user_id == current_user.id).first()
    if config:
        config.enabled = True
        config.paused_at = None
        db.commit()
    return {"message": "Automation resumed", "enabled": True}


# ── DASHBOARD & NOTIFICATIONS ──

@router.get("/dashboard", response_model=DashboardStatsResponse)
@limiter.limit(RATE_STANDARD)
def get_dashboard_stats(request: Request, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    user_id = current_user.id
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

    apps_today = db.query(Application).filter(Application.user_id == user_id, Application.created_at >= today_start).count()
    week_start = now - timedelta(days=7)
    month_start = now - timedelta(days=30)
    apps_week = db.query(Application).filter(Application.user_id == user_id, Application.created_at >= week_start).count()
    apps_month = db.query(Application).filter(Application.user_id == user_id, Application.created_at >= month_start).count()

    total_jobs = db.query(JobMatch).filter(JobMatch.user_id == user_id).count()
    matched_jobs = db.query(JobMatch).filter(JobMatch.user_id == user_id, JobMatch.status == "matched").count()
    skipped_jobs = db.query(JobMatch).filter(JobMatch.user_id == user_id, JobMatch.status == "skipped").count()
    saved_jobs = db.query(JobMatch).filter(JobMatch.user_id == user_id, JobMatch.status == "saved").count()

    ready_apps = db.query(Application).filter(Application.user_id == user_id, Application.status == "ready").count()
    submitted_apps = db.query(Application).filter(Application.user_id == user_id, Application.status == "submitted").count()
    interviews = db.query(Application).filter(Application.user_id == user_id, Application.status == "interview").count()
    offers = db.query(Application).filter(Application.user_id == user_id, Application.status == "offer").count()
    rejections = db.query(Application).filter(Application.user_id == user_id, Application.status == "rejected").count()
    total_applied = ready_apps + submitted_apps + interviews + offers + rejections

    config = db.query(AutoApplyConfig).filter(AutoApplyConfig.user_id == user_id).first()
    enabled = config.enabled if config else False

    # Average match score
    matches = db.query(JobMatch.overall_score).filter(JobMatch.user_id == user_id).all()
    scores = [m[0] for m in matches if m[0] is not None]
    avg_score = round(sum(scores) / len(scores), 1) if scores else 0.0

    # Aggregate real missing skills from user's matched jobs
    from collections import Counter
    missing_counter = Counter()
    match_skills = db.query(JobMatch.missing_skills).filter(JobMatch.user_id == user_id, JobMatch.status == "matched").all()
    for (m_list,) in match_skills:
        if isinstance(m_list, list):
            for s in m_list:
                if s and isinstance(s, str):
                    missing_counter[s.strip().title()] += 1
    top_missing = [{"skill": k, "count": v} for k, v in missing_counter.most_common(5)]

    return {
        "applications_today": apps_today,
        "applications_this_week": apps_week,
        "applications_this_month": apps_month,
        "total_jobs_found": total_jobs,
        "total_jobs_matched": matched_jobs,
        "total_jobs_applied": total_applied,
        "total_jobs_skipped": skipped_jobs,
        "total_jobs_saved": saved_jobs,
        "pending_applications": ready_apps,
        "interviews": interviews,
        "offers": offers,
        "rejections": rejections,
        "average_match_score": avg_score,
        "success_rate": round(((interviews + offers) / max(1, total_applied)) * 100, 1) if total_applied > 0 else 0.0,
        "automation_enabled": enabled,
        "top_missing_skills": top_missing,
        "status_distribution": {
            "Ready": ready_apps,
            "Submitted": submitted_apps,
            "Interview": interviews,
            "Offer": offers,
            "Rejected": rejections
        }
    }

@router.get("/notifications", response_model=List[NotificationResponse])
@limiter.limit(RATE_STANDARD)
def get_notifications(request: Request, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.query(AutoApplyNotification).filter(AutoApplyNotification.user_id == current_user.id).order_by(AutoApplyNotification.created_at.desc()).limit(20).all()

@router.put("/notifications/{notif_id}/read")
@limiter.limit(RATE_STANDARD)
def mark_notification_read(request: Request, notif_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    n = db.query(AutoApplyNotification).filter(AutoApplyNotification.id == notif_id, AutoApplyNotification.user_id == current_user.id).first()
    if n:
        n.read = True
        db.commit()
    return {"status": "success"}

@router.get("/activity", response_model=List[ActivityLogResponse])
@limiter.limit(RATE_STANDARD)
def get_activity_log(request: Request, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.query(ActivityLog).filter(ActivityLog.user_id == current_user.id).order_by(ActivityLog.created_at.desc()).limit(50).all()
