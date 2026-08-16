# Confidometer 📊🤖🚀

An advanced, AI-powered career acceleration and mock interview platform designed to help candidates land their dream jobs and master both their technical and non-verbal communication skills. Combining real-time conversation models, computer vision, speech transcription, peer-to-peer WebRTC video rooms, and an autonomous AI job application agent (**AutoApply**), **Confidometer** simulates real-world hiring environments and delivers thorough, multi-dimensional feedback.

---

## 🌟 Key Features

### 1. AutoApply — Autonomous AI Job Application Agent 🚀
- **Multi-Board Job Discovery**: Scrapes and aggregates live job postings from diverse remote and global boards (RemoteOK, Himalayas, Jobicy, Arbeitnow, Adzuna, Reed, etc.) based on your target roles, skills, and locations.
- **AI Semantic Match Engine**: Uses Google Gemini to score job descriptions against your candidate profile (0–100% Match Score), highlighting matching qualifications, missing keywords, and role fit.
- **AI Resume & Profile Extraction**: Automatically parses PDF and DOCX resumes into structured candidate profiles including experience, education, tech stack, and portfolio links.
- **Context-Aware Cover Letter Generator**: Dynamically crafts tailored, role-specific cover letters aligned with the company's culture and exact job requirements.
- **Automated Form Filler & Headless Bot**: Automates job application submission with human-like delays, anti-bot safeguards, and dynamic response generation for custom screening questions.
- **Safety Limits & Daily Scheduling**: Configurable daily application limits (e.g. 5–25/day), cool-down intervals, and scheduled application windows.
- **Interactive AutoApply Dashboard**:
  - Application funnel tracking (Queued, Applied, Under Review, Interview, Rejected, Offer).
  - Role tag input with custom priority weightings.
  - Interactive salary range slider (min/max target compensation).
  - Detailed submission history and automation audit logs.

### 2. Multi-Format Interview Practice 🎯
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

### 3. Stress Interview Mode ⚡
- Optional **Stress Mode** toggle available across Technical, HR, and Behavioural rounds.
- Liza interrupts the candidate mid-explanation ~20% of the time with sharp, challenging follow-ups to test composure.
- Additional stress-specific telemetry captured: **Fidgeting Index**, **Speech Pace Variance**, and **Stress Composure Score**.

### 4. Peer-to-Peer Mock Interviews 👥
- **WebRTC-Powered Video Rooms**: Real-time peer-to-peer video/audio interview sessions using WebRTC with STUN/ICE connectivity and buffered candidate queueing to prevent dropped handshakes.
- **Stream-Synchronized Video Elements**: Callback refs and stream synchronizers ensure local and remote video feeds attach instantly and reliably without black-screen states.
- **Dynamic Track Hotplugging**: Camera/microphone tracks attach and update live even if device permissions are granted after room entry or retried mid-session.
- **Device Permission Interceptor**: Detects camera lockouts (`NotReadableError` / `PermissionDeniedError`) and presents an interactive one-click "Enable Camera" recovery prompt.
- **Smart Mirroring & Overlays**: Mirrors the candidate's local camera while maintaining a natural unmirrored perspective for the remote peer, with custom camera-off indicators.
- **Match Lobby & Scheduling System**: Post interview requests with your target role, company, resume, and job description. Other candidates browse and accept requests instantly or schedule them for a future date/time.
- **Role Assignment**: One peer is the **Interviewer**, the other is the **Interviewee**. The interviewer receives the candidate's details, resume download link, and AI-generated questions.
- **AI-Guided Questions**: The interviewer gets dynamically generated, context-aware questions with a "Generate Follow-up Question" button that adapts based on resume text and live transcriptions.
- **Live Speech-to-Text Transcription**: Interviewee audio is streamed in real-time to the server for Whisper-based transcription, displayed live to both peers.
- **Warmup → Interview → Feedback Phases**: Structured session flow with natural warmup conversation before transitioning to formal AI-assisted questions, ending with a mutual verbal feedback discussion.
- **Auto-Upload & Diagnostics**: Interviewee's webcam recording is auto-uploaded at session end for background computer vision and speech analysis.
- **Custom DateTimePicker**: iOS/Android-style scrollable wheel picker for scheduling peer interviews with hour, minute, and AM/PM selection.

### 5. Speak Practice Mode 🎙️
- **Standalone Speaking Gym**: A dedicated practice mode for building verbal fluency without a full interview — perfect for quick warm-ups.
- **Slot Machine Topic Spinner**: An animated, interactive slot machine with a pullable lever that spins through topics with mechanical click sounds and a game-show "ta-da" chime on reveal.
- **11 Topic Categories**: General, Tech, Finance, Roast A Popular Thing, One-Minute Pitch, Defend The Worst Take, Explain It Like You're 5, Conspiracy Corner, Hot Takes, Millennial — each with Easy, Medium, and Hard difficulty tiers.
- **Configurable Settings**: Language accent (US EN, UK EN, IN EN), difficulty level, category selection via custom dropdown menus.
- **Live Webcam Preview**: Record yourself with real-time video feed and Web Audio API waveform visualization.
- **Synthesized Sound Effects**: All audio feedback (click, chime, start signal) is generated dynamically using the Web Audio API — zero external asset dependencies.

### 6. Intelligent Behavioral & Speech Analysis 🧠
- **Eye Contact Tracking**: Utilizes Google MediaPipe's Face Landmarker model to analyze gaze directions and score how effectively the candidate maintains eye contact.
- **Gesture & Posture Analysis**: Utilizes MediaPipe Pose Landmarker models to monitor hand gestures, fidgeting, and overall body language.
- **Fluency & Filler Word Detection**: Transcribes voice responses and analyzes speaking speed, pause durations, and counts filler phrases (e.g., *um, uh, like, you know*).
- **Smart Self-Correcting Transcription**: Custom `SmartTranscriber` engine that maintains a rolling history of transcribed segments, detects phonetic similarities, and automatically corrects earlier segments when higher-confidence text arrives.
- **Hybrid STT Engine (Groq LPU Cloud Acceleration + Whisper)**:
  - **Groq API Cloud STT**: Offloads inference to ultra-fast Groq LPUs (`groq.audio.transcriptions.create`), slashing backend RAM from >2GB to <200MB and accelerating transcription by 10x.
  - **Local Whisper Fallback**: Automatically falls back to local OpenAI Whisper models when running offline or without cloud API keys.
- **Speech Synthesis**: Responsive real-time audio generation powered by Edge TTS (`en-US-JennyNeural`) with LRU caching to avoid redundant synthesis.
- **Indian Number TTS Formatting**: Automatic conversion of Indian-style numbers (Lakhs, Crores) and comma-grouped formats into natural speech text.

### 7. Analytics Dashboard & Trends 📈
- **TTS-Powered Verbal Feedback**: Liza speaks a personalized executive summary of your performance before unlocking the detailed breakdown.
- **Overall Confidence Gauge**: Animated radial gauge chart with a 0–100 confidence score.
- **Multi-Dimensional Sub-Scores**: Eye Contact, Technical Knowledge, Fluency, Use of Words, Filler Words, Explanation Quality, Negotiation Score, and Stress Composure.
- **Coding Review & Complexity Badges**: Code quality scores, time/space complexity badges, optimization suggestions, and syntax-highlighted submitted code.
- **Progress Over Time**: Multi-line Recharts graph tracking Confidence, Eye Contact, Fluency, Technical, and Filler Control scores across historical sessions.
- **Daily Streak Tracking & 10 Milestone Badges**: Consecutive practice streaks with badges like *First Steps*, *Eye Contact Master*, *Fluent Speaker*, *Confidence King*, *Master Negotiator*, and *Week Warrior*.

### 8. Production-Grade Multi-Cloud Architecture ☁️
- **Frontend on Vercel**: Next.js App Router deployed globally on Vercel Edge CDN with zero-downtime CI/CD.
- **Backend on Render**: Asynchronous FastAPI service running MediaPipe vision pipelines and WebRTC/WebSocket signaling.
- **Serverless PostgreSQL on Neon**: Managed connection pooling and auto-scaling database storage.
- **Zero-Cold-Start Keep-Alive**: Automated heartbeat pings to `/health` with SQL connectivity auditing prevent container sleeping and provide instant uptime alerts.

---

## 🛠️ Technology Stack

### Frontend
- **Framework**: Next.js 14 (App Router, React)
- **Styling**: Vanilla CSS (Premium Glassmorphism & High-Density Dark Mode)
- **Code Editor**: Monaco Editor with multi-language syntax highlighting
- **Charts**: Recharts & custom SVG Radial Gauges
- **Animations**: Framer Motion
- **Real-Time**: WebRTC (video/audio streams), WebSocket (live STT, peer signaling)
- **Icons**: Lucide React

### Backend & AI Services
- **Framework**: FastAPI (Python 3.13)
- **Database**: PostgreSQL (Neon Serverless / Docker) with SQLAlchemy ORM
- **LLM Core**: Google Gemini API (dynamic questions, code evaluation, job matching, cover letter generation)
- **Speech-to-Text (STT)**: Groq Cloud API (Whisper on LPUs) + Local OpenAI Whisper fallback
- **Text-to-Speech (TTS)**: Microsoft Edge TTS (`en-US-JennyNeural`) with LRU caching
- **Computer Vision**: Google MediaPipe (Face & Pose Landmarker task architectures) & OpenCV
- **Audio Extraction**: MoviePy & FFmpeg CLI
- **Resume Parsing**: `pdfplumber`, `python-docx`
- **Automation / Scraping**: Playwright / Selenium headless browser automation, HTTP multi-board discovery

---

## 🚀 Getting Started

### Prerequisites
- Python 3.13+
- Node.js 18+
- PostgreSQL (or Neon DB connection string)
- API Keys:
  - Google Gemini API Key
  - Groq API Key *(Optional, recommended for high-speed low-memory STT)*

### 1. Backend Setup
```bash
cd backend

# Create and activate virtual environment
python -m venv venv
# On Windows:
.\venv\Scripts\activate
# On macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Pre-download vision models
python -m app.utils.download_models
```

Create a `.env` file in `backend/`:
```env
DATABASE_URL=postgresql://user:password@localhost:5432/confidometer
SECRET_KEY=your_jwt_secret_key_here
GEMINI_API_KEY=your_gemini_api_key_here
GROQ_API_KEY=your_groq_api_key_here
FRONTEND_URL=http://localhost:3000
```

Start the FastAPI server:
```bash
uvicorn app.main:app --reload
```

### 2. Frontend Setup
```bash
cd ../frontend

# Install packages
npm install
```

Create a `.env.local` file in `frontend/`:
```env
NEXT_PUBLIC_API_BASE=http://localhost:8000
NEXT_PUBLIC_WS_BASE=ws://localhost:8000
```

Start the development server:
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 3. Docker Compose (All-in-One Deployment)
```bash
docker-compose up --build -d
```

---

## 📂 Project Structure

```
Confidometer/
├── backend/
│   ├── app/
│   │   ├── models/
│   │   │   ├── user.py                 # User account & authentication models
│   │   │   ├── speech.py               # Speech analysis & interview result models
│   │   │   ├── meeting_request.py      # Peer-to-peer interview requests & scheduling
│   │   │   └── autoapply_models.py     # CandidateProfile, JobListing, ApplicationRecord
│   │   ├── routes/
│   │   │   ├── auth.py                 # JWT authentication & profile routes
│   │   │   ├── upload.py               # Video upload & background analysis dispatch
│   │   │   ├── analysis.py             # Diagnostic results, metrics & history
│   │   │   ├── agent.py                # AI interviewer Liza, TTS, DSA runner, STT WebSocket
│   │   │   ├── meeting.py              # Peer-to-peer lobby, match & WebRTC signaling
│   │   │   ├── trends.py               # Gamification streaks, badges & trend metrics
│   │   │   └── autoapply.py            # Job search, profile sync, cover letters & automation
│   │   ├── services/
│   │   │   ├── llm.py                  # Gemini AI dialogue & question engine (5 round types)
│   │   │   ├── stt.py                  # Hybrid Groq/Whisper self-correcting transcriber
│   │   │   ├── eye.py                  # Gaze & eye contact scoring via MediaPipe Face
│   │   │   ├── gesture.py              # Posture & fidgeting analysis via MediaPipe Pose
│   │   │   ├── filler.py               # Filler word detection & speech rate analysis
│   │   │   ├── voice.py                # Voice pitch & acoustic stability analysis
│   │   │   ├── scoring.py              # Composite confidence score calculation
│   │   │   ├── processor.py            # Asynchronous multi-service analysis orchestrator
│   │   │   ├── job_discovery.py        # Multi-board remote & global job scraper
│   │   │   ├── job_matcher.py          # AI semantic resume-to-job matching engine
│   │   │   ├── resume_parser.py        # PDF/DOCX resume text & structure extraction
│   │   │   ├── cover_letter_generator.py # Tailored cover letter synthesizer
│   │   │   ├── form_filler.py          # Headless browser form automation & submission
│   │   │   └── scheduler.py            # Application rate limiter & daily queue scheduler
│   │   ├── schema/                     # Pydantic schemas & response models
│   │   └── utils/                      # Model downloaders, audio/video tools, security
│   ├── main.py                         # FastAPI initialization, CORS, DB auto-migrations
│   └── requirements.txt                # Python backend dependencies
├── frontend/
│   ├── app/
│   │   ├── page.js                     # Landing page with hero & feature highlights
│   │   ├── login/ & register/          # Authentication flows
│   │   ├── upload/                     # AI interview setup & live workspace (all 5 types)
│   │   ├── speak/                      # Standalone speaking gym with slot machine topic spinner
│   │   ├── peer/                       # Peer-to-peer lobby, scheduling & WebRTC room
│   │   ├── autoapply/                  # AutoApply dashboard, jobs list & applications tracker
│   │   ├── processing/                 # Real-time background diagnostics status page
│   │   ├── dashboard/                  # Multi-tab analytics dashboard with charts & reports
│   │   └── history/                    # Historical interview archive
│   ├── components/
│   │   ├── Navbar.js                   # Responsive scroll-hide navigation bar
│   │   ├── PeerRoom.js                 # WebRTC peer room with stream sync & live AI guides
│   │   ├── AutocompleteInput.js        # Fuzzy-match autocomplete for roles & companies
│   │   ├── DateTimePicker.js           # iOS-style scrollable wheel date/time picker
│   │   ├── GaugeChart.js               # Animated confidence score radial gauge
│   │   ├── BarChart.js & MetricCard.js # Modular metric visualization components
│   │   └── autoapply/                  # JobCard, MatchScoreBadge, RoleTagInput, SalarySlider
│   ├── utils/
│   │   ├── api.js                      # REST client & WebSocket connectors
│   │   ├── autoapply_api.js            # AutoApply endpoints & job management client
│   │   └── auth.js                     # JWT storage & route protection helpers
│   ├── styles/                         # Glassmorphism design system & dark mode CSS
│   └── package.json                    # Node dependencies
├── nginx/
│   └── nginx.conf                      # Reverse proxy with WebSocket support
├── deployment_guide.md                 # Multi-cloud production architecture & interview guide
├── docker-compose.yml                  # Containerized deployment stack
└── README.md
```

---

## 📄 License

This project is open source and intended for educational, portfolio, and career preparation purposes.