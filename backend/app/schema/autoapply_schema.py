from pydantic import BaseModel, EmailStr
from typing import Optional, List, Dict, Any
from datetime import datetime

# ── Candidate Profile Schemas ──

class WorkExperienceSchema(BaseModel):
    role: str
    company: str
    duration: Optional[str] = None
    description: Optional[str] = None
    achievements: Optional[List[str]] = []

class EducationSchema(BaseModel):
    degree: str
    institution: str
    year: Optional[str] = None
    field_of_study: Optional[str] = None

class CertificationSchema(BaseModel):
    name: str
    issuer: Optional[str] = None
    year: Optional[str] = None

class ProjectSchema(BaseModel):
    title: str
    description: Optional[str] = None
    technologies: Optional[List[str]] = []
    link: Optional[str] = None

class PublicationSchema(BaseModel):
    title: str
    publisher: Optional[str] = None
    year: Optional[str] = None
    link: Optional[str] = None

class CandidateProfileBase(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    skills: Optional[List[str]] = []
    technical_skills: Optional[List[str]] = []
    soft_skills: Optional[List[str]] = []
    education: Optional[List[EducationSchema]] = []
    certifications: Optional[List[CertificationSchema]] = []
    work_experience: Optional[List[WorkExperienceSchema]] = []
    projects: Optional[List[ProjectSchema]] = []
    publications: Optional[List[PublicationSchema]] = []
    achievements: Optional[List[str]] = []
    languages: Optional[List[str]] = []
    github: Optional[str] = None
    linkedin: Optional[str] = None
    portfolio: Optional[str] = None
    website: Optional[str] = None
    career_goals: Optional[str] = None

class CandidateProfileCreate(CandidateProfileBase):
    pass

class CandidateProfileUpdate(CandidateProfileBase):
    pass

class CandidateProfileResponse(CandidateProfileBase):
    id: int
    user_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ── User Preferences Schemas ──

class UserPreferencesBase(BaseModel):
    job_titles: Optional[List[str]] = []
    locations: Optional[List[str]] = []
    work_modes: Optional[List[str]] = ["Remote", "Hybrid", "On-site"]
    min_salary: Optional[float] = None
    preferred_salary: Optional[float] = None
    currency: Optional[str] = "USD"
    employment_types: Optional[List[str]] = ["Full-Time"]
    company_sizes: Optional[List[str]] = []
    blacklisted_companies: Optional[List[str]] = []
    experience_level: Optional[str] = None
    visa_sponsorship: Optional[bool] = False
    immediate_joining: Optional[bool] = False
    remote_only: Optional[bool] = False
    open_to_relocation: Optional[bool] = False
    industry_preferences: Optional[List[str]] = []
    blocked_keywords: Optional[List[str]] = []
    career_goal_intent: Optional[str] = None
    education_level: Optional[str] = None
    api_keys: Optional[Dict[str, str]] = {}

class UserPreferencesCreate(UserPreferencesBase):
    pass

class UserPreferencesUpdate(UserPreferencesBase):
    pass

class UserPreferencesResponse(UserPreferencesBase):
    id: int
    user_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ── Resume Version Schemas ──

class ResumeVersionResponse(BaseModel):
    id: int
    user_id: int
    label: str
    file_path: str
    file_name: str
    is_default: bool
    parsed_summary: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


# ── Discovered Job Schemas ──

class DiscoveredJobResponse(BaseModel):
    id: int
    title: str
    company: str
    location: Optional[str] = None
    employment_type: Optional[str] = None
    salary_min: Optional[float] = None
    salary_max: Optional[float] = None
    currency: Optional[str] = "USD"
    description: Optional[str] = None
    required_skills: Optional[List[str]] = []
    preferred_skills: Optional[List[str]] = []
    application_url: str
    source_platform: str
    posted_date: Optional[str] = None
    deadline: Optional[str] = None
    fingerprint: str
    status: str
    created_at: datetime

    class Config:
        from_attributes = True


# ── Job Match Schemas ──

class JobMatchResponse(BaseModel):
    id: int
    user_id: int
    job_id: int
    overall_score: float
    confidence_score: float
    skill_match_score: float
    experience_match_score: float
    missing_skills: Optional[List[str]] = []
    strengths: Optional[List[str]] = []
    match_reasons: Optional[List[str]] = []
    rejection_reasons: Optional[List[str]] = []
    status: str
    skip_reason: Optional[str] = None
    created_at: datetime
    job: Optional[DiscoveredJobResponse] = None

class MatchStatusUpdate(BaseModel):
    status: str # "matched", "applied", "saved", "skipped", "rejected"
    skip_reason: Optional[str] = None


# ── Application Schemas ──

class ApplicationStatusUpdate(BaseModel):
    status: str # "submitted", "interview", "offer", "rejected", "withdrawn"
    notes: Optional[str] = None

class ApplicationResponse(BaseModel):
    id: int
    user_id: int
    job_id: int
    match_id: Optional[int] = None
    resume_version_id: Optional[int] = None
    cover_letter: Optional[str] = None
    form_answers: Optional[Dict[str, Any]] = {}
    unanswered_questions: Optional[List[str]] = []
    status: str
    error_message: Optional[str] = None
    notes: Optional[str] = None
    applied_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    job: Optional[DiscoveredJobResponse] = None

    class Config:
        from_attributes = True


# ── Config & Onboarding Schemas ──

class AutoApplyConfigBase(BaseModel):
    enabled: Optional[bool] = False
    min_match_score: Optional[float] = 85.0
    daily_limit: Optional[int] = 20
    search_frequency_minutes: Optional[int] = 60
    cover_letter_style: Optional[str] = "professional"
    working_hours_start: Optional[str] = "09:00"
    working_hours_end: Optional[str] = "18:00"

class AutoApplyConfigUpdate(AutoApplyConfigBase):
    pass

class AutoApplyConfigResponse(AutoApplyConfigBase):
    id: int
    user_id: int
    paused_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class OnboardingCompleteRequest(BaseModel):
    profile: CandidateProfileCreate
    preferences: UserPreferencesCreate
    config: Optional[AutoApplyConfigUpdate] = None


# ── Dashboard & Analytics Schemas ──

class DashboardStatsResponse(BaseModel):
    applications_today: int
    applications_this_week: int
    applications_this_month: int
    total_jobs_found: int
    total_jobs_matched: int
    total_jobs_applied: int
    total_jobs_skipped: int
    total_jobs_saved: int
    pending_applications: int
    interviews: int
    offers: int
    rejections: int
    average_match_score: float
    success_rate: float
    automation_enabled: bool
    top_missing_skills: List[Dict[str, Any]]
    status_distribution: Dict[str, int]


class ActivityLogResponse(BaseModel):
    id: int
    action: str
    details: Dict[str, Any]
    created_at: datetime

    class Config:
        from_attributes = True


class NotificationResponse(BaseModel):
    id: int
    type: str
    title: str
    message: str
    data: Dict[str, Any]
    read: bool
    created_at: datetime

    class Config:
        from_attributes = True

