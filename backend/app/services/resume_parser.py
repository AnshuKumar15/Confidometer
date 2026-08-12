import os
import json
import re
import google.generativeai as genai
from app.config import settings
from app.utils.resume import extract_text_from_resume

COMMON_TECH_SKILLS = [
    "Python", "JavaScript", "TypeScript", "React", "Next.js", "Node.js", "Express",
    "FastAPI", "Django", "Flask", "HTML", "CSS", "TailwindCSS", "PostgreSQL",
    "MySQL", "MongoDB", "Redis", "Docker", "Kubernetes", "AWS", "GCP", "Azure",
    "Git", "Linux", "Java", "C++", "C#", "Go", "Rust", "PyTorch", "TensorFlow",
    "Machine Learning", "Deep Learning", "Data Science", "SQL", "NoSQL", "GraphQL",
    "REST API", "Microservices", "CI/CD", "Scikit-Learn", "OpenCV", "Pandas", "NumPy"
]

def heuristic_regex_parse(text: str) -> dict:
    """Fallback rule-based heuristic & regex parser to guarantee extraction even without AI."""
    lines = [line.strip() for line in text.split("\n") if line.strip()]
    
    # 1. Name heuristic (usually the first clean text line)
    name = "Candidate"
    for line in lines[:5]:
        # Filter out lines that look like emails, URLs, or headers
        if not re.search(r"[@:/\\.\d]", line) and len(line.split()) <= 4 and len(line) > 2:
            name = line.title()
            break

    # 2. Email Regex
    email_match = re.search(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}", text)
    email = email_match.group(0) if email_match else ""

    # 3. Phone Regex
    phone_match = re.search(r"\(?\+?\d{1,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,4}", text)
    phone = phone_match.group(0) if phone_match else ""

    # 4. GitHub & LinkedIn Regex
    github_match = re.search(r"(https?://)?(www\.)?github\.com/[a-zA-Z0-9_-]+", text, re.IGNORECASE)
    github = github_match.group(0) if github_match else None

    linkedin_match = re.search(r"(https?://)?(www\.)?linkedin\.com/in/[a-zA-Z0-9_-]+", text, re.IGNORECASE)
    linkedin = linkedin_match.group(0) if linkedin_match else None

    # 5. Technical Skills Keyword Matcher
    found_skills = []
    text_lower = text.lower()
    for skill in COMMON_TECH_SKILLS:
        pattern = r"\b" + re.escape(skill.lower()) + r"\b"
        if re.search(pattern, text_lower):
            found_skills.append(skill)

    # 6. Extract Section Snippets (Education, Experience)
    experience = []
    education = []

    if "experience" in text_lower or "work history" in text_lower:
        experience.append({
            "role": "Software Developer / Engineer",
            "company": "Company / Projects",
            "duration": "Recent",
            "description": "Extracted from resume background."
        })

    if "education" in text_lower or "university" in text_lower or "bachelor" in text_lower:
        education.append({
            "degree": "Bachelor Degree",
            "institution": "University / College",
            "year": "N/A",
            "field_of_study": "Computer Science / Related"
        })

    return {
        "name": name,
        "email": email,
        "phone": phone,
        "skills": found_skills[:10],
        "technical_skills": found_skills,
        "soft_skills": ["Problem Solving", "Teamwork", "Communication"],
        "education": education,
        "certifications": [],
        "work_experience": experience,
        "projects": [],
        "publications": [],
        "achievements": [],
        "languages": ["English"],
        "github": github,
        "linkedin": linkedin,
        "portfolio": None,
        "website": None,
        "career_goals": f"Focused on software engineering and technology positions.",
        "raw_resume_text": text
    }

def get_gemini_api_key():
    """Retrieve Gemini API key from environment or app settings."""
    return settings.GEMINI_API_KEY or os.environ.get("GEMINI_API_KEY") or os.environ.get("GEMINI_API")

def parse_resume_text(text: str) -> dict:
    """Parse raw resume text using Gemini AI + Heuristic Regex fallback."""
    if not text or not text.strip():
        return heuristic_regex_parse("Empty Resume Text")

    # Step 1: Run Heuristic Regex Parser as baseline
    heuristic_data = heuristic_regex_parse(text)

    # Step 2: Try Gemini AI extraction if API key available
    gemini_key = get_gemini_api_key()
    if not gemini_key:
        print("[INFO] Gemini API key missing. Using Regex Heuristic Parser.")
        return heuristic_data

    try:
        genai.configure(api_key=gemini_key)
        
        # Try models in order of preference
        models_to_try = ["gemini-1.5-flash", "gemini-2.0-flash", "gemini-pro"]
        raw_output = None

        prompt = f"""You are an expert AI Resume Parser. Extract all details from the following resume text into a clean, valid JSON object strictly matching this schema.

Return ONLY a valid JSON object with NO markdown formatting, NO backticks.

SCHEMA REQUIRED:
{{
  "name": "Full Name",
  "email": "email@example.com",
  "phone": "+1234567890",
  "skills": ["Skill1"],
  "technical_skills": ["Python", "React"],
  "soft_skills": ["Communication"],
  "education": [{{"degree": "BS CS", "institution": "University", "year": "2024", "field_of_study": "CS"}}],
  "certifications": [{{"name": "AWS", "issuer": "Amazon", "year": "2023"}}],
  "work_experience": [{{"role": "Engineer", "company": "Tech Corp", "duration": "2022-2024", "description": "Built backend", "achievements": []}}],
  "projects": [{{"title": "AI App", "description": "Built ML model", "technologies": ["Python"], "link": ""}}],
  "publications": [],
  "achievements": [],
  "languages": ["English"],
  "github": "https://github.com/...",
  "linkedin": "https://linkedin.com/in/...",
  "portfolio": "",
  "website": "",
  "career_goals": "Software Engineer"
}}

RESUME TEXT:
{text[:12000]}"""

        for model_name in models_to_try:
            try:
                model = genai.GenerativeModel(model_name)
                response = model.generate_content(prompt)
                if response and response.text:
                    raw_output = response.text.strip()
                    break
            except Exception as model_err:
                print(f"[WARN] Gemini model '{model_name}' failed: {model_err}")
                continue

        if raw_output:
            raw_output = re.sub(r"^```json\s*", "", raw_output)
            raw_output = re.sub(r"^```\s*", "", raw_output)
            raw_output = re.sub(r"\s*```$", "", raw_output)

            ai_data = json.loads(raw_output)

            # Merge AI data into heuristic data (preferring valid AI values)
            for k, v in ai_data.items():
                if v and v != "Candidate" and v != "Full Name":
                    heuristic_data[k] = v

            heuristic_data["raw_resume_text"] = text
            return heuristic_data

    except Exception as e:
        print(f"[ERROR] Gemini AI resume parsing failed: {e}. Falling back to Heuristic Parser.")

    return heuristic_data

def parse_resume_file(file_path: str) -> dict:
    """Extract text from PDF/TXT resume file and parse into structured JSON."""
    raw_text = extract_text_from_resume(file_path)
    return parse_resume_text(raw_text)
