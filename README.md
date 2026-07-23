# Confidometer 📊🤖

An advanced, AI-powered mock interview preparation platform designed to help candidates master both their technical and non-verbal communication skills. By combining real-time conversation models, computer vision, speech transcription, and peer-to-peer video rooms, **Confidometer** simulates real-world hiring environments and delivers thorough, multi-dimensional feedback.

---

## 🌟 Key Features

### 1. Multi-Format Interview Practice
- **Technical Round**: Resume-based technical questions guided by **Liza**, the AI interviewer, tailored to the target role, company, and experience level.
- **HR Round**: Warm, conversational HR interview covering motivation, teamwork, culture fit, salary expectations, and career goals.
- **Behavioural Round**: STAR-method situational and leadership questions with deep follow-up probing (e.g., *"What was the result?"*, *"What would you do differently?"*).
- **DSA Coding Round (Live Coding)**: A LeetCode-style side-by-side workspace featuring:
  - **1 Easy + 1 Medium Question**: Dynamically generated based on the target company (e.g., tougher questions for Google vs. standard for other companies).
  - **Interactive Monaco Editor**: Multi-language support (Python, JavaScript, C++, Java) with tabbed multi-question navigation so candidates can switch between tasks without losing draft code.
  - **Draggable Split Resizer**: A fluid divider allowing dynamic width adjustments between the problem description and code panel.
  - **AI-Powered "Run Code" Drawer**: Submit and compile code against AI-validated test suites via an AI-driven sandbox execution console.
  - **30-Minute Countdown Timer**: Auto-concludes the round when time expires.
- **Salary & Offer Negotiation Simulator** 💰: Practice negotiating salary, equity, and sign-on bonuses with Liza acting as a recruiter. She presents a realistic initial offer, pushes back on counter-offers using real-world recruiter tactics, and concludes with a final agreed package summary.

### 2. Stress Interview Mode ⚡
- Optional **Stress Mode** toggle available across Technical, HR, and Behavioural rounds.
- Liza interrupts the candidate mid-explanation ~20% of the time with sharp, challenging follow-ups to test composure.
- Additional stress-specific telemetry captured: **Fidgeting Index**, **Speech Pace Variance**, and **Stress Composure Score**.

### 3. Peer-to-Peer Mock Interviews 👥
- **WebRTC-Powered Video Rooms**: Real-time peer-to-peer video/audio interview sessions using WebRTC with STUN/ICE connectivity.
- **Match Lobby & Scheduling System**: Post interview requests with your target role, company, resume, and optional job description. Other users browse and accept requests instantly or schedule them for a future time.
- **Role Assignment**: One peer is the **Interviewer**, the other is the **Interviewee**. The interviewer receives the candidate's details, resume download link, and AI-generated questions.
- **AI-Guided Questions**: The interviewer gets dynamically generated, context-aware questions with a "Generate Follow-up Question" button. Questions adapt based on the candidate's resume, target role, and live transcription.
- **Live Speech-to-Text Transcription**: Interviewee audio is streamed in real-time to the server for Whisper-based transcription, displayed live to both peers.
- **Warmup → Interview → Feedback Phases**: Structured session flow with natural warmup conversation before transitioning to formal AI-assisted questions, ending with a mutual verbal feedback discussion.
- **Auto-Upload & Diagnostics**: Interviewee's webcam recording is auto-uploaded at session end for background computer vision and speech analysis (eye contact, gesture, fluency diagnostics).
- **Custom DateTimePicker**: iOS/Android-style scrollable wheel picker for scheduling peer interviews with hour, minute, and AM/PM selection.
- **Request Management**: View, accept, delete, and track status of meeting requests with real-time polling for instant match detection.

### 4. Speak Practice Mode 🎙️
- **Standalone Speaking Gym**: A dedicated practice mode for building verbal fluency without a full interview — perfect for quick warm-ups.
- **Slot Machine Topic Spinner**: An animated, interactive slot machine with a pullable lever that spins through topics with mechanical click sounds and a game-show "ta-da" chime on reveal.
- **11 Topic Categories**: General, Tech, Finance, Roast A Popular Thing, One-Minute Pitch, Defend The Worst Take, Explain It Like You're 5, Conspiracy Corner, Hot Takes, Millennial — each with Easy, Medium, and Hard difficulty tiers.
- **Configurable Settings**: Language accent (US EN, UK EN, IN EN), difficulty level, category selection via custom dropdown menus.
- **Live Webcam Preview**: Record yourself with real-time video feed and Web Audio API waveform visualization.
- **Countdown Timer**: Configurable speaking timer with play/pause controls and automatic recording stop.
- **Synthesized Sound Effects**: All audio feedback (click, chime, start signal) is generated dynamically using the Web Audio API — no external audio files needed.

### 5. Intelligent Behavioral & Speech Analysis
- **Eye Contact Tracking**: Utilizes Google MediaPipe's Face Landmarker model to analyze gaze directions and score how effectively the candidate maintains eye contact.
- **Gesture & Posture Analysis**: Utilizes MediaPipe Pose Landmarker models to monitor hand gestures, fidgeting, and overall body language.
- **Fluency & Filler Word Detection**: Transcribes candidate voice responses using OpenAI Whisper, analyzing speaking speed, pause durations, and counting filler phrases (e.g., *um, uh, like, you know*).
- **Smart Self-Correcting Transcription**: Custom `SmartTranscriber` engine that maintains a rolling history of transcribed segments, detects repeated/misheard phrases using phonetic similarity matching (SequenceMatcher) and Whisper confidence scores, and automatically corrects earlier segments when higher-confidence alternatives arrive.
- **Speech Synthesis**: Responsive real-time audio generation powered by Edge TTS (`en-US-JennyNeural`) for life-like AI interviewer interaction, with an LRU cache to avoid redundant synthesis.
- **Indian Number TTS Formatting**: Automatic conversion of Indian-style numbers (Lakhs, Crores) and comma-grouped formats into natural speech text for the TTS engine.

### 6. Analytics Dashboard
- **TTS-Powered Verbal Feedback**: Before unlocking the dashboard, Liza speaks a personalized summary of your performance — with a skip option if you prefer to jump straight to scores.
- **Overall Confidence Gauge**: Animated radial gauge chart with a 0–100 confidence score.
- **Multi-Dimensional Sub-Scores**: Eye Contact, Technical Knowledge, Fluency, Use of Words, Filler Words, Explanation Quality — plus context-specific scores:
  - **Negotiation Score** (for negotiation rounds)
  - **Stress Composure** (when stress mode is active)
  - **Code Quality, Optimization, Thinking Process, Communication** (for DSA/coding rounds)
- **Tabbed Report Panels**: Switch between Technical Report (Q-by-Q accordion with verdict, your answer, AI feedback, and suggested answers), Non-Technical Report (body language & fluency bars), and Coding Review (code quality scores, time/space complexity badges, optimization suggestions, and your submitted code).
- **Progress Over Time**: Multi-line Recharts graph tracking Confidence, Eye Contact, Fluency, Technical, and Filler Control scores across your last 20 sessions.
- **Framer Motion Animations**: Smooth entrance animations, animated score bars, and tab transitions powered by Framer Motion.

### 7. Gamification & Trends System 🏆
- **Daily Streak Tracking**: Consecutive daily practice streaks tracked server-side, with automatic reset on missed days.
- **10 Achievement Badges**: Unlockable badges based on milestones:
  - 🎯 First Steps (1st interview) · 🔥 Warming Up (5) · 🏆 Interview Veteran (10)
  - 👁️ Eye Contact Master (80%+) · 🗣️ Fluent Speaker (80%+) · 👑 Confidence King (85%+)
  - ⚡ 3-Day Streak · 💎 Week Warrior (7-day streak)
  - 🌟 All-Rounder (all 4 interview types) · 💰 Master Negotiator (negotiation round)
- **Trends API**: Historical performance data (last 20 sessions), interview type breakdown, and badge progress — all served from a dedicated `/trends/` endpoint.

### 8. Smart Autocomplete Inputs
- **Role Suggestions**: 50+ curated role titles across Software Engineering, Data/AI, Product, Design, Finance, Consulting, and more — with fuzzy-match autocomplete.
- **Company Suggestions**: 90+ companies including Big Tech (Google, Meta, Amazon), Indian IT (Infosys, TCS, Wipro), startups (CRED, Zerodha, Meesho), and global firms (McKinsey, Goldman Sachs).
- **Keyboard Navigation**: Full arrow-key navigation, Enter to select, and Escape to dismiss the suggestions dropdown.

### 9. Authentication & Session Management
- **JWT-Based Auth**: Secure user registration and login with hashed passwords and Bearer token authentication.
- **Auto-Redirect**: Unauthorized API calls automatically clear the session and redirect to login with a `?next=` return URL.
- **Protected Routes**: All interview, upload, dashboard, peer, and trends routes require authentication.

### 10. Interactive UX Refinements
- **Scroll-Hide Navbar**: The top header hides automatically on scroll-down to save screen space, sliding back into view on scroll-up/return-to-top.
- **Active Focus Layout**: Once an interview starts, the navbar is hidden completely, and the workspace scales to full-width (`98vw`) to focus entirely on the session.
- **Glassmorphism Dark Theme**: Premium dark mode with frosted-glass cards, vibrant gradients, and subtle transparency effects throughout the UI.

---

## 🛠️ Technology Stack

### Frontend
- **Framework**: Next.js 14 (App Router, React)
- **Styling**: Vanilla CSS (Premium Glassmorphism & High-Density Dark Mode)
- **Code Editor**: Monaco Editor (Next.js wrappers) with multi-language support
- **Charts**: Recharts (Line charts for progress tracking), custom Gauge & Bar chart components
- **Animations**: Framer Motion (page transitions, animated score bars, reveal effects)
- **Real-Time**: WebRTC (peer video/audio), WebSocket (live STT, peer signaling)
- **Icons**: Lucide React

### Backend
- **Framework**: FastAPI (Python 3.13)
- **Database**: SQLAlchemy ORM with automatic migration scripts (PostgreSQL for both development and deployment)
- **Speech-to-Text**: OpenAI Whisper (`small` model for post-interview reports, `medium` model for live conversational STT) with custom `SmartTranscriber` self-correction engine
- **Computer Vision**: Google MediaPipe (Face & Pose Landmarker task architectures) & OpenCV
- **Audio Extraction**: MoviePy & FFmpeg CLI integrations
- **AI Core**: Google Gemini LLM API (dynamic dialogue generation, interview question generation, code validation, and per-question technical feedback with suggested answers)
- **TTS Core**: Microsoft Edge TTS (`en-US-JennyNeural`) with LRU caching and Indian number formatting
- **Resume Parsing**: Multi-format resume text extraction (PDF, DOCX)
- **WebSocket Services**: Real-time STT streaming, peer-to-peer signaling server with room management

### DevOps & Deployment
- **Docker Compose**: Full containerized stack with PostgreSQL, FastAPI backend, Next.js frontend, and Nginx reverse proxy
- **Nginx**: Reverse proxy with WebSocket support and 100MB upload size limit
- **Environment Configuration**: `.env`-based secrets management for API keys and database URLs

---

## 🚀 Getting Started

### Prerequisites
- Python 3.13+
- Node.js 18+

### Backend Setup
1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Create and activate a Python virtual environment:
   ```bash
   python -m venv venv
   # On Windows:
   .\venv\Scripts\activate
   # On macOS/Linux:
   source venv/bin/activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Create a `.env` file inside the `backend` folder:
   ```env
   GEMINI_API_KEY=your_gemini_api_key_here
   SECRET_KEY=your_jwt_secret_key_here
   ```
5. Pre-download task models:
   ```bash
   python -m app.utils.download_models
   ```
6. Run the FastAPI development server:
   ```bash
   uvicorn app.main:app --reload
   ```

### Frontend Setup
1. Navigate to the frontend directory:
   ```bash
   cd ../frontend
   ```
2. Install npm packages:
   ```bash
   npm install
   ```
3. Launch the Next.js development server:
   ```bash
   npm run dev
   ```
4. Access the web app at `http://localhost:3000`.

### Docker Deployment (Production)
1. Set your Gemini API key:
   ```bash
   export GEMINI_API_KEY=your_gemini_api_key_here
   ```
2. Build and start all services:
   ```bash
   docker-compose up --build -d
   ```
3. Access the app at `http://localhost` (Nginx proxies to frontend and backend).

---

## 📂 Project Structure

```
Confidometer/
├── backend/
│   ├── app/
│   │   ├── models/           # SQLAlchemy models (User, Speech, PeerInterviewRequest)
│   │   ├── resources/        # Face/Pose Landmarker models
│   │   ├── routes/           # FastAPI endpoints
│   │   │   ├── auth.py       # JWT registration & login
│   │   │   ├── upload.py     # Video upload & processing
│   │   │   ├── analysis.py   # Speech analysis results & history
│   │   │   ├── agent.py      # AI interview agent, TTS, DSA code runner, STT WebSocket
│   │   │   ├── meeting.py    # Peer-to-peer lobby, match, WebSocket signaling
│   │   │   └── trends.py     # Gamification streaks, badges, historical trends
│   │   ├── services/         # Core processing engines
│   │   │   ├── llm.py        # Gemini LLM interview question generation (5 interview types + peer mode)
│   │   │   ├── stt.py        # Smart self-correcting Whisper transcriber
│   │   │   ├── eye.py        # Eye contact scoring via MediaPipe Face Landmarker
│   │   │   ├── gesture.py    # Gesture & posture analysis via MediaPipe Pose Landmarker
│   │   │   ├── filler.py     # Filler word detection & fluency scoring
│   │   │   ├── voice.py      # Voice stability analysis
│   │   │   ├── scoring.py    # Composite confidence score calculation
│   │   │   └── processor.py  # Async pipeline orchestrator for all analysis services
│   │   ├── schema/           # Pydantic response schemas
│   │   └── utils/            # Audio/video processing, resume parsing, security
│   ├── main.py               # Application entrypoint & automatic DB migrations
│   └── requirements.txt      # Python requirements
├── frontend/
│   ├── app/
│   │   ├── page.js           # Landing page with hero section
│   │   ├── login/            # Login page
│   │   ├── register/         # Registration page
│   │   ├── upload/           # AI Interview setup & live interview workspace (all 5 types)
│   │   ├── speak/            # Standalone speaking practice gym with slot machine topic spinner
│   │   ├── peer/             # Peer-to-peer interview lobby, scheduling, and WebRTC room
│   │   ├── processing/       # Post-interview analysis progress page
│   │   ├── dashboard/        # Full analytics dashboard with charts & reports
│   │   └── history/          # Recent sessions list
│   ├── components/
│   │   ├── Navbar.js         # Scroll-hide navigation bar
│   │   ├── PeerRoom.js       # WebRTC peer interview room component
│   │   ├── AutocompleteInput.js  # Fuzzy-match autocomplete (roles & companies)
│   │   ├── DateTimePicker.js # iOS-style scrollable wheel date/time picker
│   │   ├── GaugeChart.js     # Radial gauge chart for confidence scores
│   │   ├── BarChart.js       # Bar chart component
│   │   ├── MetricCard.js     # Metric display card
│   │   └── Loader.js         # Loading spinner
│   ├── utils/
│   │   ├── api.js            # API client (REST + WebSocket helpers)
│   │   └── auth.js           # JWT token & session management
│   ├── styles/               # Global and layout CSS
│   └── package.json          # React dependencies
├── nginx/
│   └── nginx.conf            # Reverse proxy configuration
├── docker-compose.yml        # Full-stack container orchestration
└── README.md
```

---

## 📄 License

This project is for educational and portfolio demonstration purposes.