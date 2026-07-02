import os
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


def generate_interview_question(resume_text: str, role: str, conversation_history: list, user_name: str = "Anshu", company_name: str = "", experience_level: str = "", job_description: str = "") -> str:
    """
    resume_text: text extracted from PDF/TXT
    role: string representing target job role
    conversation_history: list of dicts with {"role": "user"|"model", "text": "..."}
    user_name: string representing name of candidate
    company_name: optional target company
    experience_level: optional experience level (e.g. "Fresher", "3 years")
    job_description: optional job description text
    """
    role_lower = role.lower() if role else ""
    api_key = os.environ.get("GEMINI_API_KEY")

    # Short-circuit greeting (Turn 1) to avoid API call latency and save quota
    if not conversation_history:
        greeting_role = role if role else "specified"
        company_part = f" at {company_name}" if company_name else ""
        return f"Hello {user_name}! I'm Liza, your interview agent. I will be conducting your technical interview today for the {greeting_role} position{company_part}. How are you and how are you feeling today?"


    def get_mock_response(history, key_role_lower, name, current_role):
        # 1. Count how many of the user turns were NOT questions/clarification requests
        answered_turns = 0
        for msg in history:
            if msg.get("role") == "user":
                if not is_user_asking_question(msg.get("text", "")):
                    answered_turns += 1

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

            user_text_lower = last_msg.get("text", "").lower()
            if "role" in user_text_lower or "position" in user_text_lower or "job" in user_text_lower:
                answer = f"You are interviewing for the '{current_role}' position."
            elif "resume" in user_text_lower or "experience" in user_text_lower:
                answer = "I am evaluating your experience based on the resume you uploaded."
            elif "who" in user_text_lower or "name" in user_text_lower:
                answer = f"According to your resume, your name is {name}."
            else:
                answer = "Understood. Let me clarify."

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

        mock_key = "software engineer" if "engineer" in key_role_lower or "developer" in key_role_lower else "default"
        q_list = MOCK_QUESTIONS[mock_key]
        
        mock_index = answered_turns - 3
        if mock_index < len(q_list):
            return q_list[mock_index]
        return f"Thank you for taking the time to speak with me today, {name}. The interview is complete."

    # 1. Fallback to mock if API key is not present
    if not api_key:
        print("[LLM INFO] No GEMINI_API_KEY found. Falling back to rule-based questions.")
        return get_mock_response(conversation_history, role_lower, user_name, role)

    # 2. Use Gemini API
    try:
        # Build context sections
        company_context = f"The target company is '{company_name}'.\n" if company_name else ""
        experience_context = f"The candidate has {experience_level} of experience.\n" if experience_level else ""
        jd_context = f"\nJob Description provided by the candidate:\n{job_description}\n" if job_description else ""

        # Format history for GenAI chat
        system_instruction = (
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

        model = genai.GenerativeModel(
            model_name="gemini-2.5-flash",
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
            contents.append({
                "role": g_role,
                "parts": [msg.get("text", "")]
            })

        response = model.generate_content(contents)
        return response.text.strip()
    except Exception as e:
        print(f"[LLM ERROR] Gemini API call failed: {e}. Falling back to mock questions.")
        return get_mock_response(conversation_history, role_lower, user_name, role)
