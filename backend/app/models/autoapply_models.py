from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, Text, ForeignKey, JSON
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from app.database import Base

class CandidateProfile(Base):
    __tablename__ = "candidate_profiles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, index=True)

    name = Column(String, nullable=True)
    email = Column(String, nullable=True)
    phone = Column(String, nullable=True)

    skills = Column(JSON, default=list)            # List of skill strings
    technical_skills = Column(JSON, default=list)  # List of tech skill strings
    soft_skills = Column(JSON, default=list)       # List of soft skill strings

    education = Column(JSON, default=list)         # List of dicts: [{degree, institution, year, field_of_study}]
    certifications = Column(JSON, default=list)    # List of dicts: [{name, issuer, year}]
    work_experience = Column(JSON, default=list)   # List of dicts: [{role, company, duration, description, achievements}]
    projects = Column(JSON, default=list)          # List of dicts: [{title, description, technologies, link}]
    publications = Column(JSON, default=list)      # List of dicts: [{title, publisher, year, link}]
    achievements = Column(JSON, default=list)       # List of strings
    languages = Column(JSON, default=list)          # List of strings

    github = Column(String, nullable=True)
    linkedin = Column(String, nullable=True)
    portfolio = Column(String, nullable=True)
    website = Column(String, nullable=True)

    career_goals = Column(Text, nullable=True)
    raw_resume_text = Column(Text, nullable=True)

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    user = relationship("User")


class UserPreferences(Base):
    __tablename__ = "user_preferences"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, index=True)

    job_titles = Column(JSON, default=list)           # ["AI Engineer", "Backend Developer"]
    locations = Column(JSON, default=list)            # ["Remote", "New York, NY", "London"]
    work_modes = Column(JSON, default=list)           # ["Remote", "Hybrid", "On-site"]
    min_salary = Column(Float, nullable=True)
    preferred_salary = Column(Float, nullable=True)
    currency = Column(String, default="USD")

    employment_types = Column(JSON, default=list)     # ["Full-Time", "Contract"]
    company_sizes = Column(JSON, default=list)        # ["Startup", "Enterprise"]
    blacklisted_companies = Column(JSON, default=list) # ["Company X"]
    experience_level = Column(String, nullable=True)   # "Senior", "Mid", "Entry Level"

    visa_sponsorship = Column(Boolean, default=False)
    immediate_joining = Column(Boolean, default=False)
    remote_only = Column(Boolean, default=False)
    open_to_relocation = Column(Boolean, default=False)
    industry_preferences = Column(JSON, default=list) # ["Fintech", "AI/ML"]
    blocked_keywords = Column(JSON, default=list)     # ["WordPress", "PHP"]
    career_goal_intent = Column(String, nullable=True) # "Secure, long-term job in my field"
    education_level = Column(String, nullable=True)    # "Bachelor's"

    # Tier 2 API Keys (optional user-supplied keys)
    api_keys = Column(JSON, default=dict)             # {"jsearch_key": "...", "adzuna_app_id": "..."}

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    user = relationship("User")


class ResumeVersion(Base):
    __tablename__ = "resume_versions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)

    label = Column(String, nullable=False)            # e.g., "AI Resume", "Backend Resume"
    file_path = Column(String, nullable=False)
    file_name = Column(String, nullable=False)
    is_default = Column(Boolean, default=False)
    parsed_summary = Column(Text, nullable=True)

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    user = relationship("User")


class DiscoveredJob(Base):
    __tablename__ = "discovered_jobs"

    id = Column(Integer, primary_key=True, index=True)

    title = Column(String, nullable=False, index=True)
    company = Column(String, nullable=False, index=True)
    location = Column(String, nullable=True)
    employment_type = Column(String, nullable=True)
    salary_min = Column(Float, nullable=True)
    salary_max = Column(Float, nullable=True)
    currency = Column(String, default="USD")

    description = Column(Text, nullable=True)
    required_skills = Column(JSON, default=list)
    preferred_skills = Column(JSON, default=list)
    application_url = Column(String, nullable=False)
    source_platform = Column(String, nullable=False)  # "adzuna", "remotive", "arbeitnow", "jsearch", "scraper"
    posted_date = Column(String, nullable=True)
    deadline = Column(String, nullable=True)

    fingerprint = Column(String, unique=True, index=True) # Hash for deduplication
    status = Column(String, default="active")            # "active", "expired"

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class JobMatch(Base):
    __tablename__ = "job_matches"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    job_id = Column(Integer, ForeignKey("discovered_jobs.id"), index=True)

    overall_score = Column(Float, default=0.0)
    confidence_score = Column(Float, default=0.0)
    skill_match_score = Column(Float, default=0.0)
    experience_match_score = Column(Float, default=0.0)

    missing_skills = Column(JSON, default=list)
    strengths = Column(JSON, default=list)
    match_reasons = Column(JSON, default=list)
    rejection_reasons = Column(JSON, default=list)

    status = Column(String, default="matched") # "matched", "skipped", "applied", "saved", "rejected"
    skip_reason = Column(String, nullable=True)

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    user = relationship("User")
    job = relationship("DiscoveredJob")


class Application(Base):
    __tablename__ = "auto_applications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    job_id = Column(Integer, ForeignKey("discovered_jobs.id"), index=True)
    match_id = Column(Integer, ForeignKey("job_matches.id"), nullable=True)
    resume_version_id = Column(Integer, ForeignKey("resume_versions.id"), nullable=True)

    cover_letter = Column(Text, nullable=True)
    form_answers = Column(JSON, default=dict)   # { question: answer }
    unanswered_questions = Column(JSON, default=list) # Questions needing user input

    status = Column(String, default="ready")    # "ready", "submitted", "failed", "paused", "interview", "offer", "rejected", "withdrawn"
    error_message = Column(Text, nullable=True)
    notes = Column(Text, nullable=True)

    applied_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    user = relationship("User")
    job = relationship("DiscoveredJob")
    match = relationship("JobMatch")
    resume_version = relationship("ResumeVersion")


class AutoApplyConfig(Base):
    __tablename__ = "auto_apply_configs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, index=True)

    enabled = Column(Boolean, default=False)
    min_match_score = Column(Float, default=85.0)
    daily_limit = Column(Integer, default=20)
    search_frequency_minutes = Column(Integer, default=60)
    cover_letter_style = Column(String, default="professional")

    working_hours_start = Column(String, default="09:00")
    working_hours_end = Column(String, default="18:00")

    paused_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    user = relationship("User")


class ActivityLog(Base):
    __tablename__ = "auto_apply_activity_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)

    action = Column(String, nullable=False) # "onboarded", "job_discovered", "job_matched", "application_submitted", "application_failed", "paused", etc.
    details = Column(JSON, default=dict)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    user = relationship("User")


class SavedAnswer(Base):
    __tablename__ = "saved_answers"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)

    question_pattern = Column(String, nullable=False) # e.g., "years of experience"
    answer = Column(Text, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    user = relationship("User")


class AutoApplyNotification(Base):
    __tablename__ = "auto_apply_notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)

    type = Column(String, nullable=False) # "match_found", "applied", "failed", "info_needed", "interview", "daily_summary"
    title = Column(String, nullable=False)
    message = Column(Text, nullable=False)
    data = Column(JSON, default=dict)
    read = Column(Boolean, default=False)

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    user = relationship("User")
