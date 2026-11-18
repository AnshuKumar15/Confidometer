# Confidometer

An end-to-end, multimodal AI career acceleration platform that combines real-time interview simulation, automated computer vision and speech analytics, WebRTC peer practice, and an autonomous job application agent.

Built with Next.js 14, FastAPI (Python 3.13), PostgreSQL, Docker, Google Gemini, MediaPipe, Whisper, and Playwright.

---

## Overview

Preparing for modern technical and behavioral interviews requires mastering both subject-matter depth and non-verbal delivery (eye contact, pacing, posture, and poise). Confidometer solves this by providing:

1. An AI Interviewer (Liza) capable of conducting realistic technical, behavioral, live coding, SQL, and salary negotiation rounds.
2. A Multimodal Diagnostic Engine that evaluates recorded interview video for gaze tracking, posture, speech fluency, pitch stability, and filler words.
3. An Autonomous Job Application Agent (AutoApply) that aggregates listings, scores resume alignment, crafts tailored cover letters, and automates form submissions.
4. Peer-to-Peer Mock Interviews with WebRTC video, live speech transcription, and AI-guided question prompts.

For comprehensive architectural specifications, mathematical scoring models, and API definitions, see [documentation.md](documentation.md).

---

## Core Capabilities

### 1. AI-Driven Mock Interviews (Liza)
- Multiple Round Formats: Technical, HR Culture Fit, Behavioural (STAR method), DSA Live Coding (Monaco Editor with dynamic Easy + Medium challenges), SQL Assessment (interactive database queries), and Salary Negotiation.
- Adaptive Questioning: Dynamic Gemini-powered follow-ups informed by candidate resume content, target role, and past session history to prevent question repetition.
- Stress Interview Mode: Simulates high-pressure hiring environments with mid-response interruptions, measuring emotional composure and fidgeting.
- Natural Voice Delivery: Responsive speech synthesis using Microsoft Edge TTS with localized numerical normalization.

### 2. Multimodal Diagnostic Engine
- Gaze & Eye Contact Tracking: MediaPipe Face Landmarker (478-point mesh) iris boundary analysis combined with solvePnP 3D head pose estimation (yaw and pitch).
- Posture & Movement Scoring: MediaPipe Pose Landmarker tracking 8 upper-body keypoints to compute movement velocity, scored on a Gaussian bell curve to detect nervous fidgeting or unnatural stillness.
- Voice & Speech Dynamics: Ultra-low-memory PCM audio analysis measuring fundamental pitch variation (Hz), pause/silence ratio, speaking rate, and a three-tier filler word detector (definite, contextual, and phrase fillers).
- Hybrid Fast STT: Sub-second Groq Cloud LPU transcription with local Whisper fallback, supported by a self-correcting transcription buffer using phonetic similarity matching.
- Composite Scoring: Generates overall confidence ratings (0-100) and granular sub-scores alongside actionable Gemini-generated qualitative feedback.

### 3. AutoApply (Autonomous Job Application Agent)
- Tiered Job Discovery: Aggregates listings across free developer APIs (Remotive, Arbeitnow, Adzuna), user API keys (JSearch), and fallback web scrapers with SHA-256 deduplication.
- Semantic Resume Matching: Multi-criteria weighted matching (Skills 35%, Location 20%, Industry 20%, Experience 15%, Employment Type 10%) with automated level filtering.
- Adaptive Feedback Learning: Learns from user skip behavior (experience mismatch, location preference) to dynamically tighten matching criteria over time.
- Automated Application Submission: Tailored cover letter synthesis and Playwright browser automation with human-like delays, anti-bot safeguards, and configurable daily limits.

### 4. Peer-to-Peer WebRTC Practice
- Real-Time Video Rooms: Low-latency peer-to-peer interviews with STUN/ICE connectivity and buffered candidate negotiation.
- Role-Based Tooling: Dynamic role assignment (Interviewer vs. Interviewee) with synchronized resume viewers and AI-generated follow-up recommendations.
- Live Transcription & Diagnostics: Real-time speech-to-text broadcast via WebSockets, with automated post-interview video diagnostics.

---

## Tech Stack

| Layer | Technologies |
|---|---|
| Frontend | Next.js 14 (App Router), React, Monaco Editor, Recharts, Framer Motion, Vanilla CSS (Glassmorphism) |
| Backend | FastAPI (Python 3.13), Uvicorn, SQLAlchemy, Pydantic, SlowAPI Rate Limiting |
| AI & LLMs | Google Gemini API (gemini-1.5-pro / flash), Circuit Breaker fault tolerance |
| Vision & Audio | Google MediaPipe (Face & Pose Tasks), OpenCV, Groq Cloud API, OpenAI Whisper, Microsoft Edge TTS |
| Database & Infra | PostgreSQL (Neon Serverless / Docker), Playwright, Nginx, Docker Compose |

---

## Architecture Summary

```
[Browser / Client]
  Next.js 14 (Monaco Editor, WebRTC Video, Audio Waveform Visualizer)
         |
         v (HTTPS / WSS via Nginx)
[FastAPI Backend Engine]
  +-- /agent       : Dynamic LLM dialogue, DSA sandbox, TTS audio, WebSocket STT
  +-- /upload      : Video ingestion & asynchronous diagnostic dispatch
  +-- /analysis    : Scoring computation, metric retrieval, performance history
  +-- /meeting     : Peer-to-peer WebRTC signaling & live transcript broadcast
  +-- /autoapply   : Tiered job discovery, resume matching & Playwright automation
  +-- /trends      : Streak tracking, milestone achievements & analytics
         |
         +--> [Diagnostic Pipeline] Sequential GC execution (Audio -> Eye -> Pose -> LLM)
         +--> [PostgreSQL Database] Candidate profiles, speeches, jobs & application records
```

---

## Quickstart

### Prerequisites
- Python 3.13+
- Node.js 18+
- PostgreSQL or Neon Serverless connection string
- Google Gemini API Key (Groq API Key recommended for accelerated STT)

### 1. Backend Setup

```bash
cd backend

# Create and activate virtual environment
python -m venv venv
# Windows:
.\venv\Scripts\activate
# Linux/macOS:
source venv/bin/activate

# Install dependencies and download vision models
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

Visit `http://localhost:3000` in your browser.

### 3. Docker Deployment

```bash
docker-compose up --build -d
```

---

## Documentation

For full details on the diagnostic algorithms, mathematical formulas (Gaussian bell curve scoring, stress tolerance, blended evaluation), database schemas, and background scheduler architecture, please review [documentation.md](documentation.md).

---

## License

This project is open source and available under the MIT License.
