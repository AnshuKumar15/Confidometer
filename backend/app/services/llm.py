import os
import json
import re
import random
import google.generativeai as genai
from dotenv import load_dotenv
from app.utils.circuit_breaker import gemini_circuit_breaker

# Load environment variables from .env file
load_dotenv()

# Try to configure Gemini API
gemini_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GEMINI_API")
if gemini_key:
    genai.configure(api_key=gemini_key)

# A comprehensive list of mock interview questions to use as a fallback if no API key is provided
MOCK_QUESTIONS = {
    "software engineer": [
        "Looking at the programming languages and frameworks listed on your resume, which core runtime trade-offs did you consider when choosing your main stack?",
        "How deeply have you worked with backend concurrency and asynchronous processing, and what bottlenecks did you have to solve?",
        "Could you explain the difference between a SQL and NoSQL database, and when you would choose one over the other in your architecture?",
        "In one of the projects or internships on your resume, what was the most difficult bug or technical bottleneck you personally diagnosed and resolved?",
        "How do you approach database indexing and query optimization to ensure low latency under heavy read/write load?",
        "Could you walk me through your experience with RESTful API design, error handling, idempotency, and data validation standards?",
        "If you noticed a sudden memory leak or CPU spike in a production service, what step-by-step diagnostic workflow would you follow?",
        "Looking at your education and coursework, which CS fundamental has had the biggest practical impact on how you write production code?",
        "How do you structure automated tests and CI/CD checks to prevent regressions before deploying changes?",
        "Can you describe a scenario where you had to pick up an unfamiliar tool or codebase quickly to deliver a critical feature?",
        "How do you approach designing a system for scalability and fault tolerance when traffic spikes by 10x?",
        "Walk me through how caching strategies (like TTLs and invalidation policies) fit into systems you've built."
    ],
    "ai_ml": [
        "When building an LLM application on proprietary data, how do you systematically decide between RAG, prompt engineering, and fine-tuning?",
        "How do you evaluate a generative AI or ML pipeline offline before deployment, especially for subtle regressions or hallucinations?",
        "Walk me through how chunking strategy, embedding selection, and hybrid reranking affect retrieval quality in a RAG pipeline.",
        "In a project on your resume, what was the trickiest data leakage, class imbalance, or distribution shift issue you ran into, and how did you catch it?",
        "Can you explain how self-attention scales with sequence length and what techniques (like KV caching or FlashAttention) mitigate inference bottlenecks?",
        "How do you enforce structured outputs and safety guardrails when integrating LLM agents with external tools or databases?",
        "Suppose an LLM-backed service's p95 latency suddenly doubles in production — how would you profile and bring latency down without tanking accuracy?",
        "What trade-offs separate parameter-efficient fine-tuning methods like LoRA/QLoRA from full fine-tuning for domain adaptation?",
        "How do you design human-in-the-loop feedback or online monitoring to catch model drift after shipping a model to production?",
        "If two models have similar offline F1 or BLEU scores, what criteria would you use to decide which one actually wins in production?",
        "How do you mitigate prompt injection and sensitive PII leakage when users interact freely with an AI workflow?",
        "Tell me about a time you simplified an over-engineered ML or AI pipeline and got comparable or better reliability."
    ],
    "default": [
        "Looking at the technical skills and tools highlighted on your resume, which ones are you most confident applying in production and why?",
        "Can you walk me through a major project from your resume, focusing on a tricky engineering or design decision you owned?",
        "What motivated you to apply for this specific role, and which experiences best prepare you for its day-to-day challenges?",
        "Could you describe a challenging achievement, hackathon project, or milestone from your resume and what trade-offs it involved?",
        "How do you handle conflicting technical opinions or ambiguity when collaborating across team members?",
        "Describe a time when you had to deliver under a tight deadline. How did you scope and prioritize tasks cleanly?",
        "How do you approach debugging an unfamiliar issue when logs are sparse or symptoms are intermittent?",
        "How do you evaluate reliability, edge cases, and failure modes before calling a feature complete?",
        "Can you share an example of a technical mistake or setback you ran into, and what concrete practice you changed afterward?",
        "Which emerging skill or engineering domain are you actively deepening right now, and how have you practiced it?"
    ]
}

def is_user_asking_question(text: str) -> bool:
    """Helper to detect if user input is a question or clarification request."""
    text_clean = text.strip().lower().rstrip("?").strip()
    if not text_clean:
        return False
    
    # Exclude polite social reciprocation questions
    pleasantries = ["how are you", "how about you", "and you", "what about you", "how're you", "how do you do"]
    for pleasantry in pleasantries:
        if pleasantry in text_clean:
            return False

    # Check if original text ends with a question mark
    if text.strip().endswith("?"):
        return True
    
    question_starters = [
        "what", "why", "how", "who", "where", "when", "which",
        "can you", "could you", "would you", "tell me about",
        "what is", "what are", "is it", "are you", "do you", "does it",
        "can i", "may i", "should i", "explain", "clarify", "repeat",
        "pardon", "what's"
    ]
    for starter in question_starters:
        if text_clean.startswith(starter):
            return True
    return False


# ──────────────────────────────────────────────────────────────
# INTERVIEW-TYPE SPECIFIC SYSTEM PROMPTS & GUIDANCE
# ──────────────────────────────────────────────────────────────

def _get_experience_level_guidance(experience_level: str) -> str:
    """Generate question calibration guidance tailored to the candidate's experience level."""
    exp_clean = (experience_level or "").lower().strip()
    if not exp_clean or "fresher" in exp_clean or "0" in exp_clean:
        return (
            "EXPERIENCE-LEVEL CALIBRATION (ENTRY LEVEL / FRESHER):\n"
            "- Target difficulty: Core fundamentals, foundational concepts, and academic understanding.\n"
            "- Focus on: Programming language basics (memory, data types, scope, closures, OOP principles), fundamental data structures & algorithms (arrays, hash maps, recursion, basic sorting), fundamental CS concepts (DBMS ACID properties, basic SQL queries, HTTP methods, OS processes vs threads), and coursework/personal projects.\n"
            "- Question style: 'Can you explain how X works under the hood?', 'What is the difference between X and Y?', 'In your project, why did you choose X over Y?', 'How does [concept] work in [language]?'\n"
            "- Do NOT ask high-scale distributed systems architecture, microservices mesh, or enterprise cloud scaling questions."
        )
    elif any(y in exp_clean for y in ["1 year", "2 year", "1-2", "junior"]):
        return (
            "EXPERIENCE-LEVEL CALIBRATION (JUNIOR - 1-2 YEARS):\n"
            "- Target difficulty: Practical implementation, API integration, debugging, and clean coding.\n"
            "- Focus on: Framework-specific knowledge (e.g. React lifecycle/hooks, FastAPI dependency injection, Django ORM), database queries and indexing basics, RESTful API design, basic error handling, unit testing, and how they contributed to team features.\n"
            "- Question style: 'How did you handle error states and validations in X?', 'Walk me through how you implemented feature Y in your recent role.', 'How do you optimize an API that takes too long to respond?'"
        )
    elif any(y in exp_clean for y in ["3 year", "4 year", "5 year", "mid", "senior"]):
        return (
            "EXPERIENCE-LEVEL CALIBRATION (MID TO SENIOR - 3-5 YEARS):\n"
            "- Target difficulty: Architecture decisions, trade-offs, scalability bottlenecks, caching, and resiliency.\n"
            "- Focus on: Database optimization (indexing, query execution plans, connection pooling), caching strategies (Redis, cache invalidation), asynchronous processing (message queues, background workers), microservices vs monolith trade-offs, concurrency handling, and system reliability.\n"
            "- Question style: 'What architectural trade-offs did you make when building X?', 'How would you scale this service to handle a 10x traffic spike?', 'Tell me about a production incident or severe bottleneck you debugged and resolved.'"
        )
    else:  # 6+ years, 7 years, 8+ years, Lead, Staff
        return (
            "EXPERIENCE-LEVEL CALIBRATION (LEAD / STAFF / PRINCIPAL - 6+ YEARS):\n"
            "- Target difficulty: High-level distributed system design, multi-region architecture, resilience engineering, technical leadership, and strategic trade-offs.\n"
            "- Focus on: Distributed systems (CAP theorem, consensus, event-driven architectures, Kafka/RabbitMQ), data partitioning & sharding, observability & SLOs, handling failure modes at scale, technical leadership, mentoring, and cross-team architectural alignment.\n"
            "- Question style: 'How would you architect a fault-tolerant, globally distributed system for X?', 'Walk me through a high-stakes technical decision where there was no obvious right answer.', 'How do you balance technical debt versus speed of delivery in a mission-critical platform?'"
        )


RESUME_DIVERSITY_INSTRUCTIONS = (
    "RESUME COVERAGE & QUESTION DIVERSITY (MANDATORY):\n"
    "Real interviewers evaluate the candidate across ALL areas of their resume, not just projects or internships.\n"
    "You MUST actively rotate your questions across different sections of the candidate's resume:\n"
    "1. Languages & Core Technologies: Ask specific in-depth technical questions about the programming languages, databases, or frameworks explicitly listed under their Skills section (e.g. Python generators/GIL, React reconciliation/virtual DOM, SQL indexes/joins, TypeScript generics, Go channels, Docker containers).\n"
    "2. Projects: Ask about technical architecture, tricky bugs solved, state management, or design patterns used in ONE or TWO specific projects.\n"
    "3. Work Experience / Internships: Ask about real-world team workflow, CI/CD, production deployments, handling requirements, or measurable impact.\n"
    "4. Achievements, Certifications & Education: If the candidate lists achievements, hackathons, awards, AWS/cloud certifications, or academic research, ask how they achieved it or what deep knowledge they acquired.\n"
    "5. Problem Solving & Scenarios: Present a realistic situational or troubleshooting question relevant to the skills and tools they claim to know.\n"
    "- CRITICAL: Do NOT spend more than 2 consecutive questions on projects/internships. Vary your topics across languages, concepts, skills, and background!"
)


def _get_pacing_guidance(duration_minutes: int, elapsed_minutes: int, questions_asked: int) -> str:
    """Provide real-time pacing instructions to ensure interviews span the intended duration."""
    time_remaining = max(0, duration_minutes - elapsed_minutes)
    return (
        f"PACING & TIME MANAGEMENT (CURRENT SESSION DURATION: {duration_minutes} MINUTES):\n"
        f"- Total allocated duration: {duration_minutes} minutes.\n"
        f"- Elapsed time so far: ~{elapsed_minutes} minutes.\n"
        f"- Questions asked so far: {questions_asked}.\n"
        f"- Approximate time remaining: ~{time_remaining} minutes.\n"
        f"- CRITICAL PACING RULE: Do NOT rush or wrap up the interview prematurely! For a {duration_minutes}-minute interview, you must conduct a full, thorough conversation with substantive follow-ups and diverse questions across the candidate's resume until the full duration is reached.\n"
        f"- NEVER say 'This concludes our interview' or 'That wraps up our session' on your own. Keep asking engaging, challenging, and relevant questions until you receive the explicit time limit wrap-up instruction."
    )


# ── Stress Mode prompt appendix (shared across Technical, HR, Behavioural) ──
STRESS_MODE_APPENDIX = (
    "\n\nSTRESS SIMULATION MODE (ACTIVE):\n"
    "You are conducting this interview in STRESS MODE. Follow these additional rules:\n"
    "1. On approximately 20% of your turns (roughly 1 in every 5 responses), you must INTERRUPT the candidate mid-explanation. "
    "Do NOT wait for them to finish — cut into their response with a sharp, challenging follow-up question that directly challenges "
    "an assumption they just made or pushes them to defend their reasoning more rigorously.\n"
    "2. Example interruption phrases: 'Hold on — can you justify that claim?', 'Wait, but what if [counter-scenario]?', "
    "'That doesn't sound right — are you sure about that?', 'Let me push back on that — how would you handle [harder variant]?'\n"
    "3. On the other 80% of turns, conduct the interview normally but maintain a slightly more demanding and probing tone.\n"
    "4. Never be rude or hostile — remain professional but noticeably more challenging and direct than a normal interview.\n"
    "5. The goal is to test the candidate's composure, adaptability, and ability to think clearly under pressure.\n"
)


AI_ML_ROLE_KEYWORDS = (
    "ai", "ml", "machine learning", "deep learning", "nlp", "llm",
    "genai", "generative ai", "data scientist", "computer vision", "neural", "mlops"
)

_AI_ML_FOCUS_LENSES = [
    "LLM Grounding, RAG Retrieval & Chunking/Reranking Trade-offs",
    "Offline & Online Evaluation Metrics, Hallucinations & Benchmarks",
    "Deep Learning & Transformer Architecture Fundamentals (Attention, Embeddings, Tokenization)",
    "Inference Latency, Throughput, Batching, KV Caching & Cost Optimization",
    "Data Pipelines, Label Quality, Feature Leakage & Training/Fine-Tuning (LoRA/PEFT)",
    "AI Safety, Guardrails, Prompt Injection & Tool-Use Reliability",
    "Debugging Degraded Models, Drift Monitoring & Failure Analysis Scenarios",
]

_SWE_FOCUS_LENSES = [
    "Language Internals, Memory Model & Runtime Concurrency",
    "Database Modeling, Indexing, Execution Plans & Query Bottlenecks",
    "API Design, Validation, Idempotency & Asynchronous Processing",
    "Production Debugging, Observability, Latency & Memory Leak Diagnostics",
    "Testing Strategy, Edge Cases, CI/CD & Safe Deployments",
    "System Architecture Trade-offs, Caching & Fault Tolerance",
    "Specific Under-Discussed Resume Tools, Libraries & Secondary Projects",
]

_OPENING_QUESTION_ANGLES = [
    "Begin substantive technical questioning with a fresh core conceptual or internals question tied to a DIFFERENT skill/library on their resume than their headline project.",
    "Begin substantive technical questioning with a realistic debugging, failure-mode, or production bottleneck scenario tailored to this role and their tech stack.",
    "Begin substantive technical questioning with an architectural or design trade-off comparison between two tools or approaches listed on their resume.",
    "Begin substantive technical questioning by drilling into a lesser-highlighted project, certification, achievement, or pipeline step from the middle/lower half of their resume.",
]


def _is_ai_ml_role(role: str = "") -> bool:
    role_lower = (role or "").lower()
    padded = f" {re.sub(r'[^a-z0-9]+', ' ', role_lower)} "
    return any(f" {kw} " in padded or kw in ("machine learning", "deep learning", "generative ai", "data scientist", "computer vision", "mlops") and kw in role_lower for kw in AI_ML_ROLE_KEYWORDS)


def build_session_diversity_config(
    role: str = "",
    interview_type: str = "technical",
    previous_questions: list = None,
) -> dict:
    """Create a per-session randomized lens permutation, opening hook, and recent-question blocklist."""
    seed = random.randint(100000, 999999)
    rng = random.Random(seed)
    pool = list(_AI_ML_FOCUS_LENSES if _is_ai_ml_role(role) else _SWE_FOCUS_LENSES)
    rng.shuffle(pool)
    cleaned_prev = []
    seen = set()
    for q in (previous_questions or []):
        q_clean = re.sub(r"\s+", " ", (q or "")).strip()
        if len(q_clean) >= 20 and q_clean.lower() not in seen:
            seen.add(q_clean.lower())
            cleaned_prev.append(q_clean[:180])
        if len(cleaned_prev) >= 12:
            break
    return {
        "seed": seed,
        "focus_lenses": pool,
        "opening_angle": rng.choice(_OPENING_QUESTION_ANGLES),
        "greeting_variant": rng.randint(0, 3),
        "recent_questions": cleaned_prev,
        "interview_type": interview_type,
    }


def _format_diversity_prompt_block(diversity_config: dict) -> str:
    if not diversity_config:
        return ""
    lenses = diversity_config.get("focus_lenses") or []
    opening_angle = diversity_config.get("opening_angle") or ""
    recent = diversity_config.get("recent_questions") or []
    seed = diversity_config.get("seed", "")
    lines = [
        f"SESSION RANDOMIZATION & ANTI-REPETITION SEED (#{seed}):",
        "- The candidate practices regularly with the same resume. Keep every session unpredictable and engaging!",
    ]
    if lenses:
        lines.append("- Rotated Topic Order for THIS Session (explore different lenses in this shuffled priority rather than asking the same standard first-line resume questions):")
        for idx, lens in enumerate(lenses, 1):
            lines.append(f"  {idx}. {lens}")
    if opening_angle:
        lines.append(f"- Opening Technical Pivot: {opening_angle}")
    if recent:
        lines.append("- PREVIOUSLY ASKED QUESTIONS FROM RECENT SESSIONS (STRICTLY DO NOT REPEAT, PARAPHRASE, OR OPEN WITH THE SAME TOPIC/FRAMING AS ANY OF THESE):")
        for q in recent:
            lines.append(f"  * \"{q}\"")
    return "\n".join(lines)


def _build_system_prompt_technical(
    user_name, role, company_name, experience_level, resume_text, job_description,
    duration_minutes=10, elapsed_minutes=0, questions_asked=0, stress_mode=False,
    diversity_config=None,
):
    company_context = f"The target company is '{company_name}'.\n" if company_name else ""
    experience_context = f"The candidate has {experience_level} of experience.\n" if experience_level else ""
    jd_context = f"\nJob Description provided by the candidate:\n{job_description}\n" if job_description else ""
    exp_guidance = _get_experience_level_guidance(experience_level)
    pacing_guidance = _get_pacing_guidance(duration_minutes, elapsed_minutes, questions_asked)
    diversity_block = _format_diversity_prompt_block(diversity_config)

    prompt = (
        f"You are a professional, polite, and concise technical interviewer named 'Liza' interviewing a candidate named '{user_name}' for the position of '{role}'.\n"
        f"{company_context}"
        f"{experience_context}"
        f"Here is the candidate's resume:\n{resume_text}\n"
        f"{jd_context}\n"
        f"{exp_guidance}\n\n"
        f"{RESUME_DIVERSITY_INSTRUCTIONS}\n\n"
        f"{diversity_block + chr(10) + chr(10) if diversity_block else ''}"
        f"{pacing_guidance}\n\n"
        "INSTRUCTIONS & FLOW:\n"
        "1. You must guide the candidate through the interview starting from the greeting. Do not skip any steps.\n"
        "2. In your very first turn, introduce yourself as Liza, the interview agent, and ask how the candidate is and how they are feeling today.\n"
        "3. Once the candidate responds, acknowledge/respond to their feelings politely and ask them if they are ready/if we can start the interview.\n"
        "4. Once they agree to start, ask them to introduce themselves or tell you about themselves.\n"
        "5. After they introduce themselves, jump into diverse technical questions sampled from DIFFERENT areas of their resume, the target role, experience level, and job description — do NOT default to reading the top project bullet first every session.\n"
        "6. Ask exactly ONE question at a time.\n"
        "7. Keep your questions relevant, clear, and concise (no more than 2-3 sentences).\n"
        "8. Reference their resume skills, languages, achievements, and experiences naturally when asking questions.\n"
        f"{'9. Tailor question difficulty and style to the company (' + company_name + ') interview standards. Ask questions similar to what ' + company_name + ' would ask in a real interview.' + chr(10) if company_name else ''}"
        "10. If the candidate asks a clarifying question or cross-question (e.g. asking about the role, repeating the question, or asking for clarification), politely answer or clarify their question, and then repeat/re-ask the current interview question. Do not skip to the next interview question until they have actually answered the current one.\n"
        "11. CRITICAL — NO TEACHING: If the candidate says 'I don't know', 'I'm not sure', or gives a clearly wrong/incomplete answer, do NOT explain the concept, teach them, or give a lengthy explanation. A real interviewer never teaches during the interview. Instead, acknowledge briefly in ONE short sentence (e.g. 'No worries, let's move on.', 'That's okay.', 'Alright, let's try another topic.') and immediately ask the NEXT question. Never spend more than one sentence acknowledging a missed answer.\n"
        "12. Keep all your responses SHORT and conversational. Your total response must not exceed 3-4 sentences. One brief acknowledgment of the previous answer + one new question.\n"
        "13. Continue asking diverse technical questions until the full interview duration has elapsed."
    )

    if stress_mode:
        prompt += STRESS_MODE_APPENDIX

    return prompt


def _build_system_prompt_hr(
    user_name, role, company_name, experience_level, resume_text, job_description,
    duration_minutes=10, elapsed_minutes=0, questions_asked=0, stress_mode=False
):
    company_context = f"The target company is '{company_name}'.\n" if company_name else ""
    experience_context = f"The candidate has {experience_level} of experience.\n" if experience_level else ""
    pacing_guidance = _get_pacing_guidance(duration_minutes, elapsed_minutes, questions_asked)

    prompt = (
        f"You are a warm, professional HR interviewer named 'Liza' conducting an HR round for a candidate named '{user_name}' applying for the position of '{role}'.\n"
        f"{company_context}"
        f"{experience_context}"
        f"Here is the candidate's resume:\n{resume_text}\n"
        f"\n{pacing_guidance}\n\n"
        "INSTRUCTIONS & FLOW:\n"
        "1. Start with a friendly greeting, introduce yourself as Liza.\n"
        "2. Ask the candidate to briefly introduce themselves.\n"
        "3. Ask HR-focused questions: motivation, teamwork, conflict resolution, salary expectations, work culture preferences, strengths/weaknesses, career goals, achievements on their resume, and company alignment.\n"
        "4. Keep questions conversational, empathetic, and relevant to the role and company.\n"
        "5. Ask exactly ONE question at a time. Keep responses concise (2-3 sentences).\n"
        "6. If the candidate asks questions, answer helpfully and redirect back to your question.\n"
        "7. CRITICAL — NO TEACHING: If the candidate says 'I don't know' or gives an incomplete answer, do NOT explain the concept or teach them. Acknowledge briefly in ONE sentence (e.g. 'No worries, let's move on.') and immediately ask the next question. Never lecture or give lengthy explanations.\n"
        "8. Continue conducting the HR round until the full interview duration has elapsed."
    )

    if stress_mode:
        prompt += STRESS_MODE_APPENDIX

    return prompt


def _build_system_prompt_behavioural(
    user_name, role, company_name, experience_level, resume_text, job_description,
    duration_minutes=10, elapsed_minutes=0, questions_asked=0, stress_mode=False
):
    company_context = f"The target company is '{company_name}'.\n" if company_name else ""
    experience_context = f"The candidate has {experience_level} of experience.\n" if experience_level else ""
    pacing_guidance = _get_pacing_guidance(duration_minutes, elapsed_minutes, questions_asked)

    prompt = (
        f"You are a sharp behavioural interviewer named 'Liza' assessing a candidate named '{user_name}' for the position of '{role}'.\n"
        f"{company_context}"
        f"{experience_context}"
        f"Here is the candidate's resume:\n{resume_text}\n"
        f"\n{pacing_guidance}\n\n"
        "INSTRUCTIONS & FLOW:\n"
        "1. Start with a friendly greeting, introduce yourself as Liza.\n"
        "2. Ask the candidate to briefly introduce themselves.\n"
        "3. Ask STAR-method behavioural questions: 'Tell me about a time when...', 'Describe a situation where...', 'Give me an example of...'.\n"
        "4. Focus on diverse themes: leadership, handling conflict, cross-functional collaboration, overcoming project failures, tight deadlines, adaptability, and high-impact achievements from their resume.\n"
        "5. After each answer, probe deeper with follow-ups like 'What was the quantifiable result?', 'What did you learn from that experience?', 'What would you do differently today?'.\n"
        "6. Ask exactly ONE question at a time. Keep responses concise.\n"
        "7. If the candidate asks questions, answer helpfully and redirect back.\n"
        "8. CRITICAL — NO TEACHING: If the candidate says 'I don't know' or cannot recall a situation, do NOT explain what a good answer would look like or teach them. Acknowledge briefly in ONE sentence (e.g. 'That's alright, let's try another scenario.') and immediately ask the next question.\n"
        "9. Continue the behavioural assessment until the full interview duration has elapsed."
    )

    if stress_mode:
        prompt += STRESS_MODE_APPENDIX

    return prompt


def _build_system_prompt_negotiation(
    user_name, role, company_name, experience_level, resume_text,
    duration_minutes=10, elapsed_minutes=0, questions_asked=0
):
    """Build a system prompt for the Salary & Offer Negotiation Simulator."""
    company_context = f"The target company is '{company_name}'.\n" if company_name else ""
    experience_context = f"The candidate has {experience_level} of experience.\n" if experience_level else ""
    pacing_guidance = _get_pacing_guidance(duration_minutes, elapsed_minutes, questions_asked)

    return (
        f"You are a seasoned, professional recruiter and hiring manager named 'Liza' conducting a salary negotiation simulation with a candidate named '{user_name}' for the position of '{role}'.\n"
        f"{company_context}"
        f"{experience_context}"
        f"Here is the candidate's resume:\n{resume_text}\n"
        f"\n{pacing_guidance}\n\n"
        "INSTRUCTIONS & FLOW:\n"
        "1. In your very first turn, introduce yourself warmly as Liza from the hiring team. Congratulate the candidate on passing the interview rounds.\n"
        "2. Present an initial compensation offer that is slightly below market rate for the role and experience level. Include base salary, equity/stock options, and sign-on bonus (if applicable).\n"
        "3. When the candidate counter-offers, push back using realistic recruiter tactics:\n"
        "   - 'That's at the very top of our band for this level.'\n"
        "   - 'Our equity package historically appreciates significantly — it more than makes up for the base difference.'\n"
        "   - 'We don't typically offer sign-on bonuses at this level, but let me see what I can do.'\n"
        "   - 'I understand your expectations. Let me share what flexibility I have...'\n"
        "4. Be open to compromise — don't always say no. If the candidate makes strong arguments (citing market data, competing offers, or unique skills), acknowledge them and adjust the offer.\n"
        "5. Keep responses concise and conversational (2-4 sentences). Ask exactly ONE question or make ONE counter per turn.\n"
        "6. Conduct realistic multi-stage negotiations spanning base pay, bonuses, stock vesting, relocation, and start dates.\n"
        "7. End the simulation by thanking the candidate and summarizing the final agreed package only when time has elapsed.\n"
        "8. Never break character — you are a real recruiter throughout this simulation."
    )


def _build_system_prompt_dsa(user_name, role, company_name, experience_level, resume_text, dsa_context=None):
    company_context = f"The target company is '{company_name}'.\n" if company_name else ""
    experience_context = f"The candidate has {experience_level} of experience.\n" if experience_level else ""

    base = (
        f"You are a patient and encouraging DSA coding interviewer named 'Liza' conducting a coding round for '{user_name}' applying for '{role}'.\n"
        f"{company_context}"
        f"{experience_context}"
        "\nINSTRUCTIONS:\n"
        "1. The candidate is solving LeetCode problems in a live coding editor.\n"
        "2. Be supportive, offer hints if they ask, and encourage them to think out loud.\n"
        "3. Keep your responses SHORT and conversational (1-3 sentences max).\n"
        "4. Do NOT give away the solution. If they ask for a hint, give a small nudge toward the right approach.\n"
        "5. CRITICAL — NO TEACHING: If the candidate says 'I don't know' or is stuck, do NOT explain the full algorithm or teach the concept. Give a brief 1-sentence hint at most and let them work through it.\n"
        "6. You are here to simulate a real coding interview — talk naturally, respond to what they say.\n"
    )

    if dsa_context:
        action = dsa_context.get("action", "")
        current_q = dsa_context.get("current_question", {})
        code = dsa_context.get("submitted_code", "")

        if action == "explain":
            q_title = current_q.get("title", "the problem") if current_q else "the problem"
            base += (
                f"\n6. The candidate just submitted their code for '{q_title}'. Here is their code:\n```\n{code}\n```\n"
                "7. First, acknowledge their submission for this question. Then ask them to briefly explain what their code does and the time/space complexity.\n"
                "8. Inform them they can work on the other question, or finish the round when ready.\n"
                "9. Keep it concise."
            )

    return base


def _build_system_prompt_sql(user_name, role, company_name, experience_level, resume_text, sql_context=None):
    company_context = f"The target company is '{company_name}'.\n" if company_name else ""
    experience_context = f"The candidate has {experience_level} of experience.\n" if experience_level else ""

    base = (
        f"You are a sharp, conversational database and SQL engineering interviewer named 'Liza' conducting a live SQL assessment round for '{user_name}' applying for '{role}'.\n"
        f"{company_context}"
        f"{experience_context}"
        "\nCRITICAL INTERVIEW RULES:\n"
        "1. This is EXCLUSIVELY a SQL and database assessment round. The candidate has an in-browser code editor and interactive SQLite console to solve 3 SQL challenges.\n"
        "2. NEVER ask generic behavioral questions (such as 'tell me about yourself', 'walk me through your resume', or 'tell me about programming languages/frameworks').\n"
        "3. All your interactions MUST revolve strictly around SQL queries, database schema, clauses (SELECT, WHERE, JOIN, GROUP BY, HAVING, subqueries, CTEs, window functions), query performance, and the SQL questions in this round.\n"
        "4. Be supportive, inquisitive, and encourage the candidate to discuss their approach, query design, and how they handle edge cases (NULLs, duplicates, empty datasets).\n"
        "5. Keep your responses CONCISE and natural (2-3 sentences max).\n"
        "6. If the candidate asks for help or hints, provide a brief conceptual hint without giving away the complete SQL solution.\n"
    )

    if sql_context:
        action = sql_context.get("action", "")
        current_q = sql_context.get("current_question", {})
        code = sql_context.get("submitted_code", "")
        q_idx = sql_context.get("question_index", 0)
        all_q = sql_context.get("all_questions", [])

        if current_q:
            q_title = current_q.get("title", f"Question {q_idx + 1}")
            topic = current_q.get("topic", "SQL")
            diff = current_q.get("difficulty", "Easy")
            desc = current_q.get("description", "")
            schema = current_q.get("schema_sql", "")
            base += (
                f"\nCURRENT QUESTION CONTEXT:\n"
                f"- The candidate is currently working on Question {q_idx + 1} of {len(all_q) or 3}: '{q_title}' (Topic: {topic}, Difficulty: {diff})\n"
                f"- Problem Prompt: {desc}\n"
            )
            if schema:
                base += f"- Schema / Tables: {schema[:400]}\n"

        if code and code.strip():
            base += f"- Candidate's Current SQL Query Draft:\n```sql\n{code.strip()}\n```\n"

        if action == "explain":
            base += (
                "\n7. The candidate just submitted or tested their query and wants to explain their approach. "
                "Acknowledge their query, ask them to explain their logic (e.g. why they chose specific JOINs, filters, or aggregations), "
                "and ask how it handles potential edge cases. Keep response to 2-3 sentences max.\n"
            )
        else:
            base += (
                "\n7. The candidate is conversing with you while viewing this SQL question. "
                "Respond directly in the context of this SQL question and database engineering. "
                "If they ask whether this is a normal interview or express confusion, clearly explain that this is their hands-on SQL assessment round where they solve the 3 challenges in the editor. "
                "Encourage them to work through the current problem and ask about their query approach.\n"
            )
    else:
        base += (
            "\n7. Remind the candidate that they have 3 SQL challenges to solve in the interactive workspace. "
            "Ask them what approach they plan to take for their SQL queries.\n"
        )

    return base


def _build_system_prompt_peer(user_name, role, company_name, experience_level, resume_text, job_description, interview_type="technical"):
    company_info = f"Target Company: {company_name}\n" if company_name else ""
    exp_info = f"Candidate Experience Level: {experience_level}\n" if experience_level else ""
    jd_info = f"Target Job Description:\n{job_description}\n" if job_description else ""
    resume_info = f"Candidate Resume:\n{resume_text}\n" if resume_text else ""

    return (
        f"You are an expert AI interview guide assisting a HUMAN INTERVIEWER who is conducting a live mock interview with candidate '{user_name}' for the '{role}' role.\n"
        f"{company_info}"
        f"{exp_info}"
        f"{resume_info}"
        f"{jd_info}"
        "\nCRITICAL RULES & INSTRUCTIONS FOR PEER INTERVIEW MODE:\n"
        "1. NEVER introduce yourself as 'Liza' or refer to yourself as an AI, bot, or virtual agent.\n"
        "2. The question must be written from the perspective of the HUMAN INTERVIEWER speaking directly to the candidate '{user_name}' (e.g. 'In your recent project at...', 'Could you explain how you designed...', 'How did you handle...').\n"
        "3. Focus heavily on technical depth, architecture, trade-offs, algorithms, or real-world problem solving based on the candidate's resume and their latest response.\n"
        "4. Ask exactly ONE clear, concise question at a time (1-3 sentences).\n"
        "5. Output ONLY the question text for the interviewer to read aloud. Do NOT include markdown quotes, pleasantries like 'Sure!', or meta-commentary."
    )


# ──────────────────────────────────────────────────────────────
# MAIN QUESTION GENERATION
# ──────────────────────────────────────────────────────────────

def generate_interview_question(
    resume_text: str, role: str, conversation_history: list,
    user_name: str = "Anshu", company_name: str = "",
    experience_level: str = "", job_description: str = "",
    interview_type: str = "technical", dsa_context: dict = None,
    sql_context: dict = None,
    is_time_up: bool = False, stress_mode: bool = False,
    is_peer: bool = False,
    duration_minutes: int = 10,
    elapsed_minutes: int = 0,
    questions_asked: int = 0,
    diversity_config: dict = None,
) -> str:
    """
    Generate the next interview question based on interview type, conversation history,
    selected duration pacing, resume diversity, and experience level.
    """
    role_lower = role.lower() if role else ""
    api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GEMINI_API")
    if diversity_config is None:
        diversity_config = build_session_diversity_config(role=role, interview_type=interview_type)

    # ── Peer-to-Peer Question 1 (Turn 1): Initial opening question for human interviewer ──
    if is_peer and not conversation_history:
        greeting_company = f" at {company_name}" if company_name else ""
        role_part = f" for the {role} position" if role else ""
        peer_openers = [
            f"Hi {user_name}, could you tell me a bit about yourself, your background, and walk me through some of the key projects you've worked on recently{role_part}{greeting_company}?",
            f"Welcome {user_name}! To kick things off{role_part}{greeting_company}, could you share a brief overview of your experience and one technical problem you really enjoyed solving?",
            f"Hi {user_name}, great to meet you today. Before we dive deep{role_part}{greeting_company}, could you walk me through your background and the core stack you've focused on lately?",
        ]
        return random.choice(peer_openers)

    # Short-circuit AI Liza greeting (Turn 1 for solo AI interview mode)
    if not conversation_history and interview_type != "dsa" and interview_type != "sql" and not is_peer:
        greeting_role = role if role else "specified"
        company_part = f" at {company_name}" if company_name else ""
        round_label = {
            "technical": "technical interview",
            "hr": "HR round",
            "behavioural": "behavioural interview",
            "negotiation": "salary negotiation simulation",
        }.get(interview_type, "interview")
        greet_idx = diversity_config.get("greeting_variant", 0) % 4
        greetings = [
            f"Hello {user_name}! I'm Liza, your interview agent. I will be conducting your {round_label} today for the {greeting_role} position{company_part}. How are you and how are you feeling today?",
            f"Hi {user_name}, welcome! I'm Liza, and I'll be guiding your {round_label} for the {greeting_role} role{company_part} today. How is your day going so far?",
            f"Good to have you here, {user_name}! I'm Liza, and today we'll run through a fresh {round_label} tailored to the {greeting_role} position{company_part}. How are you feeling before we jump in?",
            f"Welcome {user_name}! I'm Liza, your interviewer for today's {greeting_role} {round_label}{company_part}. First off, how are you doing today?",
        ]
        return greetings[greet_idx]

    def get_mock_response(history, key_role_lower, name, current_role, is_time_up=False, is_peer=False, interview_type="technical", sql_context=None, dsa_context=None, div_cfg=None):
        if is_peer:
            peer_questions = [
                f"Hi {name}, could you tell me about yourself, your background, and the key projects you have worked on?",
                f"Looking at your resume, {name}, what was the most technically complex project you built and what architecture decisions did you make?",
                f"How did you approach database design, caching, and performance optimization in that project?",
                f"Can you describe a challenging production bug or bottleneck you encountered and how you diagnosed and resolved it?",
                f"Could you explain the key trade-offs between SQL and NoSQL databases, and when you would choose one over the other for this architecture?",
                f"That covers my main technical questions. Do you have any questions for me about the team, tech stack, or role?"
            ]
            answered_turns = sum(1 for m in history if m.get("role") == "user")
            if answered_turns < len(peer_questions):
                return peer_questions[answered_turns]
            return f"Thank you for sharing your experience, {name}. Do you have any questions for me?"

        # SQL Assessment Mock Response Flow
        if interview_type == "sql":
            current_q = sql_context.get("current_question", {}) if sql_context else {}
            q_title = current_q.get("title", "Question 1") if current_q else "Question 1"
            q_idx = sql_context.get("question_index", 0) if sql_context else 0

            if is_time_up:
                return f"Time is up for the SQL assessment, {name}! Great effort solving the queries. We will compile your evaluation report now."

            last_msg = history[-1] if history else None
            last_text = (last_msg.get("text", "") if last_msg else "").lower()

            if any(term in last_text for term in ["normal", "regular", "sql", "is this", "isn't this", "isnt this", "what is this"]):
                return (
                    f"This is your dedicated SQL assessment round, {name}! You have 3 database challenges to solve in the interactive SQLite workspace. "
                    f"You are currently on Question {q_idx + 1}: '{q_title}'. Write your query in the editor, test it against the database, and let me know your approach!"
                )

            if sql_context and sql_context.get("action") == "explain":
                return (
                    f"Nice work submitting your query for '{q_title}', {name}. Can you walk me through your query logic, "
                    f"the clauses or JOINs you chose, and how your query handles edge cases like NULL values?"
                )

            sql_prompts = [
                f"Welcome to your SQL assessment, {name}! Take a look at Question {q_idx + 1}: '{q_title}' and its schema. What is your initial approach for this query?",
                f"For Question {q_idx + 1} ('{q_title}'), what clauses (like SELECT, WHERE, or JOIN) are you planning to use to solve it?",
                f"Once you run and verify your query in the console, feel free to explain your reasoning or click 'Explain Query to Liza'.",
                f"How does your query perform with large datasets, and would an index help optimize this retrieval?",
            ]
            answered_turns = sum(1 for m in history if m.get("role") == "user")
            return sql_prompts[min(answered_turns, len(sql_prompts) - 1)]

        # DSA Assessment Mock Response Flow
        if interview_type == "dsa":
            current_q = dsa_context.get("current_question", {}) if dsa_context else {}
            q_title = current_q.get("title", "the coding problem") if current_q else "the coding problem"

            if is_time_up:
                return f"Time is up for the DSA round, {name}! Great effort on your algorithms. We will compile your evaluation report now."

            if dsa_context and dsa_context.get("action") == "explain":
                return f"I see your code submission for '{q_title}', {name}. Can you walk me through your time and space complexity, and how your solution handles edge cases?"

            return f"Take your time writing your solution for '{q_title}', {name}. Feel free to talk through your algorithmic logic or ask for a hint if you're stuck."

        # 1. Count how many of the user turns were NOT questions/clarification requests
        answered_turns = 0
        for msg in history:
            if msg.get("role") == "user":
                if not is_user_asking_question(msg.get("text", "")):
                    answered_turns += 1

        # Check if time limit is reached or if questions are exhausted
        if _is_ai_ml_role(current_role):
            mock_key = "ai_ml"
        elif "engineer" in key_role_lower or "developer" in key_role_lower:
            mock_key = "software engineer"
        else:
            mock_key = "default"
        q_list = list(MOCK_QUESTIONS[mock_key])
        if div_cfg and div_cfg.get("seed"):
            random.Random(div_cfg["seed"]).shuffle(q_list)
        recent_lower = {rq.lower()[:45] for rq in (div_cfg or {}).get("recent_questions", []) if rq}
        if recent_lower:
            fresh_q = [q for q in q_list if q.lower()[:45] not in recent_lower]
            if fresh_q:
                q_list = fresh_q + [q for q in q_list if q not in fresh_q]
        mock_index = answered_turns - 3

        if is_time_up or mock_index >= len(q_list):
            return f"Thank you for taking the time to speak with me today, {name}. The interview is complete."

        # 2. Check if the very last message in the history is a user question/clarification
        last_msg = history[-1] if history else None
        if last_msg and last_msg.get("role") == "user" and is_user_asking_question(last_msg.get("text", "")):
            last_model_question = ""
            for msg in reversed(history):
                if msg.get("role") == "model":
                    if "get back to my question" not in msg.get("text", "").lower() and "shall we continue" not in msg.get("text", "").lower():
                        last_model_question = msg.get("text", "")
                        break
            
            if not last_model_question:
                for msg in reversed(history):
                    if msg.get("role") == "model":
                        last_model_question = msg.get("text", "")
                        break

            EXPLANATIONS = {
                "challenging coding project": (
                    "I want to know about a project where you faced difficult technical hurdles, "
                    "how you resolved them, and what specific engineering choices you made."
                ),
                "database optimization and indexing": (
                    "I am asking how you speed up database reads/writes, such as designing indexes, "
                    "refactoring slow queries, caching data, or database normalization/denormalization."
                ),
                "difference between a sql and nosql database": (
                    "I want you to compare relational databases (like PostgreSQL) with non-relational ones (like MongoDB) "
                    "and explain the use cases, scaling differences, and schema flexibilities of both."
                ),
                "debugging a memory leak or cpu spike": (
                    "I want to know your step-by-step process and the tools (like profiling, logs, metrics) "
                    "you use to diagnose and fix a server that is running out of RAM or maxing out CPU."
                ),
                "project from your resume that you are most proud of": (
                    "Please describe a project you built where you had a major impact, the technical challenge "
                    "it solved, and what technologies you used."
                ),
                "motivated you to apply for this specific role": (
                    "I want to know what interests you about this position and company, and how your skills "
                    "align with the responsibilities."
                ),
                "conflict or differing opinions within a team": (
                    "Please explain how you deal with disagreements at work, communicate with team members, "
                    "and collaborate to find a compromise."
                ),
                "tight deadline under stress": (
                    "I am asking how you handle pressure, manage your time, prioritize tasks, and ensure "
                    "a project gets delivered on time."
                ),
            }

            user_text_lower = last_msg.get("text", "").lower()
            explanation_found = False
            answer = "Understood. Let me clarify."

            if last_model_question:
                q_text_lower = last_model_question.lower()
                for key, expl in EXPLANATIONS.items():
                    if key in q_text_lower:
                        answer = f"Sure, let me clarify: {expl}"
                        explanation_found = True
                        break

            if not explanation_found:
                if "role" in user_text_lower or "position" in user_text_lower or "job" in user_text_lower:
                    answer = f"You are interviewing for the '{current_role}' position."
                elif "resume" in user_text_lower or "experience" in user_text_lower:
                    answer = "I am evaluating your experience based on the resume you uploaded."
                elif "who" in user_text_lower or "name" in user_text_lower:
                    answer = f"According to your resume, your name is {name}."

            if last_model_question:
                return f"{answer} Let's get back to my question: {last_model_question}"
            return f"{answer} Shall we continue with the interview?"

        # 3. If the user answered the question (or it's the start), proceed with mock interview flow
        if answered_turns == 0:
            return "Hi! I'm Liza, your interview agent. How are you and how are you feeling today?"
        elif answered_turns == 1:
            return f"So {name}, shall we start the interview now? Are you ready?"
        elif answered_turns == 2:
            return f"Great! {name}, tell me about yourself."

        if mock_index < len(q_list):
            return q_list[mock_index]
        return f"Thank you for taking the time to speak with me today, {name}. The interview is complete."

    # 1. Fallback to mock if API key is not present
    if not api_key:
        print("[LLM INFO] No GEMINI_API_KEY found. Falling back to rule-based questions.")
        return get_mock_response(conversation_history, role_lower, user_name, role, is_time_up, is_peer=is_peer, interview_type=interview_type, sql_context=sql_context, dsa_context=dsa_context, div_cfg=diversity_config)

    # 2. Use Gemini API
    try:
        # Build system prompt based on interview type or peer mode
        if is_peer:
            system_instruction = _build_system_prompt_peer(
                user_name, role, company_name, experience_level, resume_text, job_description, interview_type
            )
        elif interview_type == "dsa":
            system_instruction = _build_system_prompt_dsa(
                user_name, role, company_name, experience_level, resume_text, dsa_context
            )
        elif interview_type == "sql":
            system_instruction = _build_system_prompt_sql(
                user_name, role, company_name, experience_level, resume_text, sql_context
            )
        elif interview_type == "hr":
            system_instruction = _build_system_prompt_hr(
                user_name, role, company_name, experience_level, resume_text, job_description,
                duration_minutes=duration_minutes, elapsed_minutes=elapsed_minutes,
                questions_asked=questions_asked, stress_mode=stress_mode
            )
        elif interview_type == "behavioural":
            system_instruction = _build_system_prompt_behavioural(
                user_name, role, company_name, experience_level, resume_text, job_description,
                duration_minutes=duration_minutes, elapsed_minutes=elapsed_minutes,
                questions_asked=questions_asked, stress_mode=stress_mode
            )
        elif interview_type == "negotiation":
            system_instruction = _build_system_prompt_negotiation(
                user_name, role, company_name, experience_level, resume_text,
                duration_minutes=duration_minutes, elapsed_minutes=elapsed_minutes,
                questions_asked=questions_asked
            )
        else:
            system_instruction = _build_system_prompt_technical(
                user_name, role, company_name, experience_level, resume_text, job_description,
                duration_minutes=duration_minutes, elapsed_minutes=elapsed_minutes,
                questions_asked=questions_asked, stress_mode=stress_mode,
                diversity_config=diversity_config,
            )

        # Dynamic adjustments to system instructions based on elapsed time
        if is_time_up:
            system_instruction += (
                "\n\nCRITICAL INSTRUCTION: The interview time limit is up. You must politely conclude the interview in this turn. "
                "Thank the candidate warmly, state that the interview is complete, provide brief encouraging closing remarks, and wish them a great day. "
                "Do NOT ask any new questions."
            )
        elif not is_peer:
            if elapsed_minutes >= (duration_minutes - 2) and elapsed_minutes > 0:
                system_instruction += (
                    f"\n\nPACING NOTICE: Approximately 1 to 2 minutes remain in this {duration_minutes}-minute interview. "
                    "Ask your final substantive question or a forward-looking reflective question, and keep in mind we will wrap up on the next turn."
                )
            # Reinforce clarifying question instructions for solo AI mode
            system_instruction += (
                "\n\nCRITICAL REMINDER ON CLARIFICATIONS: If the candidate asks you to explain, repeat, or clarify a question, "
                "you must explain that question in simple, helpful, and warm terms rather than repeating it verbatim. "
                "Once explained, repeat/re-ask the current question so they can answer it."
            )

        # Reinforce number formatting rules
        system_instruction += (
            "\n\nCRITICAL OFFER WRITING RULE: When discussing salaries, packages, compensation, and money, "
            "you must ALWAYS write them in numeric digit representations using standard comma grouping (e.g., write '18,00,000 rupees' or '18,00,000 INR' "
            "instead of 'eighteen lakh rupees', and write '$100,000' or '100,000 USD' instead of 'one hundred thousand dollars'). "
            "Do NOT write out monetary numbers in words, but ALWAYS format them as numbers in digits so they display clean and professional "
            "on screen. The text-to-speech engine will automatically convert these numbers to natural spoken words."
        )

        # Build contents structure
        contents = []
        
        if is_peer:
            # For peer mode, instruct Gemini to generate the next question for the human interviewer
            contents.append({
                "role": "user",
                "parts": [f"Generate a technical interview question for me (the interviewer) to ask candidate {user_name} based on their resume, the {role} position, and their previous answers. Do not say you are Liza or introduce yourself as an AI."]
            })
        elif interview_type == "sql":
            contents.append({
                "role": "user",
                "parts": [f"I am candidate {user_name}. I am in the live SQL assessment solving challenges in the SQL editor."]
            })
        elif interview_type == "dsa":
            contents.append({
                "role": "user",
                "parts": [f"I am candidate {user_name}. I am in the live DSA coding round solving challenges in the editor."]
            })
        else:
            # Prepend hidden user prompt at the very beginning of the history to trigger the solo greeting/intro instruction
            contents.append({
                "role": "user",
                "parts": ["Introduce yourself and start the interview by asking how I am feeling today."]
            })
        
        for msg in conversation_history:
            g_role = "user" if msg.get("role") == "user" else "model"
            text = msg.get("text", "")
            # If user submitted code, include it in the message
            if msg.get("code"):
                text += f"\n\n[Code Submitted]:\n```\n{msg['code']}\n```"
            contents.append({
                "role": g_role,
                "parts": [text]
            })

        gen_config = genai.types.GenerationConfig(
            temperature=0.6 if is_time_up else 0.92,
            top_p=0.95,
        )
        result_text = _call_gemini_with_fallback(
            models=["gemini-3.5-flash-lite", "gemini-2.5-flash", "gemini-2.0-flash"],
            prompt=contents,
            system_instruction=system_instruction,
            generation_config=gen_config,
            timeout=30.0,
        )
        # Clean any accidental quotes or Liza references in peer mode
        if is_peer:
            result_text = re.sub(r"^(Hello|Hi|Hey),?\s*I am Liza[^.]*\.\s*", "", result_text, flags=re.IGNORECASE)
            result_text = re.sub(r"^I'm Liza[^.]*\.\s*", "", result_text, flags=re.IGNORECASE)
            result_text = result_text.strip().strip('"').strip("'")
        return result_text
    except Exception as e:
        print(f"[LLM ERROR] Gemini API call failed: {e}. Falling back to mock questions.")
        return get_mock_response(conversation_history, role_lower, user_name, role, is_time_up, is_peer=is_peer, interview_type=interview_type, sql_context=sql_context, dsa_context=dsa_context, div_cfg=diversity_config)


# ──────────────────────────────────────────────────────────────
# DSA QUESTION GENERATION (LeetCode-style via Gemini)
# ──────────────────────────────────────────────────────────────

# Fallback mock DSA questions when API is unavailable
MOCK_DSA_QUESTIONS = {
    "Easy": {
        "number": 1,
        "title": "Two Sum",
        "difficulty": "Easy",
        "description": (
            "Given an array of integers `nums` and an integer `target`, return indices of the two numbers "
            "such that they add up to `target`.\n\n"
            "You may assume that each input would have **exactly one solution**, and you may not use the same element twice.\n\n"
            "You can return the answer in any order.\n\n"
            "**Example 1:**\n"
            "```\nInput: nums = [2,7,11,15], target = 9\nOutput: [0,1]\nExplanation: Because nums[0] + nums[1] == 9, we return [0, 1].\n```\n\n"
            "**Example 2:**\n"
            "```\nInput: nums = [3,2,4], target = 6\nOutput: [1,2]\n```\n\n"
            "**Constraints:**\n"
            "- 2 <= nums.length <= 10^4\n"
            "- -10^9 <= nums[i] <= 10^9\n"
            "- -10^9 <= target <= 10^9\n"
            "- Only one valid answer exists."
        ),
        "boilerplate": {
            "python": "class Solution:\n    def twoSum(self, nums: list[int], target: int) -> list[int]:\n        # Write your solution here\n        pass",
            "javascript": "/**\n * @param {number[]} nums\n * @param {number} target\n * @return {number[]}\n */\nvar twoSum = function(nums, target) {\n    // Write your solution here\n};",
            "cpp": "class Solution {\npublic:\n    vector<int> twoSum(vector<int>& nums, int target) {\n        // Write your solution here\n    }\n};",
            "java": "class Solution {\n    public int[] twoSum(int[] nums, int target) {\n        // Write your solution here\n    }\n}"
        }
    },
    "Medium": {
        "number": 3,
        "title": "Longest Substring Without Repeating Characters",
        "difficulty": "Medium",
        "description": (
            "Given a string `s`, find the length of the **longest substring** without repeating characters.\n\n"
            "**Example 1:**\n"
            "```\nInput: s = \"abcabcbb\"\nOutput: 3\nExplanation: The answer is \"abc\", with the length of 3.\n```\n\n"
            "**Example 2:**\n"
            "```\nInput: s = \"bbbbb\"\nOutput: 1\nExplanation: The answer is \"b\", with the length of 1.\n```\n\n"
            "**Example 3:**\n"
            "```\nInput: s = \"pwwkew\"\nOutput: 3\nExplanation: The answer is \"wke\", with the length of 3.\n```\n\n"
            "**Constraints:**\n"
            "- 0 <= s.length <= 5 * 10^4\n"
            "- `s` consists of English letters, digits, symbols and spaces."
        ),
        "boilerplate": {
            "python": "class Solution:\n    def lengthOfLongestSubstring(self, s: str) -> int:\n        # Write your solution here\n        pass",
            "javascript": "/**\n * @param {string} s\n * @return {number}\n */\nvar lengthOfLongestSubstring = function(s) {\n    // Write your solution here\n};",
            "cpp": "class Solution {\npublic:\n    int lengthOfLongestSubstring(string s) {\n        // Write your solution here\n    }\n};",
            "java": "class Solution {\n    public int lengthOfLongestSubstring(String s) {\n        // Write your solution here\n    }\n}"
        }
    }
}


def _call_gemini_with_fallback(
    models: list,
    prompt,
    system_instruction: str = None,
    timeout: float = 30.0,
    generation_config=None,
) -> str:
    """
    Attempts generation across a prioritized list of models.
    Automatically catches quota exhaustion or transient errors
    and fails over seamlessly to the next model in the list.
    """
    last_exc = None
    for model_name in models:
        try:
            kwargs = {"model_name": model_name}
            if system_instruction:
                kwargs["system_instruction"] = system_instruction
            model = genai.GenerativeModel(**kwargs)
            call_kwargs = {}
            if generation_config is not None:
                call_kwargs["generation_config"] = generation_config
            response = gemini_circuit_breaker.call_sync(model.generate_content, prompt, timeout=timeout, **call_kwargs)
            if response and response.text:
                return response.text.strip()
        except Exception as e:
            last_exc = e
            err_str = str(e)
            if "circuit breaker" in err_str.lower() or "is OPEN" in err_str:
                break
            if "429" in err_str or "quota" in err_str.lower() or "ResourceExhausted" in err_str:
                print(f"[LLM FALLBACK] Quota exceeded on {model_name}, failing over to next model...")
                continue
            print(f"[LLM RETRY] Error on {model_name}: {e}. Retrying with next model...")
            continue

    if last_exc:
        raise last_exc
    raise RuntimeError("All models failed to generate content.")


def generate_dsa_question(
    company_name: str = "",
    role: str = "",
    difficulty: str = "Easy",
    experience_level: str = "",
    previous_questions: list = None,
) -> dict:
    """
    Generate a LeetCode-style DSA question using Gemini.
    Returns a dict with keys: number, title, difficulty, description, boilerplate.
    """
    api_key = os.environ.get("GEMINI_API_KEY")

    if not api_key:
        print(f"[DSA GEN] No API key. Using mock {difficulty} question.")
        return MOCK_DSA_QUESTIONS.get(difficulty, MOCK_DSA_QUESTIONS["Easy"])

    try:
        prev_titles = ""
        if previous_questions:
            titles = [q.get("title", "") for q in previous_questions]
            prev_titles = f"\nDo NOT repeat any of these previously asked questions: {', '.join(titles)}.\n"

        company_difficulty_hint = ""
        if company_name:
            company_difficulty_hint = (
                f"\nThe candidate is interviewing at '{company_name}'. "
                f"Choose a LeetCode question whose difficulty matches what '{company_name}' would actually ask in a real interview. "
                f"For top tech companies (Google, Meta, Amazon, Microsoft, Apple, etc.), lean toward harder/trickier problems within the {difficulty} category. "
                f"For service companies (Capgemini, Infosys, TCS, Wipro, Accenture, etc.), lean toward more standard/classic problems.\n"
            )

        prompt = f"""You are a LeetCode question selector for a mock DSA coding interview.

Select ONE real LeetCode problem of difficulty '{difficulty}'.
{company_difficulty_hint}
{prev_titles}
The candidate is applying for the role of '{role}'.
{'They have ' + experience_level + ' of experience.' if experience_level else ''}

Return ONLY valid JSON with exactly these keys:
- "number": the real LeetCode problem number (integer)
- "title": the exact LeetCode problem title (string)
- "difficulty": "{difficulty}" (string)
- "description": the full problem description including examples and constraints, formatted in Markdown (string)
- "boilerplate": an object with keys "python", "javascript", "cpp", "java" containing starter code templates for each language (strings)

IMPORTANT RULES:
1. Use ONLY real, well-known LeetCode problems with correct problem numbers.
2. The description must include at least 2 examples and constraints.
3. Boilerplate code should have the correct function signature with a placeholder comment.
4. Return ONLY valid JSON. No markdown fences, no explanation, no extra text."""

        raw = _call_gemini_with_fallback(
            models=["gemini-3.5-flash", "gemini-2.5-flash", "gemini-3.5-flash-lite"],
            prompt=prompt,
            timeout=30.0
        )

        result = _extract_json_from_text(raw)

        # Validate essential keys
        required = {"number", "title", "difficulty", "description", "boilerplate"}
        if required.issubset(result.keys()):
            return result

        print(f"[DSA GEN] Missing keys in response. Got: {list(result.keys())}. Falling back to mock.")
        return MOCK_DSA_QUESTIONS.get(difficulty, MOCK_DSA_QUESTIONS["Easy"])

    except Exception as e:
        print(f"[DSA GEN ERROR] {e}. Falling back to mock.")
        return MOCK_DSA_QUESTIONS.get(difficulty, MOCK_DSA_QUESTIONS["Easy"])


def generate_dynamic_sql_question(
    difficulty: str = "Intermediate",
    topic: str = None,
    role: str = "Software Engineer",
    company_name: str = "",
    experience_level: str = "",
    previous_questions: list = None,
) -> dict:
    """
    Generate a fresh, unique SQL assessment question using Gemini with schema, sample data,
    and reference solution, with fallback to curated bank.
    """
    import sqlite3
    from app.services.sql_questions import get_sql_questions
    api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GEMINI_API")

    topics_list = [topic] if topic else []
    fallback_q = get_sql_questions(difficulty=difficulty, topics=topics_list, count=1)
    fallback = fallback_q[0] if fallback_q else None

    if not api_key:
        return fallback

    try:
        topic_clause = f"Focus strictly on the SQL topic: '{topic}'." if topic else "Pick from SELECT, WHERE, JOIN, GROUP BY, HAVING, Subqueries, CTEs, or Window Functions."
        prompt = f"""You are a SQL coding assessment designer. Generate ONE brand-new, realistic SQL challenge of difficulty '{difficulty}'.
{topic_clause}
The candidate is interviewing for '{role}'.

Return ONLY valid JSON with exactly these keys:
- "id": a unique identifier string (e.g. "dyn_sql_101")
- "topic": one of "SELECT", "WHERE", "JOIN", "GROUP BY", "HAVING", "Subqueries", "CTEs", "Window Functions", "Aggregates", "ORDER BY / LIMIT"
- "difficulty": "{difficulty}"
- "title": a clear problem title (string)
- "description": clean, structured problem prompt in Markdown WITHOUT revealing ANY SQL code or solution clauses (string)
- "schema_sql": valid SQLite-compatible CREATE TABLE and INSERT statements to seed 1-2 small tables with 3-5 rows each
- "expected_query": the reference correct SQL query solution
- "expected_columns": list of column name strings expected from the query
- "expected_rows": list of row lists matching the expected query output
- "hints": list of 1-2 conceptual hints

IMPORTANT RULES FOR "description":
1. Structure "description" cleanly using EXACTLY these bold headings:
   **Goal:** <1 concise sentence explaining the business/data objective>
   **Requirements:**
   - <bullet points explaining filters, joins/aggregations, rounding, tie-breakers, and sort order in plain English>
   **Output Columns:** `col1`, `col2`, ...
2. NEVER put SQL solution queries, syntax, functions, or clauses in "description" (do NOT write SELECT, FROM, JOIN, GROUP BY, HAVING, ORDER BY, LIMIT, OVER, PARTITION BY, CASE WHEN, ROW_NUMBER, COALESCE, SUM(, COUNT(, AVG(, etc.). Only reference table/column identifiers in backticks.
3. Ensure "schema_sql" and "expected_query" are 100% valid SQLite syntax.
4. Return ONLY valid JSON, no surrounding text."""

        raw = _call_gemini_with_fallback(
            models=["gemini-3.5-flash", "gemini-2.5-flash", "gemini-3.5-flash-lite"],
            prompt=prompt,
            timeout=30.0
        )
        result = _extract_json_from_text(raw)
        required = {"id", "topic", "difficulty", "title", "description", "schema_sql", "expected_query"}
        if not required.issubset(result.keys()):
            return fallback

        desc_text = result.get("description") or ""
        sql_leak_re = re.compile(
            r"\b(SELECT|INNER\s+JOIN|LEFT\s+JOIN|GROUP\s+BY|ORDER\s+BY|HAVING|CASE\s+WHEN|ROW_NUMBER|DENSE_RANK|PARTITION\s+BY)\b"
        )
        if sql_leak_re.search(desc_text):
            print("[SQL DYN GEN] Rejected generated SQL description due to SQL keyword leakage. Using curated fallback.")
            return fallback

        # Verify SQLite execution & normalize expected_columns / expected_rows deterministically
        conn = sqlite3.connect(":memory:")
        try:
            cur = conn.cursor()
            cur.executescript(result["schema_sql"])
            cur.execute(result["expected_query"])
            result["expected_columns"] = [d[0] for d in (cur.description or [])]
            result["expected_rows"] = [list(r) for r in cur.fetchall()]
        finally:
            conn.close()

        if not result.get("expected_columns"):
            return fallback
        return result
    except Exception as e:
        print(f"[SQL DYN GEN ERROR] {e}. Falling back to curated bank.")
        return fallback


# ──────────────────────────────────────────────────────────────
# POST-INTERVIEW ANALYSIS — Detailed reports + sub-scores
# ──────────────────────────────────────────────────────────────


def _extract_json_from_text(text: str) -> dict:
    """Safely attempt to extract JSON from model output with ReDoS protection."""
    if not text or not isinstance(text, str):
        return {}

    # Bound input length to protect against ReDoS / memory exhaustion
    bounded_text = text[:100000].strip()

    # 1. Try direct parse first
    try:
        return json.loads(bounded_text)
    except json.JSONDecodeError:
        pass

    # 2. Try to find JSON block inside markdown code fences
    fence_match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", bounded_text)
    if fence_match:
        candidate = fence_match.group(1).strip()
        try:
            return json.loads(candidate)
        except json.JSONDecodeError:
            pass

    # 3. Safe index-based brace slice extraction (O(N) search with zero regex backtracking risk)
    first_brace = bounded_text.find("{")
    last_brace = bounded_text.rfind("}")
    if first_brace != -1 and last_brace > first_brace:
        candidate = bounded_text[first_brace:last_brace + 1].strip()
        try:
            return json.loads(candidate)
        except json.JSONDecodeError:
            pass

    return {}


def _extract_qa_pairs_from_history(conversation_history: list) -> list:
    """Extract all interviewer questions and candidate responses from conversation history."""
    qa_pairs = []
    if not conversation_history or not isinstance(conversation_history, list):
        return qa_pairs

    for i, msg in enumerate(conversation_history):
        if not isinstance(msg, dict):
            continue
        if msg.get("role") == "model":
            q_text = msg.get("text", "").strip()
            if not q_text:
                continue

            # Skip pure closing messages with no actual question
            is_pure_closing = (
                "interview is complete" in q_text.lower() or 
                "concludes our" in q_text.lower() or 
                "conclude our" in q_text.lower()
            ) and "?" not in q_text
            if is_pure_closing:
                continue

            # Look forward for candidate's answer
            a_text = ""
            for j in range(i + 1, len(conversation_history)):
                next_msg = conversation_history[j]
                if isinstance(next_msg, dict):
                    if next_msg.get("role") == "user":
                        user_text = next_msg.get("text", "").strip()
                        if next_msg.get("code"):
                            user_text += f"\n[Code Submitted]:\n{next_msg.get('code')}"
                        a_text = user_text
                        break
                    elif next_msg.get("role") == "model":
                        break

            qa_pairs.append({
                "question": q_text,
                "answer": a_text if a_text else "(No verbal response recorded)",
            })

    return qa_pairs


def _build_mock_analysis(conversation_history: list, eye_contact: float, gesture: float, voice: float, filler_count: int, interview_type: str = "technical") -> dict:
    """Generate a mock analysis result when the LLM is unavailable, guaranteeing all questions are present."""
    qa_pairs = _extract_qa_pairs_from_history(conversation_history)
    questions = []
    for pair in qa_pairs:
        has_ans = len(pair["answer"]) > 30 and pair["answer"] != "(No verbal response recorded)"
        questions.append({
            "question": pair["question"],
            "answer": pair["answer"],
            "verdict": "good" if has_ans else "needs_improvement",
            "feedback": "Your answer covered the key points." if has_ans else "Try to provide more technical depth and specific examples in your answer.",
            "suggested_answer": None if has_ans else "A strong answer should define the concept clearly, give a concrete example, and address trade-offs."
        })

    # Calculate sub-scores from raw metrics
    filler_score = max(0, min(100, 100 - filler_count * 3))
    fluency_score = round((voice * 0.6 + filler_score * 0.4), 1)

    result = {
        "technical_feedback": questions,
        "non_technical_feedback": {
            "eye_contact": {
                "score": round(eye_contact, 1),
                "feedback": "Good eye contact maintained throughout." if eye_contact > 60 else "Try to maintain more consistent eye contact with the camera."
            },
            "gestures": {
                "score": round(gesture, 1),
                "feedback": "Appropriate use of hand gestures." if gesture > 30 else "Consider using more natural hand gestures to emphasize key points."
            },
            "fluency": {
                "score": round(fluency_score, 1),
                "feedback": "Speech was generally fluent." if fluency_score > 60 else "Work on reducing pauses and speaking more smoothly."
            },
            "filler_words": {
                "score": round(filler_score, 1),
                "count": filler_count,
                "feedback": f"Used {filler_count} filler words." + (" Great control!" if filler_count < 5 else " Try to reduce filler words like 'um', 'uh', 'like'.")
            },
            "voice_stability": {
                "score": round(voice, 1),
                "feedback": "Voice was stable and confident." if voice > 60 else "Try to maintain a more consistent speaking pace and volume."
            }
        },
        "sub_scores": {
            "eye_contact_score": round(eye_contact, 1),
            "technical_knowledge_score": 65.0,
            "fluency_score": round(fluency_score, 1),
            "use_of_words_score": 60.0,
            "filler_words_score": round(filler_score, 1),
            "explanation_quality_score": 60.0
        },
        "short_summary_feedback": f"Overall, a decent interview performance. Your eye contact was {'strong' if eye_contact > 60 else 'an area to work on'}, and you used {filler_count} filler words. Keep practicing to improve your delivery and technical depth."
    }

    # Add coding scores for DSA/technical rounds
    if interview_type in ("dsa", "technical"):
        result["sub_scores"]["code_quality_score"] = 60.0
        result["sub_scores"]["optimization_score"] = 55.0
        result["sub_scores"]["thinking_process_score"] = 60.0
        result["sub_scores"]["communication_score"] = 65.0

    return result


def analyze_interview_with_llm(
    role: str,
    company_name: str,
    conversation_history: list,
    eye_contact: float,
    gesture: float,
    voice: float,
    filler_count: int,
    interview_type: str = "technical",
    dsa_code: str = "",
    dsa_question_details: str = "",
) -> dict:
    """
    Send the full interview transcript to Gemini for detailed analysis.
    Guarantees every single question asked during the interview is evaluated.
    """
    api_key = os.environ.get("GEMINI_API_KEY")
    qa_pairs = _extract_qa_pairs_from_history(conversation_history)

    if not api_key:
        print("[LLM ANALYSIS] No API key. Using mock analysis.")
        return _build_mock_analysis(conversation_history, eye_contact, gesture, voice, filler_count, interview_type)

    try:
        # Build numbered Q&A block for LLM prompt
        qa_formatted = []
        for idx, q_item in enumerate(qa_pairs):
            qa_formatted.append(f"QUESTION {idx + 1}:\n{q_item['question']}\n\nCANDIDATE ANSWER {idx + 1}:\n{q_item['answer']}")
        qa_text = "\n\n-------------------------\n\n".join(qa_formatted) if qa_formatted else "No questions recorded."
        total_questions = len(qa_pairs)

        company_part = f" at {company_name}" if company_name else ""
        round_label = {
            "technical": "Technical Interview",
            "hr": "HR Round",
            "dsa": "DSA Coding Round",
            "behavioural": "Behavioural Interview",
            "negotiation": "Salary Negotiation Simulation",
        }.get(interview_type, "Interview")

        # Build code analysis section if applicable
        code_analysis_section = ""
        if interview_type in ("dsa", "technical") and dsa_code:
            code_analysis_section = f"""
CANDIDATE'S CODE SUBMISSIONS:
{dsa_code}

DSA QUESTION DETAILS:
{dsa_question_details}

ADDITIONAL CODING ANALYSIS REQUIRED:
In addition to the standard analysis, evaluate the candidate's code and produce these extra scores in "sub_scores":
- "code_quality_score" (0-100): Code readability, naming, structure, edge case handling.
- "optimization_score" (0-100): Time and space complexity, efficiency of approach.
- "thinking_process_score" (0-100): How well the candidate articulated their thought process while solving (based on transcript).
- "communication_score" (0-100): How clearly the candidate explained their code and reasoning.

Also add a "coding_feedback" key to the result with:
- "code_review": A detailed paragraph reviewing the submitted code (strengths and weaknesses).
- "time_complexity": The time complexity of their solution (e.g., "O(n)").
- "space_complexity": The space complexity of their solution (e.g., "O(n)").
- "optimization_suggestions": Specific suggestions to improve the code.
"""

        prompt = f"""You are an expert interview coach analyzing a mock {round_label} for the role of '{role}'{company_part}.

Below is the complete list of ALL {total_questions} questions asked by the interviewer and the candidate's answers:

{qa_text}

PERFORMANCE METRICS:
- Eye Contact: {eye_contact:.1f}%
- Gesture Activity: {gesture:.1f}%
- Voice Stability: {voice:.1f}%
- Filler Word Count: {filler_count}
{code_analysis_section}

TASK: Produce a comprehensive analysis in **valid JSON** format with exactly these top-level keys:

1. "technical_feedback" — An array of EXACTLY {total_questions} objects, corresponding ONE-BY-ONE to the {total_questions} questions above in the exact same order.
   CRITICAL REQUIREMENT: You MUST evaluate EVERY SINGLE QUESTION (Q1 through Q{total_questions}). DO NOT OMIT, TRUNCATE, OR SKIP ANY QUESTION.
   Each object must have:
   - "question": the exact question text
   - "answer": the candidate's answer text
   - "verdict": "good" if the answer is technically accurate and complete, or "needs_improvement"
   - "feedback": a concise, specific critique (1-3 sentences). If "good", highlight what was strong. If "needs_improvement", explain missing aspects.
   - "suggested_answer": null if verdict is "good", otherwise a concise model answer (2-4 sentences).

2. "non_technical_feedback" — An object with these keys:
   - "eye_contact": {{ "score": <0-100>, "feedback": "<1-2 sentences>" }}
   - "gestures": {{ "score": <0-100>, "feedback": "<1-2 sentences>" }}
   - "fluency": {{ "score": <0-100>, "feedback": "<1-2 sentences>" }}
   - "filler_words": {{ "score": <0-100>, "count": {filler_count}, "feedback": "<1-2 sentences>" }}
   - "voice_stability": {{ "score": <0-100>, "feedback": "<1-2 sentences>" }}

3. "sub_scores" — An object with exactly these keys (all 0-100 floats):
   - "eye_contact_score"
   - "technical_knowledge_score"
   - "fluency_score"
   - "use_of_words_score"
   - "filler_words_score"
   - "explanation_quality_score"
   {('- "code_quality_score"' + chr(10) + '   - "optimization_score"' + chr(10) + '   - "thinking_process_score"' + chr(10) + '   - "communication_score"') if interview_type in ("dsa", "technical") and dsa_code else ""}

4. "short_summary_feedback" — A single string (3-5 sentences) summarizing the overall interview performance conversationally for text-to-speech.

{"5. " + '"coding_feedback" — An object with: "code_review" (string), "time_complexity" (string), "space_complexity" (string), "optimization_suggestions" (string).' if interview_type in ("dsa", "technical") and dsa_code else ""}

IMPORTANT: Return ONLY valid JSON. No markdown fences, no explanation."""

        raw = _call_gemini_with_fallback(
            models=["gemini-3.5-flash", "gemini-2.5-flash", "gemini-3.5-flash-lite"],
            prompt=prompt,
            timeout=30.0
        )

        result = _extract_json_from_text(raw)

        # Validate essential keys
        required_keys = {"technical_feedback", "non_technical_feedback", "sub_scores", "short_summary_feedback"}
        if not required_keys.issubset(result.keys()):
            print(f"[LLM ANALYSIS] Missing keys in response. Got: {list(result.keys())}")
            return _build_mock_analysis(conversation_history, eye_contact, gesture, voice, filler_count, interview_type)

        # ── GUARANTEE 100% OF ALL QUESTIONS ARE PRESENT IN TECHNICAL FEEDBACK ──
        llm_feedback = result.get("technical_feedback", [])
        if not isinstance(llm_feedback, list):
            llm_feedback = []

        final_feedback = []
        for idx, raw_q in enumerate(qa_pairs):
            matched_item = None
            if idx < len(llm_feedback) and isinstance(llm_feedback[idx], dict):
                matched_item = llm_feedback[idx]

            if not matched_item:
                # Try finding match by question text prefix
                q_snippet = raw_q["question"].lower()[:40]
                for item in llm_feedback:
                    if isinstance(item, dict) and q_snippet in item.get("question", "").lower():
                        matched_item = item
                        break

            if matched_item:
                final_feedback.append({
                    "question": raw_q["question"],
                    "answer": matched_item.get("answer") or raw_q["answer"],
                    "verdict": matched_item.get("verdict", "needs_improvement" if len(raw_q["answer"]) < 30 else "good"),
                    "feedback": matched_item.get("feedback", "Good explanation covering the fundamental concepts."),
                    "suggested_answer": matched_item.get("suggested_answer") if matched_item.get("verdict") == "needs_improvement" else None
                })
            else:
                has_ans = len(raw_q["answer"]) > 40 and raw_q["answer"] != "(No verbal response recorded)"
                verdict = "good" if has_ans else "needs_improvement"
                feedback = (
                    "Candidate provided a clear and relevant explanation addressing the question."
                    if verdict == "good" else
                    "The answer was brief or lacked technical depth. Focus on providing concrete examples, architectural details, and practical implementation trade-offs."
                )
                suggested = (
                    None if verdict == "good" else
                    f"A comprehensive answer for a {role} role should clearly explain the foundational mechanism, outline best practices, and mention edge cases or performance considerations."
                )
                final_feedback.append({
                    "question": raw_q["question"],
                    "answer": raw_q["answer"],
                    "verdict": verdict,
                    "feedback": feedback,
                    "suggested_answer": suggested
                })

        result["technical_feedback"] = final_feedback
        return result

    except Exception as e:
        print(f"[LLM ANALYSIS ERROR] {e}. Using mock analysis.")
        return _build_mock_analysis(conversation_history, eye_contact, gesture, voice, filler_count, interview_type)


def evaluate_code_with_llm(code: str, language: str, question_number: int, question_title: str, description: str) -> dict:
    """
    Simulate running the candidate's code against the LeetCode question using Gemini.
    """
    api_key = os.environ.get("GEMINI_API_KEY")

    if not api_key:
        print("[LLM RUN] No API key. Returning mock evaluation.")
        return {
            "status": "success",
            "results": [
                {
                    "input": "Standard Examples",
                    "expected": "Success",
                    "actual": "Success",
                    "passed": True
                }
            ],
            "stdout": "Program executed successfully in mock mode. (Add GEMINI_API_KEY for live compiling)"
        }

    try:
        prompt = f"""You are a strict compiler and execution sandbox evaluating a user's code for a LeetCode problem.

PROBLEM DETAILS:
- Number: {question_number}
- Title: {question_title}
- Description: {description}

CANDIDATE CODE DETAILS:
- Language: {language}
- Code:
```
{code}
```

TASK:
1. Parse the candidate's code. If there are syntax errors, missing parenthesis, wrong indentation, or basic compile errors for '{language}', report "compile_error" and specify the compiler error message.
2. If the code compiles, simulate its execution against the standard example test cases defined in the description (or any appropriate test cases for LeetCode {question_number} - '{question_title}').
3. Produce a structured JSON report with these exact keys:
   - "status": "success" (if all example test cases pass), "failed" (if compile succeeds but test cases fail), or "compile_error" (if compilation fails).
   - "compile_message": a string describing the compiler error (or null if success/failed).
   - "results": an array of objects representing test case results. Each object must have:
     - "input": string representing test case input
     - "expected": string representing expected output
     - "actual": string representing candidate code's simulated output
     - "passed": boolean (true if output matches expected)
   - "stdout": string representing any simulated output logs or standard output generated during execution.

IMPORTANT: Return ONLY valid JSON. No markdown wrappers, no explanations, no text before or after the JSON."""

        raw = _call_gemini_with_fallback(
            models=["gemini-3.5-flash-lite", "gemini-2.5-flash"],
            prompt=prompt,
            timeout=15.0
        )

        result = _extract_json_from_text(raw)
        
        if "status" in result:
            return result
            
        return {
            "status": "compile_error",
            "compile_message": "Failed to parse compiler response.",
            "results": [],
            "stdout": ""
        }

    except Exception as e:
        print(f"[LLM RUN ERROR] {e}")
        return {
            "status": "compile_error",
            "compile_message": f"Execution failed: {str(e)}",
            "results": [],
            "stdout": ""
        }

