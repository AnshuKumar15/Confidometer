import os
import json
import google.generativeai as genai
from app.config import settings
from app.utils.circuit_breaker import gemini_circuit_breaker

def get_gemini_api_key():
    return settings.GEMINI_API_KEY or os.environ.get("GEMINI_API_KEY") or os.environ.get("GEMINI_API")

SYSTEM_PROMPT = """
You are an expert career consultant and professional copywriter. Write a highly tailored, compelling, and natural-sounding cover letter for a job applicant.

Guidelines:
- Reference the specific company name and role.
- Highlight 2-3 specific projects, technical skills, or achievements from the candidate's profile that directly align with the job description.
- Keep the tone professional yet enthusiastic, confident, and natural (avoid stiff corporate jargon or overly generic templates).
- Length: 250-350 words.
- Formatted with standard business greeting, 3 main paragraphs, and closing.
"""

def generate_cover_letter(
    candidate_profile: dict,
    job_title: str,
    company_name: str,
    job_description: str = "",
    style: str = "professional"
) -> str:
    """Generate a custom, tailored cover letter using Gemini AI."""
    gemini_key = get_gemini_api_key()

    if not gemini_key:
        return f"""Dear Hiring Manager at {company_name},

I am writing to express my strong enthusiasm for the {job_title} position. With my background in technology and software development, I am confident in my ability to make an immediate impact on your team.

My skills in {', '.join(candidate_profile.get('technical_skills', ['Software Development'])[:4])} directly align with your requirements. I have successfully delivered software projects that improved performance and user experience.

I look forward to discussing how my experience and passion align with {company_name}'s goals.

Sincerely,
{candidate_profile.get('name', 'Applicant')}"""

    try:
        genai.configure(api_key=gemini_key)
        model = genai.GenerativeModel("gemini-1.5-flash")

        profile_summary = {
            "name": candidate_profile.get("name"),
            "skills": candidate_profile.get("technical_skills", []),
            "experience": candidate_profile.get("work_experience", [])[:2],
            "projects": candidate_profile.get("projects", [])[:2],
            "career_goals": candidate_profile.get("career_goals")
        }

        prompt = f"""{SYSTEM_PROMPT}

Style requested: {style}

CANDIDATE PROFILE:
{json.dumps(profile_summary, indent=2)}

TARGET JOB:
Role: {job_title}
Company: {company_name}
Description Snippet: {job_description[:1500] if job_description else 'N/A'}

Write the tailored cover letter now:
"""

        response = gemini_circuit_breaker.call_sync(model.generate_content, prompt, timeout=15.0)
        return response.text.strip()
    except Exception as e:
        print(f"[ERROR] Cover letter generation failed: {e}")
        return f"Dear Hiring Manager at {company_name},\n\nI am applying for the {job_title} position..."
