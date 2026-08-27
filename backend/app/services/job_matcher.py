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
    def _evaluate_experience(user_exp: str, job_title: str, job_desc: str) -> tuple:
        """
        Evaluate candidate experience level vs job requirements.
        Returns: (score: float, match_reason: Optional[str], skip_reason: Optional[str])
        """
        title = (job_title or "").lower()
        desc = (job_desc or "")[:2000].lower()
        full_text = f"{title} {desc}"

        clean_title = re.sub(r'[^a-z0-9\s]', ' ', title)

        # 1. Seniority keywords in title
        senior_kws = [
            "senior", "sr", "lead", "principal", "staff", "architect",
            "director", "manager", "head of", "vp", "vice president", "tech lead",
            "team lead", "engineering manager", "iii", "iv", "sde 3", "sde 2", "l4", "l5"
        ]
        is_senior_title = any(re.search(r"\b" + re.escape(kw) + r"\b", clean_title) for kw in senior_kws)

        # 2. Entry-level keywords in title
        entry_kws = [
            "junior", "jr", "associate", "entry level", "graduate",
            "trainee", "fresher", "intern", "internship", "sde 1",
            "sde i", "l1", "level 1", "campus", "student"
        ]
        is_entry_title = any(re.search(r"\b" + re.escape(kw) + r"\b", clean_title) for kw in entry_kws)

        # 3. Detect numerical years of experience REQUIRED from applicant
        # Filter out company history/founding years like 'founded 10 years ago' or 'for over 15 years in business'
        sanitized_text = re.sub(
            r'\b(?:founded|established|in business|ago|history of|for over|over|past|last)\s*\d+\s*(?:years?|yrs?)',
            ' ',
            full_text
        )

        exp_patterns = [
            r'(\d+)\s*(?:\+|plus)?\s*(?:-|to)?\s*(\d+)?\s*(?:years?|yrs?)\s*(?:of)?\s*(?:relevant|hands-on|work|industry|professional)?\s*exp',
            r'(?:experience|exp)[\s:]*(?:of)?\s*(\d+)\s*(?:\+|plus)?\s*(?:-|to)?\s*(\d+)?\s*(?:years?|yrs?)',
            r'(?:minimum|at\s*least|min)\s*(\d+)\s*(?:\+|plus)?\s*(?:-|to)?\s*(\d+)?\s*(?:years?|yrs?)',
            r'(\d+)\s*\+\s*(?:years?|yrs?)'
        ]
        years = []
        for pat in exp_patterns:
            for m in re.findall(pat, sanitized_text):
                v = int(m[0])
                if 1 <= v <= 25:
                    years.append(v)

        has_explicit_exp = len(years) > 0
        min_years = min(years) if has_explicit_exp else (4 if is_senior_title else 0)
        user_exp = (user_exp or "0-1 year").lower()

        # Handle 0-1 year (Freshers / Entry Level)
        if "0-1" in user_exp or "fresher" in user_exp:
            if is_senior_title or (has_explicit_exp and min_years >= 3):
                return (
                    0.0,
                    None,
                    f"Experience mismatch: Role requires {min_years}+ years or senior title ({job_title}), but your profile is {user_exp}."
                )
            elif is_entry_title or (has_explicit_exp and min_years <= 1):
                return (
                    100.0,
                    "Targeted entry-level / early-career role ideally suited for 0-1 year experience.",
                    None
                )
            elif not has_explicit_exp and not is_senior_title:
                # Experience level is NOT mentioned in the job posting -> Recommend it with open requirement!
                return (
                    90.0,
                    "Open experience requirement (no senior restrictions specified) – suitable for all candidates.",
                    None
                )
            else:
                return (
                    85.0,
                    "General engineering role compatible with early-career applicants.",
                    None
                )

        # Handle 2-4 years (Mid Level)
        elif "2-4" in user_exp:
            if "principal" in title or "director" in title or "architect" in title or (has_explicit_exp and min_years >= 7):
                return (
                    0.0,
                    None,
                    f"Experience mismatch: Role requires {min_years}+ years (Staff/Principal), but your profile is {user_exp}."
                )
            elif (has_explicit_exp and min_years in [2, 3, 4]) or ("senior" not in title and not is_entry_title):
                return (100.0, "Experience level aligns well with mid-level requirements (2-4 yrs).", None)
            elif not has_explicit_exp:
                return (90.0, "Open experience requirement (unspecified in posting) – compatible with mid-level profile.", None)
            else:
                return (80.0, "Acceptable experience range for mid-level profile.", None)

        # Handle 5-9 years (Senior / Lead)
        elif "5-9" in user_exp:
            if is_entry_title:
                return (40.0, None, "Entry-level / internship role is junior for your 5-9 years experience.")
            elif is_senior_title or (has_explicit_exp and min_years in [5, 6, 7, 8]):
                return (100.0, "Senior role strongly aligns with your 5-9 years experience.", None)
            elif not has_explicit_exp:
                return (85.0, "Open experience requirement – compatible for experienced profile.", None)
            else:
                return (85.0, "Compatible role for senior profile.", None)

        # Handle 10+ years
        elif "10" in user_exp or "20" in user_exp:
            if is_entry_title:
                return (20.0, None, "Role is entry-level for an experienced leader profile.")
            return (100.0, "Experience level aligns with senior / leadership tier.", None)

        return (85.0, "Open / unspecified experience requirement – evaluated as compatible.", None)

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

        # 3. Experience Level Alignment & Hard Filter
        user_exp = user_preferences.get("experience_level") or "0-1 year"
        exp_score, exp_match_reason, exp_skip_reason = JobMatcher._evaluate_experience(user_exp, job.get("title", ""), job.get("description", ""))
        if exp_score == 0.0 and exp_skip_reason:
            rejection_reasons.append(exp_skip_reason)
            return {
                "overall_score": 0.0,
                "confidence_score": 95.0,
                "skill_match_score": 0.0,
                "experience_match_score": 0.0,
                "missing_skills": [],
                "strengths": [],
                "match_reasons": [],
                "rejection_reasons": rejection_reasons,
                "status": "skipped",
                "skip_reason": exp_skip_reason
            }
        elif exp_match_reason:
            match_reasons.append(exp_match_reason)

        # 4. Domain-Aware Skill Match Calculation
        candidate_skills_list = candidate_profile.get("technical_skills", []) + candidate_profile.get("skills", [])
        candidate_skills = {s.lower() for s in candidate_skills_list}

        required_skills = [s.lower() for s in job.get("required_skills", [])]
        matched_skills = [s for s in required_skills if s in candidate_skills]
        missing_skills = [s for s in required_skills if s not in candidate_skills]

        is_ai_job = any(k in job_title or k in description for k in ["machine learning", "artificial intelligence", "ai engineer", "deep learning", "llm", "generative ai", "computer vision", "nlp"])
        candidate_has_ai = any(k in candidate_skills for k in ["machine learning", "deep learning", "python", "pytorch", "tensorflow", "nlp", "llm", "opencv", "scikit-learn", "langchain"])

        is_python_job = "python" in job_title or "python" in description or "python" in required_skills
        candidate_has_python = "python" in candidate_skills

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

        # 5. Strict Location Match & Filtering
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

        # 6. Smart Job Title Alignment
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

        # 7. Weighted Multi-Factor Overall Score
        overall_score = round(
            (skill_score * 0.35) + (exp_score * 0.25) + (location_score * 0.20) + (title_score * 0.20),
            1
        )

        status = "matched" if overall_score > 0 else "skipped"
        skip_reason = f"Match score is 0%" if status == "skipped" else None

        return {
            "overall_score": overall_score,
            "confidence_score": 85.0,
            "skill_match_score": round(skill_score, 1),
            "experience_match_score": round(exp_score, 1),
            "missing_skills": missing_skills[:5],
            "strengths": matched_skills[:5],
            "match_reasons": match_reasons,
            "rejection_reasons": rejection_reasons,
            "status": status,
            "skip_reason": skip_reason
        }
