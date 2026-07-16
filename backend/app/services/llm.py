import os
import json
import re
import google.generativeai as genai
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Try to configure Gemini API
gemini_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GEMINI_API")
if gemini_key:
    genai.configure(api_key=gemini_key)

# A comprehensive list of mock interview questions to use as a fallback if no API key is provided
MOCK_QUESTIONS = {
    "software engineer": [
        "Welcome to your interview. To start off, could you tell me about your most challenging coding project?",
        "That's interesting. How do you handle database optimization and indexing in your projects?",
        "Could you explain the difference between a SQL and NoSQL database, and when you would choose one over the other?",
        "How do you approach debugging a memory leak or CPU spike in a production environment?",
        "Thank you for sharing. That concludes our technical questions. Do you have any questions for me?"
    ],
    "default": [
        "Welcome to your interview. Can you please tell me about a project from your resume that you are most proud of?",
        "What motivated you to apply for this specific role, and what skills do you bring?",
        "How do you handle conflict or differing opinions within a team setting?",
        "Describe a time when you had to meet a tight deadline under stress. How did you manage it?",
        "Thank you. That covers my questions. Do you have any questions for the interviewer?"
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
# INTERVIEW-TYPE SPECIFIC SYSTEM PROMPTS
# ──────────────────────────────────────────────────────────────

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


def _build_system_prompt_technical(user_name, role, company_name, experience_level, resume_text, job_description, stress_mode=False):
    company_context = f"The target company is '{company_name}'.\n" if company_name else ""
    experience_context = f"The candidate has {experience_level} of experience.\n" if experience_level else ""
    jd_context = f"\nJob Description provided by the candidate:\n{job_description}\n" if job_description else ""

    prompt = (
        f"You are a professional, polite, and concise technical interviewer named 'Liza' interviewing a candidate named '{user_name}' for the position of '{role}'.\n"
        f"{company_context}"
        f"{experience_context}"
        f"Here is the candidate's resume:\n{resume_text}\n"
        f"{jd_context}\n"
        "INSTRUCTIONS & FLOW:\n"
        "1. You must guide the candidate through the interview starting from the greeting. Do not skip any steps.\n"
        "2. In your very first turn, introduce yourself as Liza, the interview agent, and ask how the candidate is and how they are feeling today.\n"
        "3. Once the candidate responds, acknowledge/respond to their feelings politely and ask them if they are ready/if we can start the interview.\n"
        "4. Once they agree to start, ask them to introduce themselves or tell you about themselves.\n"
        "5. After they introduce themselves, proceed to ask technical questions based on their resume, the target role, the candidate's experience level, and the job description (if provided).\n"
        "6. Ask exactly ONE question at a time.\n"
        "7. Keep your questions relevant, clear, and very concise (no more than 2-3 sentences).\n"
        "8. Reference their resume experiences naturally when asking questions.\n"
        f"{'9. Tailor question difficulty and style to the company (' + company_name + ') interview standards. Ask questions similar to what ' + company_name + ' would ask in a real interview.' + chr(10) if company_name else ''}"
        "10. If the candidate asks a clarifying question or cross-question (e.g. asking about the role, repeating the question, or asking for clarification), politely answer or clarify their question, and then repeat/re-ask the current interview question. Do not skip to the next interview question until they have actually answered the current one.\n"
        "11. After 4-5 technical questions, politely conclude the interview."
    )

    if stress_mode:
        prompt += STRESS_MODE_APPENDIX

    return prompt


def _build_system_prompt_hr(user_name, role, company_name, experience_level, resume_text, job_description, stress_mode=False):
    company_context = f"The target company is '{company_name}'.\n" if company_name else ""
    experience_context = f"The candidate has {experience_level} of experience.\n" if experience_level else ""

    prompt = (
        f"You are a warm, professional HR interviewer named 'Liza' conducting an HR round for a candidate named '{user_name}' applying for the position of '{role}'.\n"
        f"{company_context}"
        f"{experience_context}"
        f"Here is the candidate's resume:\n{resume_text}\n"
        "\nINSTRUCTIONS & FLOW:\n"
        "1. Start with a friendly greeting, introduce yourself as Liza.\n"
        "2. Ask the candidate to briefly introduce themselves.\n"
        "3. Ask HR-focused questions: motivation, teamwork, conflict resolution, salary expectations, work culture preferences, strengths/weaknesses, career goals, etc.\n"
        "4. Keep questions conversational, empathetic, and relevant to the role and company.\n"
        "5. Ask exactly ONE question at a time. Keep responses concise (2-3 sentences).\n"
        "6. If the candidate asks questions, answer helpfully and redirect back to your question.\n"
        "7. After 4-5 HR questions, politely conclude the interview."
    )

    if stress_mode:
        prompt += STRESS_MODE_APPENDIX

    return prompt


def _build_system_prompt_behavioural(user_name, role, company_name, experience_level, resume_text, job_description, stress_mode=False):
    company_context = f"The target company is '{company_name}'.\n" if company_name else ""
    experience_context = f"The candidate has {experience_level} of experience.\n" if experience_level else ""

    prompt = (
        f"You are a sharp behavioural interviewer named 'Liza' assessing a candidate named '{user_name}' for the position of '{role}'.\n"
        f"{company_context}"
        f"{experience_context}"
        f"Here is the candidate's resume:\n{resume_text}\n"
        "\nINSTRUCTIONS & FLOW:\n"
        "1. Start with a friendly greeting, introduce yourself as Liza.\n"
        "2. Ask the candidate to briefly introduce themselves.\n"
        "3. Ask STAR-method behavioural questions: 'Tell me about a time when...', 'Describe a situation where...', 'Give me an example of...'.\n"
        "4. Focus on: leadership, problem-solving under pressure, teamwork, handling failure, adaptability, and initiative.\n"
        "5. After each answer, probe deeper with follow-ups like 'What was the result?', 'What did you learn?', 'What would you do differently?'.\n"
        "6. Ask exactly ONE question at a time. Keep responses concise.\n"
        "7. If the candidate asks questions, answer helpfully and redirect back.\n"
        "8. After 4-5 behavioural questions, politely conclude the interview."
    )

    if stress_mode:
        prompt += STRESS_MODE_APPENDIX

    return prompt


def _build_system_prompt_negotiation(user_name, role, company_name, experience_level, resume_text):
    """Build a system prompt for the Salary & Offer Negotiation Simulator."""
    company_context = f"The target company is '{company_name}'.\n" if company_name else ""
    experience_context = f"The candidate has {experience_level} of experience.\n" if experience_level else ""

    return (
        f"You are a seasoned, professional recruiter and hiring manager named 'Liza' conducting a salary negotiation simulation with a candidate named '{user_name}' for the position of '{role}'.\n"
        f"{company_context}"
        f"{experience_context}"
        f"Here is the candidate's resume:\n{resume_text}\n"
        "\nINSTRUCTIONS & FLOW:\n"
        "1. In your very first turn, introduce yourself warmly as Liza from the hiring team. Congratulate the candidate on passing the interview rounds.\n"
        "2. Present an initial compensation offer that is slightly below market rate for the role and experience level. Include base salary, equity/stock options, and sign-on bonus (if applicable).\n"
        "3. When the candidate counter-offers, push back using realistic recruiter tactics:\n"
        "   - 'That's at the very top of our band for this level.'\n"
        "   - 'Our equity package historically appreciates significantly — it more than makes up for the base difference.'\n"
        "   - 'We don't typically offer sign-on bonuses at this level, but let me see what I can do.'\n"
        "   - 'I understand your expectations. Let me share what flexibility I have...'\n"
        "4. Be open to compromise — don't always say no. If the candidate makes strong arguments (citing market data, competing offers, or unique skills), acknowledge them and adjust the offer.\n"
        "5. Keep responses concise and conversational (2-4 sentences). Ask exactly ONE question or make ONE counter per turn.\n"
        "6. After 4-5 exchanges of negotiation, conclude by either:\n"
        "   a) Accepting the candidate's proposed package with minor adjustments, OR\n"
        "   b) Presenting a final 'best and final' offer and asking if they accept.\n"
        "7. End the simulation by thanking the candidate and summarizing the final agreed package.\n"
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
        "5. You are here to simulate a real coding interview — talk naturally, respond to what they say.\n"
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


# ──────────────────────────────────────────────────────────────
# MAIN QUESTION GENERATION
# ──────────────────────────────────────────────────────────────

def generate_interview_question(
    resume_text: str, role: str, conversation_history: list,
    user_name: str = "Anshu", company_name: str = "",
    experience_level: str = "", job_description: str = "",
    interview_type: str = "technical", dsa_context: dict = None,
    is_time_up: bool = False, stress_mode: bool = False,
    is_peer: bool = False
) -> str:
    """
    Generate the next interview question based on interview type and conversation history.
    """
    role_lower = role.lower() if role else ""
    api_key = os.environ.get("GEMINI_API_KEY")

    # Short-circuit greeting (Turn 1) to avoid API call latency and save quota
    if not conversation_history and interview_type != "dsa" and not is_peer:
        greeting_role = role if role else "specified"
        company_part = f" at {company_name}" if company_name else ""
        round_label = {
            "technical": "technical interview",
            "hr": "HR round",
            "behavioural": "behavioural interview",
            "negotiation": "salary negotiation simulation",
        }.get(interview_type, "interview")
        return f"Hello {user_name}! I'm Liza, your interview agent. I will be conducting your {round_label} today for the {greeting_role} position{company_part}. How are you and how are you feeling today?"

    def get_mock_response(history, key_role_lower, name, current_role, is_time_up=False, is_peer=False):
        # 1. Count how many of the user turns were NOT questions/clarification requests
        answered_turns = 0
        for msg in history:
            if msg.get("role") == "user":
                if not is_user_asking_question(msg.get("text", "")):
                    answered_turns += 1

        # Check if time limit is reached or if questions are exhausted
        mock_key = "software engineer" if "engineer" in key_role_lower or "developer" in key_role_lower else "default"
        q_list = MOCK_QUESTIONS[mock_key]
        mock_index = answered_turns - 3

        if is_time_up or mock_index >= len(q_list):
            return f"Thank you for taking the time to speak with me today, {name}. The interview is complete."

        # 2. Check if the very last message in the history is a user question/clarification
        last_msg = history[-1] if history else None
        if last_msg and last_msg.get("role") == "user" and is_user_asking_question(last_msg.get("text", "")):
            # Find the last question asked by the model to repeat it
            last_model_question = ""
            for msg in reversed(history):
                if msg.get("role") == "model":
                    # Filter out helper comments/answers
                    if "get back to my question" not in msg.get("text", "").lower() and "shall we continue" not in msg.get("text", "").lower():
                        last_model_question = msg.get("text", "")
                        break
            
            # If no pure model question was found, just use the last model turn
            if not last_model_question:
                for msg in reversed(history):
                    if msg.get("role") == "model":
                        last_model_question = msg.get("text", "")
                        break

            # Explanations dictionary mapping keywords in model questions to simple explanations
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
        return get_mock_response(conversation_history, role_lower, user_name, role, is_time_up, is_peer=is_peer)

    # 2. Use Gemini API
    try:
        # Build system prompt based on interview type
        if interview_type == "dsa":
            system_instruction = _build_system_prompt_dsa(
                user_name, role, company_name, experience_level, resume_text, dsa_context
            )
        elif interview_type == "hr":
            system_instruction = _build_system_prompt_hr(
                user_name, role, company_name, experience_level, resume_text, job_description, stress_mode=stress_mode
            )
        elif interview_type == "behavioural":
            system_instruction = _build_system_prompt_behavioural(
                user_name, role, company_name, experience_level, resume_text, job_description, stress_mode=stress_mode
            )
        elif interview_type == "negotiation":
            system_instruction = _build_system_prompt_negotiation(
                user_name, role, company_name, experience_level, resume_text
            )
        else:
            system_instruction = _build_system_prompt_technical(
                user_name, role, company_name, experience_level, resume_text, job_description, stress_mode=stress_mode
            )

        # Dynamic adjustments to system instructions based on elapsed time
        if is_time_up:
            system_instruction += "\n\nCRITICAL INSTRUCTION: The interview time limit is up. You must politely conclude the interview in this turn. Thank the candidate, state that the interview is complete, and wish them a great day. Do NOT ask any new questions."
        else:
            # Reinforce clarifying question instructions
            system_instruction += (
                "\n\nCRITICAL REMINDER ON CLARIFICATIONS: If the candidate asks you to explain, repeat, or clarify a question, "
                "you must explain that question in simple, helpful, and warm terms rather than repeating it verbatim. "
                "Once explained, repeat/re-ask the current question so they can answer it."
            )

        if is_peer:
            system_instruction += (
                "\n\nCRITICAL PEER INTERVIEW MODE:\n"
                "You are generating questions for a HUMAN interviewer to read aloud to the candidate.\n"
                "1. Do NOT include any introductions or self-identifying statements (e.g. do NOT say 'I'm Liza', 'Welcome', or 'Hi {name}').\n"
                "2. Ask the interview question directly. The very first character should be the beginning of the question.\n"
                "3. Do not include candidate name greetings (e.g., do not say 'Anshu, welcome'). Start directly with the technical context or the question itself."
            )

        # Reinforce number formatting rules: write as numeric digits, but they will be spoken correctly via TTS
        system_instruction += (
            "\n\nCRITICAL OFFER WRITING RULE: When discussing salaries, packages, compensation, and money, "
            "you must ALWAYS write them in numeric digit representations using standard comma grouping (e.g., write '18,00,000 rupees' or '18,00,000 INR' "
            "instead of 'eighteen lakh rupees', and write '$100,000' or '100,000 USD' instead of 'one hundred thousand dollars'). "
            "Do NOT write out monetary numbers in words, but ALWAYS format them as numbers in digits so they display clean and professional "
            "on screen. The text-to-speech engine will automatically convert these numbers to natural spoken words."
        )


        model = genai.GenerativeModel(
            model_name="gemini-3.1-flash-lite",
            system_instruction=system_instruction
        )
        
        # Build contents structure
        contents = []
        
        # Prepend hidden user prompt at the very beginning of the history to trigger the greeting/intro instruction
        # and to satisfy Gemini's requirement that the conversation starts with a user turn.
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

        response = model.generate_content(contents)
        return response.text.strip()
    except Exception as e:
        print(f"[LLM ERROR] Gemini API call failed: {e}. Falling back to mock questions.")
        return get_mock_response(conversation_history, role_lower, user_name, role, is_time_up, is_peer=is_peer)


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

        model = genai.GenerativeModel(model_name="gemini-3.1-flash-lite")
        response = model.generate_content(prompt)
        raw = response.text.strip()

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


# ──────────────────────────────────────────────────────────────
# POST-INTERVIEW ANALYSIS — Detailed reports + sub-scores
# ──────────────────────────────────────────────────────────────


def _extract_json_from_text(text: str) -> dict:
    """Attempt to extract JSON from model output that may include markdown fences."""
    # Try direct parse first
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    # Try to find JSON block between ```json ... ``` or ``` ... ```
    patterns = [
        r"```json\s*([\s\S]*?)```",
        r"```\s*([\s\S]*?)```",
        r"\{[\s\S]*\}",
    ]
    for pattern in patterns:
        match = re.search(pattern, text)
        if match:
            candidate = match.group(1) if match.lastindex else match.group(0)
            try:
                return json.loads(candidate.strip())
            except json.JSONDecodeError:
                continue

    return {}


def _build_mock_analysis(conversation_history: list, eye_contact: float, gesture: float, voice: float, filler_count: int, interview_type: str = "technical") -> dict:
    """Generate a mock analysis result when the LLM is unavailable."""
    questions = []
    for i, msg in enumerate(conversation_history):
        if msg.get("role") == "model" and i + 1 < len(conversation_history):
            next_msg = conversation_history[i + 1]
            if next_msg.get("role") == "user":
                questions.append({
                    "question": msg.get("text", ""),
                    "answer": next_msg.get("text", ""),
                    "verdict": "good",
                    "feedback": "Your answer covers the key points. No changes needed.",
                    "suggested_answer": None
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
    Returns a dict with keys: technical_feedback, non_technical_feedback, sub_scores, short_summary_feedback
    """
    api_key = os.environ.get("GEMINI_API_KEY")

    if not api_key:
        print("[LLM ANALYSIS] No API key. Using mock analysis.")
        return _build_mock_analysis(conversation_history, eye_contact, gesture, voice, filler_count, interview_type)

    try:
        # Build a readable transcript
        transcript_lines = []
        for msg in conversation_history:
            speaker = "Interviewer" if msg.get("role") == "model" else "Candidate"
            line = f"{speaker}: {msg.get('text', '')}"
            if msg.get("code"):
                line += f"\n[Code Submitted]:\n```\n{msg['code']}\n```"
            transcript_lines.append(line)
        transcript_text = "\n".join(transcript_lines)

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

Below is the full interview transcript, followed by the candidate's performance metrics.

TRANSCRIPT:
{transcript_text}

PERFORMANCE METRICS:
- Eye Contact: {eye_contact:.1f}%
- Gesture Activity: {gesture:.1f}%
- Voice Stability: {voice:.1f}%
- Filler Word Count: {filler_count}
{code_analysis_section}

TASK: Produce a comprehensive analysis in **valid JSON** format with exactly these top-level keys:

1. "technical_feedback" — An array of objects, one per interviewer question. Each object must have:
   - "question": the interviewer's question text
   - "answer": the candidate's answer text
   - "verdict": "good" if no changes needed, or "needs_improvement"
   - "feedback": a short critique (1-3 sentences). If verdict is "good", say what was strong. If "needs_improvement", explain what to improve.
   - "suggested_answer": null if verdict is "good", otherwise a model answer (3-5 sentences).

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

4. "short_summary_feedback" — A single string (3-5 sentences) summarizing the overall interview performance. This will be read aloud by a TTS agent, so write it naturally and conversationally.

{"5. " + '"coding_feedback" — An object with: "code_review" (string), "time_complexity" (string), "space_complexity" (string), "optimization_suggestions" (string).' if interview_type in ("dsa", "technical") and dsa_code else ""}

IMPORTANT: Return ONLY valid JSON. No markdown, no explanation, no extra text. Just the JSON object."""

        model = genai.GenerativeModel(model_name="gemini-3.1-flash-lite")
        response = model.generate_content(prompt)
        raw = response.text.strip()

        result = _extract_json_from_text(raw)

        # Validate essential keys
        required_keys = {"technical_feedback", "non_technical_feedback", "sub_scores", "short_summary_feedback"}
        if not required_keys.issubset(result.keys()):
            print(f"[LLM ANALYSIS] Missing keys in response. Got: {list(result.keys())}")
            return _build_mock_analysis(conversation_history, eye_contact, gesture, voice, filler_count, interview_type)

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

        model = genai.GenerativeModel(model_name="gemini-3.1-flash-lite")
        response = model.generate_content(prompt)
        raw = response.text.strip()

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

