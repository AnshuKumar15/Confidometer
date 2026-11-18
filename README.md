# Confidometer 📊🤖

> **Multimodal AI Career Acceleration & Interview Intelligence Platform**  
> Simulating realistic interviews, scoring verbal & non-verbal poise in real-time, and automating your job hunt.

Built with **Next.js 14**, **FastAPI**, **PostgreSQL**, **Google Gemini**, **MediaPipe**, **Groq / Whisper**, **WebRTC**, and **Playwright**.

---

## 📌 Overview

Mastering technical and behavioral interviews requires two critical pillars: **domain depth** and **delivery poise** (eye contact, pacing, posture, and composure). **Confidometer** bridges this gap by unifying:

- **AI Mock Interviewer (Liza)**: Adaptive technical, behavioral, live coding, SQL, and salary negotiation rounds.
- **Multimodal Diagnostic Engine**: Automated computer vision and speech pipelines measuring gaze accuracy, fidgeting, speech cadence, and filler words.
- **AutoApply (Autonomous Job Agent)**: Smart multi-board job discovery, semantic resume-to-job matching, tailored cover letters, and automated submissions.
- **Peer-to-Peer Mock Network**: Real-time WebRTC video rooms with live speech transcription and AI-guided prompts.

📖 *Looking for deep architectural specs, scoring formulas, and API definitions? Check out [documentation.md](documentation.md).*

---

## 🌟 Core Highlights

### 🎯 1. AI-Driven Mock Interviews (Liza)
- **Multi-Format Rounds**: Technical, HR Culture Fit, **Behavioural (STAR Method)**, **DSA Live Coding** (side-by-side Monaco Editor with Easy + Medium challenges), **SQL Assessment** (200+ curated schema challenges), and **Salary & Offer Negotiation**.
- **Dynamic Context-Aware Probing**: Gemini-powered questions adapt in real-time to your **resume**, target **company**, and past session history to eliminate repetitive questions.
- **⚡ Stress Interview Mode**: Simulates intense hiring environments with mid-response interruptions (~20% frequency) to assess composure, vocal steadiness, and fidgeting under pressure.
- **Natural Speech Synthesis**: Responsive, crystal-clear voice feedback powered by **Microsoft Edge TTS** with localized numerical formatting.

### 👁️ 2. Multimodal Diagnostic Engine
- **Gaze & Eye Contact Tracking**: **Google MediaPipe Face Landmarker** (478-point iris mesh) combined with `solvePnP` 3D head pose estimation (yaw & pitch) and OpenCV fallbacks.
- **Posture & Gesture Analysis**: **MediaPipe Pose Landmarker** tracking 8 upper-body landmarks to compute movement velocity, scored on a **Gaussian bell curve** to detect nervous fidgeting or unnatural stiffness.
- **Acoustic & Voice Stability**: Ultra-low-memory PCM audio processing computing pitch variance (Hz), conversational pause ratio, and speech pacing.
- **Tiered Filler Word Parser**: Three-tier lexical filter detecting definite (*um, uh*), contextual (*basically, literally*), and phrase-level fillers (*you know what I mean*).
- **Hybrid Cloud STT**: Ultra-fast **Groq Cloud LPUs** (sub-second transcription) with local **OpenAI Whisper** fallback and smart phonetic self-correction.
- **Composite Confidence Score**: Normalizes non-verbal poise and technical depth into an animated **0–100 Confidence Score** paired with executive verbal summaries.

### 🚀 3. AutoApply (Autonomous Job Application Agent)
- **Tiered Multi-Board Scraping**: Aggregates live listings from free developer APIs (Remotive, Arbeitnow, Adzuna), user-configured keys (JSearch), and fallback scrapers with **SHA-256 fingerprint deduplication**.
- **AI Semantic Match Engine**: Multi-criteria weighted scoring (**Skills 35%**, **Location 20%**, **Industry 20%**, **Experience 15%**, **Employment Type 10%**) with automated level filtering.
- **Adaptive Feedback Learning**: Dynamically learns from candidate skip behavior to penalize mismatched locations or experience levels over a 30-day sliding window.
- **Headless Form Submission**: Generates tailored cover letters and automates application submission via **Playwright** with human-like delays, anti-bot safeguards, and configurable daily limits.

### 👥 4. Peer-to-Peer WebRTC Practice
- **Real-Time Video Rooms**: Peer-to-peer interviews using **WebRTC** with buffered ICE candidate negotiation and dynamic camera/microphone track hotplugging.
- **Role-Based Tooling**: Dedicated **Interviewer** vs. **Interviewee** workspaces with synchronized resume views and real-time AI follow-up suggestions.
- **Live STT & Auto-Diagnostics**: Speech-to-text broadcast in real-time via **WebSockets**, with automatic webcam recording upload for background diagnostics at session end.

---

## 🛠️ Technology Stack

| Domain | Technologies & Libraries |
|---|---|
| **Frontend** | **Next.js 14** (App Router), **React**, **Monaco Editor**, **Framer Motion**, **Recharts**, Vanilla CSS (Glassmorphism & High-Density Dark Mode) |
| **Backend** | **FastAPI** (Python 3.13), **Uvicorn**, **SQLAlchemy ORM**, **Pydantic**, **SlowAPI** Rate Limiting |
| **AI & LLM Core** | **Google Gemini API** (gemini-1.5-pro / flash), Circuit Breaker fault tolerance |
| **Computer Vision** | **Google MediaPipe** (Face Landmarker & Pose Landmarker Tasks), **OpenCV** |
| **Speech & Audio** | **Groq Cloud API** (Whisper on LPUs), **OpenAI Whisper**, **Microsoft Edge TTS**, Web Audio API |
| **Automation & Database** | **Playwright**, **PostgreSQL** (Neon Serverless / Docker), **Nginx**, **Docker Compose** |

---

## 🏗️ System Architecture

```
[Client / Browser]
  Next.js 14 (Monaco Editor, WebRTC Video, Audio Waveform Visualizer)
         |
         v (HTTPS / WSS via Nginx)
[FastAPI Backend Engine]
  +-- /agent       : Dynamic LLM dialogue, DSA sandbox, Edge TTS, WebSocket STT
  +-- /upload      : Video ingestion & asynchronous diagnostic dispatch
  +-- /analysis    : Scoring computation, metric retrieval, performance history
  +-- /meeting     : Peer-to-peer WebRTC signaling & live transcript broadcast
  +-- /autoapply   : Tiered job discovery, resume matching & Playwright automation
  +-- /trends      : Daily streak tracking, milestone badges & historical charts
         |
         +--> [Diagnostic Pipeline] Sequential GC execution (Audio -> Eye -> Pose -> LLM)
         +--> [PostgreSQL Database] Candidate profiles, speeches, jobs & application funnel
```

---

## ⚡ Quickstart

### Prerequisites
- **Python 3.13+**
- **Node.js 18+**
- **PostgreSQL** (or Neon Serverless URL)
- **Google Gemini API Key** (*Groq API Key recommended for accelerated STT*)

### 1. Backend Setup

```bash
cd backend

# Create and activate virtual environment
python -m venv venv
# Windows:
.\venv\Scripts\activate
# Linux/macOS:
source venv/bin/activate

# Install dependencies & pre-download vision models
pip install -r requirements.txt
python -m app.utils.download_models

# Configure environment variables in backend/.env:
# DATABASE_URL=postgresql://user:password@localhost:5432/confidometer
# GEMINI_API_KEY=your_gemini_key
# GROQ_API_KEY=your_groq_key
# SECRET_KEY=your_jwt_secret

# Start API server
uvicorn app.main:app --reload
```

### 2. Frontend Setup

```bash
cd ../frontend

npm install

# Configure environment variables in frontend/.env.local:
# NEXT_PUBLIC_API_BASE=http://localhost:8000
# NEXT_PUBLIC_WS_BASE=ws://localhost:8000

npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### 3. Docker Deployment

```bash
docker-compose up --build -d
```

---

## 📖 In-Depth Documentation

For full mathematical derivations (Gaussian bell curve scoring, stress tolerance formulas, blended evaluation weights), database entity relationships, and background worker lifecycle, see [documentation.md](documentation.md).

---

## 📄 License

This project is open source and available under the MIT License.
