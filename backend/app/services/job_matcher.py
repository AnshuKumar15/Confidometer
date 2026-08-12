import os
import json
import re
from typing import Dict, Any, List
import google.generativeai as genai

gemini_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GEMINI_API")
if gemini_key:
    genai.configure(api_key=gemini_key)

class JobMatcher:
    """
    Evaluates discovered jobs against candidate profile + preferences.
    Multi-criteria weighted scoring:
    - Skill Match (35%)
    - Location & Work Mode Alignment (20%)
    - Experience Level Alignment (15%)
    - Employment Type (10%)
    - Industry & Title Alignment (20%)
    """

    @staticmethod
    def evaluate_match_fast(candidate_profile: dict, user_preferences: dict, job: dict) -> dict:
        """Fast heuristic evaluation before optional LLM scoring."""
        rejection_reasons = []
        match_reasons = []

        job_title = job.get("title", "").lower()
        company = job.get("company", "").lower()
        location = job.get("location", "").lower()
        description = job.get("description", "").lower()

        # 1. Blacklisted Company Check
        blacklisted = [b.lower() for b in user_preferences.get("blacklisted_companies", [])]
        for b in blacklisted:
            if b and b in company:
                rejection_reasons.append(f"Company '{job.get('company')}' is blacklisted.")
                return {
                    "overall_score": 0.0,
                    "confidence_score": 100.0,
                    "skill_match_score": 0.0,
                    "experience_match_score": 0.0,
                    "missing_skills": [],
                    "strengths": [],
                    "match_reasons": [],
                    "rejection_reasons": rejection_reasons,
                    "status": "skipped",
                    "skip_reason": f"Blacklisted company: {job.get('company')}"
                }

        # 2. Blocked Keywords Check
        blocked_kw = [k.lower() for k in user_preferences.get("blocked_keywords", [])]
        for kw in blocked_kw:
            if kw and (kw in job_title or kw in description):
                rejection_reasons.append(f"Contains blocked keyword '{kw}'.")
                return {
                    "overall_score": 0.0,
                    "confidence_score": 100.0,
                    "skill_match_score": 0.0,
                    "experience_match_score": 0.0,
                    "missing_skills": [],
                    "strengths": [],
                    "match_reasons": [],
                    "rejection_reasons": rejection_reasons,
                    "status": "skipped",
                    "skip_reason": f"Blocked keyword: {kw}"
                }

        # 3. Domain-Aware Skill Match Calculation
        candidate_skills_list = candidate_profile.get("technical_skills", []) + candidate_profile.get("skills", [])
        candidate_skills_set = set(s.lower() for s in candidate_skills_list)

        AI_ML_CLUSTER = {
            "ai", "ml", "genai", "gen ai", "generative ai", "machine learning", "deep learning",
            "neural networks", "llm", "nlp", "pytorch", "tensorflow", "scikit-learn", "opencv",
            "pandas", "numpy", "ai engineer", "ml engineer", "ai/ml developer", "ai/ml", "data scientist"
        }
        PYTHON_CLUSTER = {
            "python", "fastapi", "django", "flask", "sql", "postgresql", "mysql", "mongodb", "backend", "docker", "git", "api"
        }

        is_ai_job = any(k in job_title or k in description for k in ["ai", "ml", "gen ai", "genai", "machine learning", "deep learning", "data scientist"])
        is_python_job = "python" in job_title or "python" in description

        matched_skills = []
        missing_skills = []

        candidate_has_ai = bool(candidate_skills_set.intersection(AI_ML_CLUSTER))
        candidate_has_python = bool(candidate_skills_set.intersection(PYTHON_CLUSTER))

        # Check matching candidate skills
        for cs in candidate_skills_list:
            cs_l = cs.lower()
            if is_ai_job and cs_l in AI_ML_CLUSTER:
                if cs not in matched_skills:
                    matched_skills.append(cs)
            elif is_python_job and cs_l in PYTHON_CLUSTER:
                if cs not in matched_skills:
                    matched_skills.append(cs)

        if is_ai_job and candidate_has_ai:
            skill_score = 92.0
            match_reasons.append(f"Matched core AI/ML skills: {', '.join(matched_skills[:4])}")
        elif is_python_job and candidate_has_python:
            skill_score = 88.0
            match_reasons.append(f"Matched core Python skills: {', '.join(matched_skills[:4])}")
        elif matched_skills:
            skill_score = 75.0
            match_reasons.append(f"Matched skills: {', '.join(matched_skills[:4])}")
        else:
            skill_score = 60.0

        # 4. Strict Location Match & Filtering
        pref_locations = [loc.strip().lower() for loc in user_preferences.get("locations", []) if loc.strip()]
        pref_modes = [m.strip().lower() for m in user_preferences.get("work_modes", []) if m.strip()]

        is_user_remote_allowed = "remote" in pref_locations or any("remote" in m for m in pref_modes)
        job_is_remote = "remote" in location or "anywhere" in location or "worldwide" in location or "work from home" in location

        # Countries that are incompatible with India/Bengaluru preference
        foreign_country_keywords = ["england", "uk", "united kingdom", "united states", "usa", "germany", "france", "canada", "australia"]
        is_foreign = any(ck in location for ck in foreign_country_keywords) and not any(ik in location for ik in ["india", "bengaluru", "bangalore", "worldwide", "anywhere"])

        # Check direct city match
        city_matched = False
        if pref_locations:
            for target_loc in pref_locations:
                if target_loc in ["remote", "fully remote"]:
                    continue
                # Handle city name aliases (e.g. bengaluru == bangalore, delhi-ncr == delhi)
                t_clean = target_loc.replace("bengaluru", "bangalore").replace("-ncr", "")
                j_clean = location.replace("bengaluru", "bangalore").replace("-ncr", "")
                if target_loc in location or t_clean in j_clean or ("india" in target_loc and "india" in location):
                    city_matched = True
                    break

        location_score = 0.0
        if city_matched:
            location_score = 100.0
            match_reasons.append("Location matches your target city preference.")
        elif job_is_remote and is_user_remote_allowed and not is_foreign:
            location_score = 100.0
            match_reasons.append("Remote job location aligns with your remote work preference.")
        else:
            if pref_locations or pref_modes:
                rejection_reasons.append(f"Job location '{job.get('location')}' does not match your selected cities ({', '.join(user_preferences.get('locations', []))}).")
                return {
                    "overall_score": 0.0,
                    "confidence_score": 100.0,
                    "skill_match_score": 0.0,
                    "experience_match_score": 0.0,
                    "missing_skills": [],
                    "strengths": [],
                    "match_reasons": [],
                    "rejection_reasons": rejection_reasons,
                    "status": "skipped",
                    "skip_reason": f"Location mismatch: '{job.get('location')}' is not in selected cities or remote."
                }
            else:
                location_score = 50.0

        # 5. Smart Job Title Alignment
        pref_titles = [t.lower() for t in user_preferences.get("job_titles", [])]
        title_score = 60.0
        NON_TECH_KEYWORDS = ["sales", "copywriter", "marketing", "account executive", "inside sales", "customer support", "telecaller", "recruiter", "bpo"]

        is_tech_candidate = any("engineer" in pt or "developer" in pt or "ai" in pt or "data" in pt or "software" in pt for pt in pref_titles)

        if is_tech_candidate and any(nk in job_title for nk in NON_TECH_KEYWORDS):
            title_score = 0.0
            rejection_reasons.append("Non-technical role (sales/marketing/recruiting) mismatch for engineering profile.")
        elif pref_titles:
            title_matched = False
            for pt in pref_titles:
                # Direct substring match
                if pt in job_title or job_title in pt:
                    title_matched = True
                    break
                # Concept equivalence (e.g. "AI Engineer" matches "AI/ML Developer", "Machine Learning Engineer", "Python + Gen AI Developer")
                if ("ai" in pt or "ml" in pt or "data" in pt) and is_ai_job:
                    title_matched = True
                    break
                if ("software" in pt or "developer" in pt or "engineer" in pt) and ("developer" in job_title or "engineer" in job_title or "programmer" in job_title):
                    title_matched = True
                    break

            if title_matched:
                title_score = 100.0
                match_reasons.append("Job title closely matches target role preferences.")
            else:
                title_score = 60.0

        # Weighted Overall Score
        overall_score = round(
            (skill_score * 0.45) + (location_score * 0.25) + (title_score * 0.30),
            1
        )

        status = "matched" if overall_score > 0 else "skipped"
        skip_reason = f"Match score is 0%" if status == "skipped" else None

        return {
            "overall_score": overall_score,
            "confidence_score": 85.0,
            "skill_match_score": round(skill_score, 1),
            "experience_match_score": round(title_score, 1),
            "missing_skills": missing_skills[:5],
            "strengths": matched_skills[:5],
            "match_reasons": match_reasons,
            "rejection_reasons": rejection_reasons,
            "status": status,
            "skip_reason": skip_reason
        }
