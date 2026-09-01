import os
import json
import re
from typing import Dict, Any, List, Optional
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
    def _normalize_experience(user_exp: Optional[str]) -> str:
        """
        Normalize various experience inputs ('0-1 year', 'fresher', 'junior', 'mid', 'senior', etc.)
        into standard tiers: '0-1 year', '2-4 years', '5-9 years', '10+ years'.
        """
        s = (user_exp or "").lower().strip()
        if not s:
            return "0-1 year"
        # Check higher tiers first to avoid substring conflicts (e.g. '0-1' inside '10-19')
        if any(k in s for k in ["10+", "10-19", "20+", "staff", "principal", "architect", "director", "executive"]) or "10" in s or "20" in s:
            return "10+ years"
        if any(k in s for k in ["5-9", "senior", "lead", "5 year", "6 year", "7 year", "8 year", "9 year"]):
            return "5-9 years"
        if any(k in s for k in ["2-4", "junior", "mid", "intermediate", "2 year", "3 year", "4 year"]):
            return "2-4 years"
        if re.search(r'\b0[- ]?1\b', s) or any(k in s for k in ["fresher", "intern", "graduate", "entry", "entry-level", "0 year", "1 year"]):
            return "0-1 year"
        return "0-1 year"

    @staticmethod
    @staticmethod
    def _evaluate_experience(user_exp_raw: str, job_title: str, job_desc: str, exp_strict_mode: bool = False) -> tuple:
        """
        Evaluate candidate experience level vs job requirements.
        Returns: (score: float, match_reason: Optional[str], skip_reason: Optional[str])
        """
        user_exp = JobMatcher._normalize_experience(user_exp_raw)
        title = (job_title or "").lower()
        desc = (job_desc or "")[:2000].lower()
        full_text = f"{title} {desc}"

        clean_title = re.sub(r'[^a-z0-9\s]', ' ', title)

        # 1. Seniority keywords in title
        senior_kws = [
            "senior", "sr", "lead", "principal", "staff", "architect",
            "director", "manager", "head of", "vp", "vice president", "tech lead",
            "team lead", "engineering manager", "distinguished", "fellow", "chief",
            "sse", "sre", "em", "tl", "smts", "pmts", "iii", "iv", "v", "vi"
        ]
        is_senior_title = any(re.search(r"\b" + re.escape(kw) + r"\b", clean_title) for kw in senior_kws)

        # 2. Mid-level keywords in title
        mid_kws = ["mid", "intermediate", "experienced", "mid-level", "mid level"]
        is_mid_title = any(re.search(r"\b" + re.escape(kw) + r"\b", clean_title) for kw in mid_kws)

        # 3. Level and numeral patterns (e.g. SDE 2, SDET 2, SDE-2, SDE2, SDE 3, SWE 2, MTS 2, MTS-2, Engineer II, Developer 3, Level 2, L2, L3)
        level_pattern = (
            r'\b(?:sde|swe|sdet|engineer|developer|analyst|consultant|programmer|qa|mts)\s*[-:]?\s*(?:2|3|4|5|6|ii|iii|iv|v|vi)\b'
            r'|\b(?:sde|swe|sdet|lvl|level|l|mts)\s*[-:]?\s*[2-6]\b'
            r'|\b(?:ii|iii|iv|v)\b'
        )
        is_level_above_1 = bool(re.search(level_pattern, clean_title))

        # 4. Entry-level keywords in title
        entry_kws = [
            "junior", "jr", "associate", "entry level", "entry-level", "graduate",
            "trainee", "fresher", "intern", "internship", "sde 1", "sde i", "swe 1",
            "mts 1", "mts i", "l1", "level 1", "campus", "student", "apprentice"
        ]
        is_entry_title = any(re.search(r"\b" + re.escape(kw) + r"\b", clean_title) for kw in entry_kws)

        # 5. Detect numerical years of experience REQUIRED from applicant
        # Filter out company history/founding years like 'founded 10 years ago' or 'for over 15 years in business'
        sanitized_text = re.sub(
            r'\b(?:founded|established|in business|ago|history of|for over|over|past|last)\s*\d+\s*(?:years?|yrs?)',
            ' ',
            full_text,
            flags=re.I
        )

        # Target explicit experience mentions rather than unrelated durations (support hyphenated words like hands-on, full-time)
        exp_patterns = [
            # Range with experience/working/building context: e.g. "6-8 years working with", "3-5 years of software engineering experience"
            r'(\d+)\s*(?:-|to)\s*(\d+)\s*(?:years?|yrs?)\s+(?:of\s+)?(?:[\w\s\-]{0,25})?(?:experience|exp|background|industry|working|building|developing|in\b)',
            # Plus/single with experience context: e.g. "6+ years of experience in backend development", "2+ years of production experience"
            r'(\d+)\s*(?:\+|plus)?\s*(?:-|to)?\s*(\d+)?\s*(?:years?|yrs?)\s+(?:of\s+)?(?:[\w\s\-]{0,25})?(?:experience|exp|background|industry|production|working|hands-on|commercial)',
            # Prefix phrases: "minimum 3 years", "at least 4 yrs industry exp", "requires 2+ years"
            r'(?:minimum|at\s*least|min|requires?|requires\s+a\s+minimum\s+of)\s*(?:of\s+)?(\d+)\s*(?:\+|plus)?\s*(?:-|to)?\s*(\d+)?\s*(?:years?|yrs?)',
            # "experience: 5 to 7 years in Node.js"
            r'(?:experience|exp)[\s:]+(?:of\s+)?(\d+)\s*(?:\+|plus)?\s*(?:-|to)?\s*(\d+)?\s*(?:years?|yrs?)',
            # "8+ yrs relevant experience building scalable systems"
            r'(\d+)\s*(?:\+|plus)?\s*(?:years?|yrs?)\s+(?:of\s+)?(?:[\w\s\-]{0,25})?(?:relevant|practical|hands-on|industry|production|commercial)?\s*(?:experience|exp)'
        ]

        min_years_candidates = []
        for pat in exp_patterns:
            for m in re.finditer(pat, sanitized_text, re.I):
                g = m.groups()
                if g and g[0] and g[0].isdigit():
                    v = int(g[0])
                    # Note: 0 is explicitly allowed to support '0-2 years' or '0 years of exp'
                    if 0 <= v <= 25:
                        min_years_candidates.append(v)

        has_explicit_exp = len(min_years_candidates) > 0
        min_years = min(min_years_candidates) if has_explicit_exp else (4 if (is_senior_title or is_level_above_1) else 0)

        # Handle 0-1 year (Freshers / Entry Level)
        if user_exp == "0-1 year":
            # Explicit entry title welcomes early-career talent unless explicitly 3+ years
            if is_entry_title:
                if has_explicit_exp and min_years >= 3:
                    return (
                        0.0,
                        None,
                        f"Experience mismatch: Role requires {min_years}+ years ({job_title}), but your profile is {user_exp}."
                    )
                return (
                    100.0,
                    "Targeted entry-level / early-career role ideally suited for 0-1 year experience.",
                    None
                )

            # Senior, Mid-level, or Level > 1 titles strictly rejected for 0-1 year
            if is_senior_title or is_level_above_1 or is_mid_title:
                exp_detail = f"Role requires {min_years}+ years" if has_explicit_exp else "Role requires senior/mid-level qualifications"
                return (
                    0.0,
                    None,
                    f"Experience mismatch: {exp_detail} ({job_title}), but your profile is {user_exp}."
                )

            # Check explicit years requirement
            if has_explicit_exp:
                if min_years <= 1:
                    return (
                        100.0,
                        "Targeted entry-level / early-career role ideally suited for 0-1 year experience.",
                        None
                    )
                else:
                    return (
                        0.0,
                        None,
                        f"Experience mismatch: Role requires {min_years}+ years ({job_title}), but your profile is {user_exp}."
                    )

            # Open experience role (no explicit years and not senior)
            return (
                75.0,
                "Open experience requirement (unspecified in posting) – compatible with early-career profile.",
                None
            )

        # Handle 2-4 years (Mid Level)
        elif user_exp == "2-4 years":
            if "principal" in title or "director" in title or "architect" in title or "staff" in title or "vp" in title or (has_explicit_exp and min_years >= 5):
                exp_req = f"{min_years}+ years" if has_explicit_exp else "Staff/Principal leadership level"
                return (
                    0.0,
                    None,
                    f"Experience mismatch: Role requires {exp_req} ({job_title}), but your profile is {user_exp}."
                )
            elif is_entry_title and not has_explicit_exp:
                return (50.0, "Entry-level role is junior for your 2-4 years mid-level profile.", None)
            elif (has_explicit_exp and min_years in [0, 1, 2, 3, 4]) or is_level_above_1 or ("senior" not in title and not is_entry_title):
                return (100.0, "Experience level aligns well with mid-level requirements (2-4 yrs).", None)
            elif not has_explicit_exp and "senior" in title:
                return (75.0, "Senior role within reachable scope for experienced mid-level profile.", None)
            elif not has_explicit_exp:
                return (85.0, "Open experience requirement – compatible with mid-level profile.", None)
            else:
                return (75.0, "Acceptable experience range for mid-level profile.", None)

        # Handle 5-9 years (Senior / Lead)
        elif user_exp == "5-9 years":
            if is_entry_title:
                return (20.0, None, "Entry-level / internship role is junior for your 5-9 years experience.")
            elif has_explicit_exp and min_years >= 10:
                return (0.0, None, f"Experience mismatch: Role requires {min_years}+ years (Staff/Leadership), but your profile is {user_exp}.")
            elif is_senior_title or (has_explicit_exp and min_years in [3, 4, 5, 6, 7, 8, 9]):
                return (100.0, "Senior role strongly aligns with your 5-9 years experience.", None)
            elif not has_explicit_exp:
                return (85.0, "Open experience requirement – compatible for experienced profile.", None)
            else:
                return (80.0, "Compatible role for senior profile.", None)

        # Handle 10+ years (Staff / Principal / Executive)
        else:
            if is_entry_title:
                return (20.0, None, "Role is entry-level for an experienced leader profile.")
            return (100.0, "Experience level aligns with senior / leadership tier.", None)

    @staticmethod
    def evaluate_match_fast(candidate_profile: dict, user_preferences: dict, job: dict, skip_signals: Optional[dict] = None) -> dict:
        """Fast heuristic evaluation before optional LLM scoring, incorporating learned skip feedback signals."""
        rejection_reasons = []
        match_reasons = []

        job_title = job.get("title", "").lower()
        company = job.get("company", "").lower()
        location = job.get("location", "").lower()
        description = job.get("description", "").lower()

        # 0. Expired / Inactive Posting Check (e.g. reported by users as no longer accepting applications)
        if job.get("status") == "expired":
            rejection_reasons.append("Job posting is no longer accepting applications.")
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
                "skip_reason": "No longer accepting applications (posting closed/expired)."
            }

        # 0b. Learned Skip Signals (Adaptive Feedback Loop)
        if skip_signals:
            penalty_companies = [c.lower().strip() for c in skip_signals.get("penalty_companies", []) if c]
            penalty_titles = [t.lower().strip() for t in skip_signals.get("penalty_titles", []) if t]
            penalty_locations = [l.lower().strip() for l in skip_signals.get("penalty_locations", []) if l]

            clean_comp = re.sub(r'[^a-z0-9\s]', ' ', company).strip()
            for pc in penalty_companies:
                if pc and (pc in clean_comp or clean_comp in pc):
                    rejection_reasons.append(f"Company '{job.get('company')}' previously skipped multiple times based on your feedback.")
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
                        "skip_reason": f"Learned company exclusion: {job.get('company')}"
                    }

            pref_locs_norm = [re.sub(r'[^a-z0-9\s]', ' ', l.lower()).strip() for l in user_preferences.get("locations", []) if l]
            clean_loc = re.sub(r'[^a-z0-9\s]', ' ', location).strip()
            # Only test penalty locations if job location is NOT one of the candidate's chosen locations
            is_loc_preferred = any(ploc in clean_loc or clean_loc in ploc for ploc in pref_locs_norm if len(ploc) >= 3)
            if not is_loc_preferred:
                for pl in penalty_locations:
                    if pl and len(pl) >= 4 and (pl == clean_loc or pl in clean_loc):
                        rejection_reasons.append(f"Location '{job.get('location')}' matches locations you previously skipped.")
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
                            "skip_reason": f"Location mismatch (learned): '{job.get('location')}' was previously rejected by candidate."
                        }

            pref_titles_norm = [re.sub(r'[^a-z0-9\s]', ' ', t.lower()).strip() for t in user_preferences.get("job_titles", []) if t]
            clean_job_title = re.sub(r'[^a-z0-9\s]', ' ', job_title).strip()
            # Only test penalty titles if title is not one of candidate's target job titles
            is_title_target = any(ptarg == clean_job_title or (len(ptarg) >= 5 and ptarg in clean_job_title) for ptarg in pref_titles_norm)
            if not is_title_target:
                for pt in penalty_titles:
                    if pt and pt == clean_job_title:
                        rejection_reasons.append(f"Role title '{job.get('title')}' matches positions you previously skipped for experience or role mismatch.")
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
                            "skip_reason": f"Experience mismatch (learned): Role '{job.get('title')}' was previously rejected based on your feedback."
                        }

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

        # 3. Experience Level Alignment & Hard Filter (with feedback strict mode)
        user_exp = user_preferences.get("experience_level") or "0-1 year"
        exp_strict = bool(skip_signals.get("exp_strict_mode")) if skip_signals else False
        exp_score, exp_match_reason, exp_skip_reason = JobMatcher._evaluate_experience(
            user_exp, job.get("title", ""), job.get("description", ""), exp_strict_mode=exp_strict
        )
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

        loc_clean = (job.get("location") or "").lower().strip()
        pref_locations_clean = [l.lower().strip() for l in pref_locations if l and l.strip()]
        pref_modes_clean = [m.lower().strip() for m in pref_modes if m and m.strip()]

        if not loc_clean or loc_clean in ["not specified", "unspecified", "none", ""]:
            if pref_locations_clean or pref_modes_clean:
                rejection_reasons.append("Job location is not specified.")
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
                    "skip_reason": "Location mismatch: Job location is not specified."
                }

        is_user_remote_allowed = any("remote" in l or "worldwide" in l or "anywhere" in l for l in pref_locations_clean) or any("remote" in m for m in pref_modes_clean)
        job_is_remote = any(k in loc_clean for k in ["remote", "anywhere", "worldwide", "work from home", "wfh", "telecommute"])

        # City aliases dictionary (expandable, bidirectionally normalized)
        CITY_ALIASES = {
            "bengaluru": ["bengaluru", "bangalore", "whitefield", "electronic city", "koramangala", "bellandur", "indiranagar", "marathahalli"],
            "bangalore": ["bengaluru", "bangalore", "whitefield", "electronic city", "koramangala", "bellandur", "indiranagar", "marathahalli"],
            "delhi": ["delhi", "delhi-ncr", "new delhi", "noida", "gurgaon", "gurugram", "faridabad", "ghaziabad"],
            "delhi-ncr": ["delhi", "delhi-ncr", "new delhi", "noida", "gurgaon", "gurugram", "faridabad", "ghaziabad"],
            "gurgaon": ["gurgaon", "gurugram", "delhi", "delhi-ncr"],
            "gurugram": ["gurgaon", "gurugram", "delhi", "delhi-ncr"],
            "noida": ["noida", "greater noida", "delhi", "delhi-ncr"],
            "mumbai": ["mumbai", "bombay", "navi mumbai", "thane", "andheri", "powai", "bkc"],
            "pune": ["pune", "hinjewadi", "magarpatta", "kharadi", "baner", "wakad", "hadapsar"],
            "kolkata": ["kolkata", "calcutta", "salt lake", "new town"],
            "chennai": ["chennai", "madras", "omr", "taramani", "guindy"],
            "hyderabad": ["hyderabad", "secunderabad", "cyberabad", "hitec city", "gachibowli", "madhapur", "kondapur"],
            "ahmedabad": ["ahmedabad", "gandhinagar", "gift city"],
            "san francisco": ["san francisco", "sf", "bay area", "san francisco bay area"],
            "new york": ["new york", "nyc", "new york city"],
            "london": ["london", "greater london"],
            "washington dc": ["washington dc", "washington d.c.", "dc area"]
        }

        # Map candidate target locations to geographical regions
        user_regions = set()
        for pl in pref_locations_clean:
            if pl in ["remote", "fully remote", "worldwide", "anywhere"]:
                continue
            # Indian cities / country
            if any(ic in pl for ic in ["india", "bharat", "bengaluru", "bangalore", "hyderabad", "pune", "mumbai", "delhi", "noida", "gurgaon", "chennai", "kolkata", "ahmedabad", "chandigarh", "jaipur", "kochi", "indore", "karnataka", "telangana", "maharashtra"]):
                user_regions.add("india")
            # US cities / country
            if any(uc in pl for uc in ["united states", "usa", "us", "u.s.", "america", "san francisco", "new york", "seattle", "austin", "chicago", "boston", "los angeles", "san jose", "california", "texas", "washington"]):
                user_regions.add("us")
            # UK / Europe
            if any(ukc in pl for ukc in ["united kingdom", "uk", "england", "scotland", "london", "europe", "germany", "france", "berlin", "paris", "amsterdam", "ireland", "dublin"]):
                user_regions.add("uk_eu")
            # Canada
            if any(cc in pl for cc in ["canada", "toronto", "vancouver", "montreal", "ontario"]):
                user_regions.add("canada")
            # APAC / Middle East
            if any(ac in pl for ac in ["singapore", "dubai", "uae", "australia", "sydney", "tokyo", "japan"]):
                user_regions.add("apac_me")

        # Flag USD salary indicators if user has NOT selected US/global targets
        if "usd salary" in loc_clean:
            if "us" not in user_regions and not ("remote" in pref_locations_clean and len(pref_locations_clean) == 1):
                rejection_reasons.append("Compensation indicates foreign (US/Western) location not eligible for candidate.")
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
                    "skip_reason": "Location mismatch: Role indicates US/foreign compensation without regional eligibility."
                }

        # Check restricted remote jobs
        if job_is_remote:
            restricted_regions = {
                "us": ["us only", "usa only", "united states only", "north america", "u.s. only", "remote (us)", "remote (usa)", "(usa)", "remote, united states", "work from home - us", "- us", "us remote"],
                "uk_eu": ["uk only", "united kingdom only", "europe", "emea", "eu only", "remote (uk)", "remote - uk", "remote (europe)", "remote, europe", "work from home - uk", "remote - emea", "remote - london"],
                "canada": ["canada only", "remote (canada)"],
                "latam": ["latam", "latin america"],
                "india": ["india only", "remote (india)", "remote - india"]
            }
            is_restricted_away = False
            restriction_desc = ""
            for reg, rkws in restricted_regions.items():
                if any(rkw in loc_clean for rkw in rkws):
                    # If this region is NOT in the user's targeted regions, it is restricted for this candidate
                    if user_regions and reg not in user_regions:
                        is_restricted_away = True
                        restriction_desc = reg.upper()
                        break

            if is_restricted_away:
                rejection_reasons.append(f"Remote role is restricted to {restriction_desc} ({job.get('location')}), outside your target regions.")
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
                    "skip_reason": f"Location mismatch: Remote role is restricted to {restriction_desc} ({job.get('location')}), outside your selected locations."
                }
            elif is_user_remote_allowed:
                location_score = 100.0
                match_reasons.append("Remote job location aligns with your remote work preference.")
            else:
                rejection_reasons.append("Job is remote, but you selected on-site work mode preference.")
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
                    "skip_reason": "Location mismatch: Job is remote, but your preferences require on-site."
                }
        else:
            # On-site / Hybrid role: dynamic city and alias matching
            city_matched = False
            matched_target = None
            if pref_locations_clean:
                for target_loc in pref_locations_clean:
                    if target_loc in ["remote", "fully remote", "worldwide", "anywhere"]:
                        continue

                    # Direct substring match
                    if target_loc in loc_clean:
                        city_matched = True
                        matched_target = target_loc
                        break

                    # Aliases match
                    aliases = CITY_ALIASES.get(target_loc, [target_loc])
                    for alias in aliases:
                        if alias in loc_clean:
                            city_matched = True
                            matched_target = target_loc
                            break
                    if city_matched:
                        break

            if city_matched:
                location_score = 100.0
                match_reasons.append(f"Location matches your target city preference ({matched_target.title() if matched_target else ''}).")
            else:
                if pref_locations_clean or pref_modes_clean:
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
                        "skip_reason": f"Location mismatch: '{job.get('location')}' is not in selected cities ({', '.join(user_preferences.get('locations', []))}) or remote."
                    }
                else:
                    location_score = 50.0

        # 6. Smart Job Title Alignment
        pref_titles = [t.lower() for t in user_preferences.get("job_titles", [])]
        title_score = 60.0
        NON_TECH_KEYWORDS = [
            "sales", "copywriter", "writer", "writing", "marketing", "account executive",
            "inside sales", "customer support", "customer success", "client success", "telecaller", "recruiter", "bpo",
            "assistant", "receptionist", "data entry", "clerk", "transcriptionist", "tutor",
            "teacher", "driver", "nurse", "accountant", "bookkeeper", "seo specialist", "content creator",
            "business development", "operations associate", "retail", "store manager"
        ]

        is_tech_candidate = any("engineer" in pt or "developer" in pt or "ai" in pt or "data" in pt or "software" in pt for pt in pref_titles)

        if is_tech_candidate and any(re.search(r'\b' + re.escape(nk) + r'\b', job_title) for nk in NON_TECH_KEYWORDS):
            rejection_reasons.append(f"Non-technical role '{job.get('title')}' mismatch for engineering profile.")
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
                "skip_reason": f"Role mismatch: '{job.get('title')}' is a non-technical role incompatible with your target roles."
            }

        is_job_tech = any(tk in job_title for tk in ["sde", "swe", "sdet", "engineer", "developer", "programmer", "data", "ai", "ml", "cloud", "software", "architect", "tech", "scientist", "coder", "fullstack", "frontend", "backend", "devops", "sre", "qa", "intern", "trainee"])
        if is_tech_candidate and not is_job_tech:
            rejection_reasons.append(f"Role title '{job.get('title')}' does not match your target job roles.")
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
                "skip_reason": f"Role title mismatch: '{job.get('title')}' does not align with your target roles."
            }

        if pref_titles:
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
                title_score = 40.0

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
