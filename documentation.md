# Confidometer Technical Documentation

## 1. System Overview and Architecture

Confidometer is an enterprise-grade career acceleration and mock interview platform. The system combines real-time conversational artificial intelligence, multi-modal diagnostic computer vision, speech transcription, peer-to-peer WebRTC video rooms, and an autonomous job application agent.

### 1.1 High-Level Architecture

The platform follows a decoupled, service-oriented architecture:

```
[Client Layer]
Next.js 14 Web Application (App Router, Monaco Editor, Web Audio API, WebRTC)
       |
       v (HTTPS / WSS via Nginx Reverse Proxy)
[API and Orchestration Layer]
FastAPI Application (Python 3.13, Uvicorn, SlowAPI Rate Limiting)
       |
       +---> [Asynchronous Background Processing] (processor.py, sequential GC pipelines)
       |
       +---> [Relational Storage] PostgreSQL (Neon Serverless / Docker SQLAlchemy ORM)
       |
       +---> [LLM Engine] Google Gemini API (gemini-1.5-pro / gemini-1.5-flash)
       |
       +---> [Speech-to-Text Services] Groq Cloud API (Whisper LPU) + Local Whisper Fallback
       |
       +---> [Text-to-Speech Engine] Microsoft Edge TTS (en-US-JennyNeural)
       |
       +---> [Computer Vision Models] Google MediaPipe Face & Pose Tasks + OpenCV
       |
       +---> [Job Discovery and Scraping] Multi-board API aggregators and Playwright Automation
```

### 1.2 Core Subsystems

1. Multimodal Diagnostic Engine: Evaluates recorded interview videos across gaze accuracy, body language, speech fluency, filler words, pitch stability, and delivery pace.
2. Conversational AI Interviewer (Liza): Conducts adaptive Technical, HR, Behavioural, DSA Coding, SQL Querying, and Salary Negotiation rounds.
3. Peer-to-Peer Interview Network: WebRTC-based video matching lobby enabling candidate-to-candidate interviews with live speech-to-text and AI-generated prompts.
4. Autonomous Job Application Agent (ApplyBuddy / AutoApply): Tiered job discovery, semantic resume-to-job matching, adaptive skip-feedback learning, cover letter synthesis, and automated application submission.
5. Speaking Gym: Rapid fluency trainer with interactive topic selection and live waveform monitoring.
6. Performance Analytics: Radial confidence scoring, historical metric tracking, streak monitoring, and automated audio executive summaries.

---

## 2. Backend Architecture and Data Layer

### 2.1 Server Configuration and Lifecycle

The backend is constructed with FastAPI on Python 3.13. Key runtime characteristics include:

- Lifecycle Management: Startup hooks download required MediaPipe task models (`face_landmarker.task` and `pose_landmarker.task`) and initialize the autonomous background job application scheduler.
- Operating System Compatibility: On Windows platforms, `socket.getaddrinfo` is forced to return IPv4 addresses exclusively to avoid DNS lookup timeouts. On Linux hosts, explicit calls to `ctypes.CDLL("libc.so.6").malloc_trim(0)` return unused heap pages to the OS.
- Rate Limiting: SlowAPI integrates with FastAPI middleware, enforcing per-endpoint limits (`RATE_STANDARD`, `RATE_EXPENSIVE`, `RATE_UPLOAD`, `RATE_SEARCH`).
- Content Compression: GZipMiddleware compresses response payloads exceeding 500 bytes.
- Cross-Origin Resource Sharing: Dynamic origin reflection handles credentials-compliant CORS across local and production deployment environments.

### 2.2 Database Schema and Models

The relational database is built on PostgreSQL using SQLAlchemy ORM.

#### User Model (`users`)
- `id`: Integer primary key.
- `email`: Unique string identifier.
- `name`: Display name.
- `hashed_password`: Passlib-encrypted credential hash.
- `streak_count`: Integer tracking consecutive active daily practice sessions.
- `last_active_date`: Date tracking recent activity for streak calculations.
- `badges_unlocked`: JSON array storing unlocked achievement badge IDs.
- `created_at`: UTC timestamp.

#### Speech Model (`speeches`)
- `id`: Integer primary key.
- `user_id`: Foreign key referencing `users.id`.
- `video_path`: File system path to the uploaded interview recording.
- `status`: Processing state (`processing`, `completed`, `failed`).
- `progress`: Integer percentage from 0 to 100 for client progress polling.
- `interview_type`: Category identifier (`technical`, `hr`, `behavioural`, `dsa`, `sql`, `negotiation`).
- `role`: Target job title.
- `company_name`: Target company.
- `conversation_history`: JSON serialized transcript of user and AI turns.
- `dsa_code`: Final submitted code for DSA challenges.
- `dsa_question_details`: JSON description of presented DSA problems.
- `sql_queries`: Submitted SQL statements.
- `sql_question_details`: JSON description of presented SQL tasks.
- `sql_score`: Computed grading score for SQL executions.
- `confidence_score`: Overall composite score (0-100).
- `filler_count`: Total counted filler words.
- `eye_contact_percentage`: Raw gaze tracking score (0-100).
- `gesture_frequency`: Body posture movement score (0-100).
- `voice_stability_score`: Vocal acoustic consistency score (0-100).
- Sub-scores (0-100): `eye_contact_score`, `technical_knowledge_score`, `fluency_score`, `use_of_words_score`, `filler_words_score`, `explanation_quality_score`.
- DSA Sub-scores (0-100): `code_quality_score`, `optimization_score`, `thinking_process_score`, `communication_score`.
- Negotiation Score: `negotiation_score` (0-100).
- Stress Telemetry: `stress_mode` (boolean), `fidgeting_index` (0-100), `speech_rate_variance` (0-100), `stress_tolerance_score` (0-100).
- Qualitative Reports: `technical_feedback` (JSON), `non_technical_feedback` (JSON), `short_summary_feedback` (text summary for TTS).

#### Peer Interview Request Model (`peer_interview_requests`)
- `id`: Integer primary key.
- `user_id`: Candidate creating the request.
- `role`: Target job role.
- `interview_type`: Practice round category.
- `company_name`: Target employer.
- `resume_text`: Parsed text of the candidate resume.
- `resume_filename`: Reference to stored resume document.
- `job_description`: Optional role context.
- `scheduled_at`: UTC timestamp for future interviews, or null for immediate matches.
- `status`: Lifecycle state (`pending`, `accepted`, `completed`, `cancelled`).
- `interviewer_id`: Foreign key referencing the matched peer interviewer.
- `room_id`: UUID for WebRTC signaling and data exchange.

#### AutoApply Models
- `CandidateProfile`: Parsed work experience, technical skills, soft skills, education, projects, certifications, links (GitHub, LinkedIn, portfolio), and raw resume text.
- `UserPreferences`: Target job titles, locations, work modes (Remote, Hybrid, On-site), salary bounds, currency, company sizes, blacklisted employers, blocked keywords, and optional third-party API keys.
- `ResumeVersion`: Multiple resume variants mapped to specific career niches.
- `DiscoveredJob`: Aggregated job posts with SHA-256 fingerprint deduplication, salary ranges, location, requirements, work mode, and experience bounds.
- `JobMatch`: Multi-criteria match records linking candidates to discovered jobs with detailed sub-scores and strengths/missing skills breakdowns.
- `Application`: Auto-application execution records tracking submission status (`ready`, `submitted`, `failed`, `interview`, `offer`), generated cover letters, and question-answer mappings.
- `AutoApplyConfig`: User automation configuration including daily limits, minimum match score thresholds, working hours, and search frequencies.
- `ActivityLog`: Audit trail of actions performed by the autonomous agent.
- `SavedAnswer`: Cached question-answer pairs for recurring application questions.
- `AutoApplyNotification`: System alerts regarding application submissions, interview requests, and configuration warnings.

---

## 3. Multimodal Diagnostic Processing Pipeline

The diagnostic pipeline (`app/services/processor.py`) orchestrates audio extraction, speech analysis, computer vision, scoring mathematics, and LLM evaluation.

### 3.1 Memory-Constrained Pipeline Orchestration

To run reliably on memory-restricted cloud environments (e.g. 512MB RAM instances), the pipeline executes sequentially rather than concurrently:

1. Stage 1: Audio extraction and acoustic/speech analysis.
2. Stage 2: MediaPipe Face Landmarker eye contact and gaze estimation.
3. Stage 3: MediaPipe Pose Landmarker upper-body posture and gesture analysis.
4. Stage 4: Composite and blended scoring computation.
5. Stage 5: Gemini LLM evaluation and report synthesis.
6. Stage 6: Edge TTS audio prefetching for executive feedback summary.

Between each stage, the orchestrator triggers garbage collection across generations 0, 1, and 2, followed by `malloc_trim` on Linux systems to release heap memory back to the operating system. Database sessions are strictly scoped and closed during heavy computation to prevent connection pool exhaustion.

### 3.2 Computer Vision: Gaze and Eye Contact Tracking

The eye tracking module (`app/services/eye.py`) combines head pose estimation with iris boundary measurements:

- Primary Detector: MediaPipe FaceLandmarker using the 478-point canonical face mesh.
- Frame Optimization: Input frames are resized to a target width of 240px. Uniform sampling selects 60 to 80 frames across the video duration.
- Head Pose Estimation: Six facial landmark points (nose tip, chin, eye outer corners, mouth corners) are projected against a generic 3D facial coordinate model using `cv2.solvePnP`. The resulting rotation vector is converted into Euler angles (yaw and pitch) via the Rodrigues transformation. A candidate is marked as looking forward if yaw is within +/-35 degrees and pitch is within -35 to +28 degrees (accounting for downward monitor gaze).
- Iris Centering: When the 478-point mesh is resolved, landmarks 468 (left iris) and 473 (right iris) are measured relative to eyelid boundaries (landmarks 33, 133, 159, 145 for left; 362, 263, 386, 374 for right). Horizontal and vertical centering ratios define whether gaze is centered.
- Fallback System: If MediaPipe task assets are unavailable or execution encounters an exception, the system falls back to an OpenCV Haar Cascade (`haarcascade_frontalface_default.xml` and `haarcascade_eye.xml`). If video container decoding fails (common with browser WebM streams), the file is automatically remuxed via FFmpeg prior to processing.

### 3.3 Computer Vision: Posture, Movement, and Fidgeting

The gesture analysis module (`app/services/gesture.py`) tracks upper-body movement and physical poise:

- Keypoint Tracking: MediaPipe PoseLandmarker tracks 8 upper-body landmarks: left/right shoulders (11, 12), elbows (13, 14), wrists (15, 16), and index fingers (19, 20).
- Movement Velocity: Normalized Euclidean distances are computed between consecutive sampled frames and divided by the sampling stride.
- Bell-Curve Scoring: Physical movement is evaluated via a Gaussian bell curve function. Optimal conversational movement is centered at an ideal velocity of 0.015 units per frame (width 0.020). Excessive stillness (monotone posture) and excessive motion (nervous fidgeting) are both penalized.
- Fallback System: If pose landmarks cannot be detected, the system calculates upper-body frame differencing using an adaptive region-of-interest box below the detected face.

### 3.4 Speech-to-Text and Audio Dynamics

#### Smart Transcription (`app/services/stt.py`)
- Hybrid Architecture: Audio chunks are prioritized through Groq Cloud LPUs running Whisper (`groq.audio.transcriptions.create`), achieving sub-second inference. If external API access is unavailable, local OpenAI Whisper models take over.
- Self-Correcting Transcriber: Maintains a rolling buffer of `TranscriptSegment` objects with Whisper confidence probabilities. When subsequent segments exhibit phonetic similarity (computed via `difflib.SequenceMatcher`) or high Jaccard word overlap with prior lower-confidence segments, the engine retroactively replaces the erroneous text.
- Hallucination Filter: Detects and strips repeated token loops and common hallucinated subtitle phrases.

#### Voice Analysis (`app/services/voice.py`)
- Waveform Ingestion: Direct 16-bit PCM WAV reading via Python's `wave` module avoids the heavy memory overhead of librosa/scipy, keeping memory footprint under 5MB.
- Pitch Estimation: Autocorrelation and average magnitude difference techniques calculate fundamental frequency across overlapping 40ms analysis frames. Pitch variation standard deviation is scored against an ideal natural conversational variation of 35 Hz.
- Silence and Pause Ratio: Frame energy thresholds calculate silence ratios. An ideal conversational pause ratio is calibrated to 25%.
- Speaking Rate: Evaluates words per active speaking minute based on audio duration minus silence segments.

#### Filler Word Detection (`app/services/filler.py`)
A three-tier lexical parser scans candidate transcripts:
- Tier 1 (Definite Fillers): Unambiguous filler sounds ("um", "uh", "erm", "hmm", "ah").
- Tier 2 (Contextual Fillers): Words counted as fillers only when occurring at clause boundaries or sentence starts ("basically", "actually", "literally", "honestly", "so", "like").
- Tier 3 (Phrase Fillers): Multi-word discourse markers ("you know what i mean", "if that makes sense", "at the end of the day", "you know", "i mean"). Multi-word phrases are matched first in descending order of length to prevent double-counting substrings.

---

## 4. Scoring Algorithms and Mathematical Models

All scoring routines normalize component telemetry into standardized 0 to 100 scales.

### 4.1 Gaussian Bell Curve Scoring Function

Component metrics with optimal intermediate target values (e.g., pitch standard deviation, pause ratio, gesture movement) utilize a Gaussian bell curve model:

```
Score(x) = 100 * exp(-0.5 * ((x - Ideal) / Width)^2)
```

Where:
- `Ideal`: The target optimal value for the acoustic or kinematic behavior.
- `Width`: The standard deviation controlling the rate of score decay as values deviate from the target.

### 4.2 Base Confidence Score

The overall delivery confidence score combines physical and acoustic signals:

```
Confidence Score = (0.30 * Eye Contact)
                 + (0.25 * Voice Stability)
                 + (0.25 * Filler Word Score)
                 + (0.15 * Speaking Rate Score)
                 + (0.05 * Gesture Score)
```

Where:
- `Filler Word Score = max(0, 100 - (Filler Count * 3))`
- `Voice Stability = (0.45 * Pitch Score) + (0.30 * Silence Score) + (0.25 * Speaking Rate Score)`

### 4.3 Stress Tolerance Score

When Stress Interview Mode is active, candidate composure under simulated recruiter pressure is scored as:

```
Stress Tolerance Score = 100 - (Eye Contact Penalty + Fidgeting Penalty + Speech Variance Penalty + Filler Penalty)
```

Component penalties are defined as:
- `Eye Contact Penalty = max(0.0, 80.0 - Eye Contact) * 0.5`
- `Fidgeting Penalty = max(0.0, Fidgeting Index - 30.0) * 0.4`
- `Speech Variance Penalty = max(0.0, Speech Rate Variance - 20.0) * 0.4`
- `Filler Penalty = min(20.0, Filler Count * 1.5)`
- Final score bounded between 0.0 and 100.0.

### 4.4 Blended Evaluation Score

The final summary readiness score balances technical content mastery with non-verbal delivery poise, weighted by interview round type:

#### Technical Rounds
- Content Weight: 70% (Technical Knowledge 40%, Explanation Quality 35%, Vocabulary Precision 25%)
- Delivery Weight: 30% (Eye Contact 30%, Voice Stability 25%, Filler Control 25%, Speaking Rate 15%, Gestures 5%)

#### DSA Live Coding Rounds
- Content Weight: 70% (Code Quality 35%, Algorithmic Optimization 25%, Problem-Solving Process 25%, Communication 15%)
- Delivery Weight: 30% (Delivery signals)

#### Behavioural Rounds
- Content Weight: 50% (STAR Explanation Quality 45%, Vocabulary Precision 30%, Scenario Relevance 25%)
- Delivery Weight: 50% (Delivery signals)

#### Salary Negotiation Rounds
- Content Weight: 60% (Negotiation Strategy and Tact 60%, Value Justification 40%)
- Delivery Weight: 40% (Delivery signals)

---

## 5. Conversational AI Interview Engine (Liza)

The conversational agent (`app/routes/agent.py` and `app/services/llm.py`) manages dynamic interview sessions.

### 5.1 Supported Interview Modes

1. Technical Interview: Contextual technical questions derived from candidate resume text, target role requirements, and company engineering stacks.
2. HR Culture Fit Round: Assesses motivation, teamwork, workplace values, conflict resolution, and career trajectory.
3. Behavioural Round (STAR Method): Structural inquiry into Situation, Task, Action, and Result, with deep automated follow-up probing based on candidate answers.
4. DSA Live Coding Round: Generates two algorithmic problems (1 Easy, 1 Medium) tailored to target company interview patterns. Includes side-by-side Monaco code editor, test execution drawer, and a 30-minute countdown.
5. SQL Assessment Round: Evaluates relational database querying through a curated bank of 200 SQL challenges across multiple difficulty tiers, blended with dynamically generated Gemini schema questions.
6. Salary Negotiation Simulator: Liza adopts the persona of a corporate recruiter extending an initial compensation offer. She introduces realistic counter-tactics (budget constraints, equity balance, benefits compensation) and yields a final package review.
7. Stress Interview Mode: Available as a modifier on non-coding rounds. The agent interrupts candidate explanations approximately 20% of the time with sharp, high-tempo questions to measure composure.

### 5.2 Question Diversity and Memory System

To avoid repetitive questions across repeated user sessions:
- A rolling per-user memory buffer caches the last 15 asked questions.
- Prior session questions are retrieved from recent `Speech` database entries.
- A randomized diversity configuration guides Gemini prompts away from recently explored topics and question structures.

### 5.3 Speech Synthesis (TTS)

- Audio Generation: Microsoft Edge TTS (`en-US-JennyNeural`).
- Pre-processing: Indian numbering conventions (e.g. "18,00,000", "2.5 crore") and concatenated numerals ("18lakh") are normalized into clear spoken English ("18 lakh", "2.5 crore").
- Caching: In-memory LRU cache indexes synthesized audio chunks by text content to minimize latency.

---

## 6. AutoApply: Autonomous Job Search and Application Agent

AutoApply (`app/services/job_discovery.py`, `job_matcher.py`, `form_filler.py`, `scheduler.py`) automates end-to-end job discovery and application submission.

### 6.1 Tiered Job Discovery Engine

The discovery engine runs across three distinct tiers:
- Tier 1 (Free APIs): Scrapes and aggregates public developer APIs including Remotive, Arbeitnow, and Adzuna Free Tier.
- Tier 2 (User-Configured Keys): Queries rapid search APIs (such as JSearch via RapidAPI) using user-supplied keys.
- Tier 3 (Fallback Web Scraper): Parses live listings directly from public remote boards.
- Deduplication: Computes a SHA-256 fingerprint from sanitized title and company strings (`norm_title:norm_company`), preventing duplicate database records.
- Metadata Parsing: Regex heuristics extract experience requirements (min/max years) and classify work modes (Remote, Hybrid, On-site).

### 6.2 Semantic Matching Engine

`JobMatcher` scores candidates against discovered opportunities across five weighted dimensions:
- Skill Alignment (35%): Matches technical and soft skills against job requirements.
- Location and Work Mode Alignment (20%): Evaluates geographic and remote work preferences.
- Industry and Role Alignment (20%): Measures title relevance and target domain match.
- Experience Level Alignment (15%): Normalizes experience tiers (0-1 year, 2-4 years, 5-9 years, 10+ years) and enforces strict rejection rules against senior/lead titles when candidate profile is entry-level.
- Employment Type Alignment (10%): Full-time, contract, or internship alignment.

### 6.3 Adaptive Feedback Learning

The `FeedbackLearner` module monitors candidate skip decisions:
- Tracks skip reasons: location mismatch, experience mismatch, company blacklist, or role disinterest.
- Generates dynamic penalty signals over a 30-day sliding window.
- If a candidate frequently skips for experience or location, strict filtering modes activate, automatically downranking or filtering out similar postings in subsequent automated runs.

### 6.4 Cover Letter Generation and Form Filling

- Cover Letter Synthesis: Gemini analyzes the target job description against candidate experience, achievements, and company background to draft role-tailored cover letters.
- Form Automation: Evaluates application screening questions against stored user preferences and heuristic rules (e.g., notice period, sponsorship, salary expectations, years of experience). Unresolved questions are marked for user review. Form submission is executed via Playwright headless browser scripts with human-like delays.
- Safety Limits: Configurable daily application volume caps (e.g., 5-25/day), operational time windows, and cool-down intervals.

---

## 7. Peer-to-Peer Interview Practice (WebRTC)

The peer interview subsystem (`app/routes/meeting.py` and `frontend/components/PeerRoom.js`) facilitates real-time user-to-user mock interviews.

### 7.1 Signaling and Room Lifecycle

- WebSocket Signaling: Clients connect via `/meeting/ws/{room_id}` for SDP offer/answer exchange, ICE candidate buffering, and state coordination.
- Candidate Queueing: WebRTC ICE candidates arriving prior to remote description configuration are buffered and applied once the peer connection stabilizes.
- Track Hotplugging: Dynamic track replacement attaches camera and audio tracks mid-session without renegotiating the entire peer connection.
- Permission Interceptor: Intercepts camera access errors (`NotReadableError`, `PermissionDeniedError`) and presents in-room recovery triggers.

### 7.2 Structured Interview Protocol

Sessions progress through coordinated phases:
1. Warmup Phase: Unrecorded peer greeting and technical check.
2. Interview Phase: One peer assumes the Interviewer role; the other is Interviewee. The interviewer receives AI-generated questions and context-specific follow-ups.
3. Live Transcription: Interviewee audio streams to the server for live Whisper transcription, broadcast to both participants via WebSocket.
4. Wrap-up and Diagnostic Upload: Upon completion, the interviewee video stream automatically uploads to `/upload/` for multimodal diagnostic processing.

---

## 8. Frontend Architecture and User Interface

The client is built using Next.js 14 with the App Router, React, and Vanilla CSS.

### 8.1 Route Hierarchy

- `/`: Landing page with feature overviews, system metrics, and interactive product walkthroughs.
- `/login` and `/register`: Authentication flows with JWT storage in client cookies/local storage.
- `/upload`: Setup console for AI interviews (role selection, company autocomplete, resume upload, round selection, stress toggle).
- `/processing`: Asynchronous diagnostic processing monitor with live status updates and stage progress bars.
- `/dashboard`: Primary analytics suite with animated radial confidence gauges, Recharts historical trends, milestone badges, and Edge TTS audio playback.
- `/speak`: Speaking Gym featuring an 11-category animated slot machine topic spinner, live webcam feed, and Web Audio API waveform visualizer.
- `/peer`: Peer-to-peer lobby for creating, browsing, and launching WebRTC video rooms, complete with an iOS-style wheel DateTimePicker.
- `/autoapply`: AutoApply hub including onboarding, live jobs list with match badges, application tracking funnel, and configuration settings.
- `/history`: Historical interview archive with detailed past scorecards.

### 8.2 Component Library

- `Monaco Editor`: Multi-language code editor supporting syntax highlighting, auto-indentation, and multi-tab state persistence between DSA problems.
- `GaugeChart`: Custom SVG-based animated radial gauge rendering composite confidence scores.
- `MetricCard` and `BarChart`: Glassmorphic data cards visualizing sub-scores.
- `PeerRoom`: Unified WebRTC room component with stream synchronization, local mirroring, remote unmirrored view, and live speech-to-text sidebar.
- `AutocompleteInput`: Fuzzy-search input component for selecting target companies and job titles.
- `DateTimePicker`: Custom three-column scrollable wheel picker for scheduling peer mock interviews.

---

## 9. Deployment and Production Infrastructure

### 9.1 Multi-Cloud Topology

- Frontend: Deployed on Vercel Edge CDN with Next.js App Router and zero-downtime CI/CD.
- Backend: Deployed as a containerized FastAPI service on Render.
- Relational Database: Serverless PostgreSQL hosted on Neon with connection pooling and scale-to-zero capabilities.
- Storage: Dedicated persistent storage volume mounted for interview video recordings and resume assets.

### 9.2 Containerization

A production `Dockerfile` encapsulates backend dependencies:
- Base Image: `python:3.13-slim`.
- System Packages: `ffmpeg`, `libgl1`, `libglib2.0-0`, `build-essential`.
- Python Dependencies: Pre-installed via `requirements.txt`.
- Startup Command: Runs Uvicorn with single or multi-worker configurations behind Gzip and CORS middleware.

`docker-compose.yml` provides a local all-in-one development environment coordinating the FastAPI server, Next.js frontend, PostgreSQL database, and Nginx reverse proxy.

### 9.3 Zero-Cold-Start Health Checks

The `/health` endpoint supports shallow and deep status checks:
- Default (`GET /health`): Returns an immediate HTTP 200 without issuing SQL queries, preventing unnecessary wakeups of serverless database compute during routine uptime monitoring.
- Deep Check (`GET /health?check_db=true`): Executes `SELECT 1` against PostgreSQL to verify end-to-end database connectivity.

---

## 10. Environment Variables and Configuration

### Backend Configuration (`backend/.env`)

```env
DATABASE_URL=postgresql://user:password@localhost:5432/confidometer
SECRET_KEY=your_jwt_secret_key_here
GEMINI_API_KEY=your_google_gemini_api_key_here
GROQ_API_KEY=your_groq_api_key_here
FRONTEND_URL=http://localhost:3000
UPLOAD_DIR=uploads
PORT=8000
```

### Frontend Configuration (`frontend/.env.local`)

```env
NEXT_PUBLIC_API_BASE=http://localhost:8000
NEXT_PUBLIC_WS_BASE=ws://localhost:8000
```
