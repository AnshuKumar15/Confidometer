import os
import json
import re
import google.generativeai as genai
from app.config import settings
from app.utils.circuit_breaker import gemini_circuit_breaker

def get_gemini_api_key():
    return settings.GEMINI_API_KEY or os.environ.get("GEMINI_API_KEY") or os.environ.get("GEMINI_API")

COMMON_QUESTION_RULES = {
    r"years.*experience": lambda p, pref: str(len(p.get("work_experience", [])) * 2 or "3"),
    r"notice.*period": lambda p, pref: "Immediate" if pref.get("immediate_joining") else "2 weeks",
    r"visa.*sponsorship": lambda p, pref: "Yes" if pref.get("visa_sponsorship") else "No",
    r"authorized.*work": lambda p, pref: "Yes",
    r"relocat": lambda p, pref: "Yes" if pref.get("open_to_relocation") else "No",
    r"expected.*salary": lambda p, pref: str(int(pref.get("preferred_salary") or 100000)),
    r"current.*salary": lambda p, pref: str(int(pref.get("min_salary") or 80000)),
}

def generate_form_answers(
    candidate_profile: dict,
    user_preferences: dict,
    questions: list[str],
    saved_answers: dict = None
) -> dict:
    """
    Intelligently generate answers for job application questions.
    Returns:
    {
       "answers": { "Question Text": "Answer Text" },
       "unanswered": [ "Question that needs user intervention" ]
    }
    """
    saved_answers = saved_answers or {}
    answers = {}
    unanswered = []
    gemini_key = get_gemini_api_key()

    for q in questions:
        q_lower = q.lower().strip()
        matched_saved = False

        # 1. Check saved answers
        for pattern, ans in saved_answers.items():
            if pattern.lower() in q_lower:
                answers[q] = ans
                matched_saved = True
                break

        if matched_saved:
            continue

        # 2. Check common heuristic rules
        heuristic_matched = False
        for pattern, rule_fn in COMMON_QUESTION_RULES.items():
            if re.search(pattern, q_lower):
                answers[q] = rule_fn(candidate_profile, user_preferences)
                heuristic_matched = True
                break

        if heuristic_matched:
            continue

        # 3. Use Gemini AI for remaining questions
        if gemini_key:
            try:
                genai.configure(api_key=gemini_key)
                model = genai.GenerativeModel("gemini-1.5-flash")
                prompt = f"""Given candidate profile:
Name: {candidate_profile.get('name')}
Skills: {candidate_profile.get('technical_skills')}
Education: {candidate_profile.get('education')}
Experience: {candidate_profile.get('work_experience')}

Preferences:
Visa Sponsorship: {user_preferences.get('visa_sponsorship')}
Relocation: {user_preferences.get('open_to_relocation')}
Desired Salary: {user_preferences.get('preferred_salary')}

Question: "{q}"

Answer the question succinctly and accurately on behalf of the candidate. If the answer cannot be determined with confidence, reply with "UNANSWERABLE".
Answer:"""
                resp = gemini_circuit_breaker.call_sync(model.generate_content, prompt, timeout=12.0)
                ai_ans = resp.text.strip()
                if "UNANSWERABLE" in ai_ans.upper():
                    unanswered.append(q)
                else:
                    answers[q] = ai_ans
            except Exception as e:
                print(f"[WARN] AI form filler failed for '{q}': {e}")
                unanswered.append(q)
        else:
            unanswered.append(q)

    return {
        "answers": answers,
        "unanswered": unanswered
    }
