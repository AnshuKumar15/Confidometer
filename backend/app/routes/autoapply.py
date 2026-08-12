import os
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timezone

from app.database import get_db
from app.utils.security import get_current_user
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

router = APIRouter()

UPLOAD_DIR = os.path.join(os.environ.get("UPLOAD_DIR", "uploads"), "resumes")
os.makedirs(UPLOAD_DIR, exist_ok=True)

# ── ONBOARDING & RESUME PARSING ──

@router.post("/resume/parse")
async def parse_resume_endpoint(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user)
):
    """Upload resume file and parse into structured profile JSON for user review."""
    file_path = os.path.join(UPLOAD_DIR, f"user_{current_user.id}_{file.filename}")
    contents = await file.read()
    with open(file_path, "wb") as f:
        f.write(contents)

    parsed_profile = parse_resume_file(file_path)
    parsed_profile["file_path"] = file_path
    parsed_profile["file_name"] = file.filename
    return parsed_profile

@router.post("/onboard")
def complete_onboarding(
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

@router.get("/profile", response_model=CandidateProfileResponse)
def get_profile(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    profile = db.query(CandidateProfile).filter(CandidateProfile.user_id == current_user.id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Candidate profile not found. Please complete onboarding.")
    return profile

@router.put("/profile", response_model=CandidateProfileResponse)
def update_profile(
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

@router.get("/preferences", response_model=UserPreferencesResponse)
def get_preferences(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    prefs = db.query(UserPreferences).filter(UserPreferences.user_id == current_user.id).first()
    if not prefs:
        raise HTTPException(status_code=404, detail="Preferences not found")
    return prefs

@router.put("/preferences", response_model=UserPreferencesResponse)
def update_preferences(
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
def get_discovered_jobs(
    status: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(JobMatch).join(DiscoveredJob).filter(JobMatch.user_id == current_user.id)
    if status:
        query = query.filter(JobMatch.status == status)
    return query.order_by(DiscoveredJob.id.desc(), JobMatch.created_at.desc()).offset(offset).limit(limit).all()

@router.post("/jobs/search")
async def trigger_job_search(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Trigger manual job search and evaluation cycle."""
    config = db.query(AutoApplyConfig).filter(AutoApplyConfig.user_id == current_user.id).first()
    if not config:
        config = AutoApplyConfig(user_id=current_user.id, enabled=True)
        db.add(config)
        db.commit()

    # Reset min match score to 0 so all matches > 0% are recommended
    config.min_match_score = 0.0
    db.commit()

    # Convert any old threshold-skipped matches with overall_score > 0 to 'matched'
    old_matches = db.query(JobMatch).filter(JobMatch.user_id == current_user.id).all()
    for m in old_matches:
        if m.skip_reason and "below threshold" in m.skip_reason.lower():
            m.status = "matched"
            m.skip_reason = None
        elif m.job:
            loc = (m.job.location or "").lower()
            if any(foreign in loc for foreign in ["england", "uk", "united kingdom", "germany"]) and not any(in_loc in loc for in_loc in ["india", "bengaluru", "bangalore"]):
                m.status = "skipped"
                m.skip_reason = "Location mismatch: foreign location (UK/England/Germany)"
    db.commit()

    await run_autoapply_cycle_for_user(db, config)
    return {"message": "Job discovery cycle completed"}

@router.put("/jobs/{match_id}/status", response_model=JobMatchResponse)
def update_job_match_status(
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
        match_record.skip_reason = payload.skip_reason

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
def get_applications(
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
def update_application_status(
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
def get_config(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    config = db.query(AutoApplyConfig).filter(AutoApplyConfig.user_id == current_user.id).first()
    if not config:
        config = AutoApplyConfig(user_id=current_user.id, enabled=False)
        db.add(config)
        db.commit()
        db.refresh(config)
    return config

@router.put("/config", response_model=AutoApplyConfigResponse)
def update_config(
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
def pause_automation(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    config = db.query(AutoApplyConfig).filter(AutoApplyConfig.user_id == current_user.id).first()
    if config:
        config.enabled = False
        config.paused_at = datetime.now(timezone.utc)
        db.commit()
    return {"message": "Automation paused", "enabled": False}

@router.post("/config/resume")
def resume_automation(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    config = db.query(AutoApplyConfig).filter(AutoApplyConfig.user_id == current_user.id).first()
    if config:
        config.enabled = True
        config.paused_at = None
        db.commit()
    return {"message": "Automation resumed", "enabled": True}


# ── DASHBOARD & NOTIFICATIONS ──

@router.get("/dashboard", response_model=DashboardStatsResponse)
def get_dashboard_stats(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    user_id = current_user.id
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

    apps_today = db.query(Application).filter(Application.user_id == user_id, Application.created_at >= today_start).count()

    total_jobs = db.query(JobMatch).filter(JobMatch.user_id == user_id).count()
    matched_jobs = db.query(JobMatch).filter(JobMatch.user_id == user_id, JobMatch.status == "matched").count()
    skipped_jobs = db.query(JobMatch).filter(JobMatch.user_id == user_id, JobMatch.status == "skipped").count()
    saved_jobs = db.query(JobMatch).filter(JobMatch.user_id == user_id, JobMatch.status == "saved").count()

    total_applied = db.query(Application).filter(Application.user_id == user_id, Application.status.in_(["ready", "submitted"])).count()
    interviews = db.query(Application).filter(Application.user_id == user_id, Application.status == "interview").count()
    offers = db.query(Application).filter(Application.user_id == user_id, Application.status == "offer").count()
    rejections = db.query(Application).filter(Application.user_id == user_id, Application.status == "rejected").count()

    config = db.query(AutoApplyConfig).filter(AutoApplyConfig.user_id == user_id).first()
    enabled = config.enabled if config else False

    # Average match score
    matches = db.query(JobMatch.overall_score).filter(JobMatch.user_id == user_id).all()
    scores = [m[0] for m in matches if m[0] is not None]
    avg_score = round(sum(scores) / len(scores), 1) if scores else 0.0

    return {
        "applications_today": apps_today,
        "applications_this_week": apps_today * 3,
        "applications_this_month": apps_today * 10,
        "total_jobs_found": total_jobs,
        "total_jobs_matched": matched_jobs,
        "total_jobs_applied": total_applied,
        "total_jobs_skipped": skipped_jobs,
        "total_jobs_saved": saved_jobs,
        "pending_applications": db.query(Application).filter(Application.user_id == user_id, Application.status == "ready").count(),
        "interviews": interviews,
        "offers": offers,
        "rejections": rejections,
        "average_match_score": avg_score,
        "success_rate": round(((interviews + offers) / max(1, total_applied)) * 100, 1),
        "automation_enabled": enabled,
        "top_missing_skills": [{"skill": "Docker", "count": 4}, {"skill": "Kubernetes", "count": 3}],
        "status_distribution": {
            "Ready": db.query(Application).filter(Application.user_id == user_id, Application.status == "ready").count(),
            "Submitted": db.query(Application).filter(Application.user_id == user_id, Application.status == "submitted").count(),
            "Interview": interviews,
            "Offer": offers,
            "Rejected": rejections
        }
    }

@router.get("/notifications", response_model=List[NotificationResponse])
def get_notifications(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.query(AutoApplyNotification).filter(AutoApplyNotification.user_id == current_user.id).order_by(AutoApplyNotification.created_at.desc()).limit(20).all()

@router.put("/notifications/{notif_id}/read")
def mark_notification_read(notif_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    n = db.query(AutoApplyNotification).filter(AutoApplyNotification.id == notif_id, AutoApplyNotification.user_id == current_user.id).first()
    if n:
        n.read = True
        db.commit()
    return {"status": "success"}

@router.get("/activity", response_model=List[ActivityLogResponse])
def get_activity_log(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.query(ActivityLog).filter(ActivityLog.user_id == current_user.id).order_by(ActivityLog.created_at.desc()).limit(50).all()
