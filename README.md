# Confidometer 📊🤖

An advanced, AI-powered mock interview preparation platform designed to help candidates master both their technical and non-verbal communication skills. By combining real-time conversation models, computer vision, and speech transcription, **Confidometer** simulates real-world hiring environments and delivers thorough, multi-dimensional feedback.

---

## 🌟 Key Features

### 1. Multi-Format Interview Practice
- **DSA Round (Live Coding)**: A LeetCode-style side-by-side workspace featuring:
  - **Easy & Medium Questions**: Tailored dynamically based on the target company (e.g., tougher questions for Google vs. standard for other companies).
  - **Interactive Monaco Editor**: Upgraded to size 15 font with tabbed multi-question support so candidates can switch between tasks without losing draft code.
  - **Draggable Split Resizer**: A fluid divider splitter allowing dynamic width adjustments between the description and code panel.
  - **AI-Powered "Run Code" Drawer**: Submit and compile code against automated test suites via an AI-driven sandbox execution console.
- **Technical, HR, and Behavioural Rounds**: Immersive verbal-only conversational interviews guided by **Liza**, the AI interviewer.

### 2. Intelligent Behavioral & Speech Analysis
- **Eye Contact Tracking**: Utilizes Google MediaPipe's Face Landmarker model to analyze gaze directions and score how effectively the candidate maintains eye contact.
- **Gesture & Posture Analysis**: Utilizes MediaPipe Pose Landmarker models to monitor hand gestures, fidgeting, and overall body language.
- **Fluency & Filler Word Detection**: Transcribes candidate voice responses in real time using OpenAI Whisper, analyzing speaking speed, pause durations, and counting filler phrases (e.g., *um, uh, like, you know*).
- **Speech Synthesis**: Responsive real-time audio generation powered by Edge TTS for life-like interaction.

### 3. Analytics Dashboard
- Comprehensive metrics charting fluency, eye contact, gesture usage, communication structure, code quality, and optimization approach.
- In-depth soft-skill and technical code quality summaries, highlighting specific highlights and direct areas for optimization.

### 4. Interactive UX Refinements
- **Scroll-Hide Navbar**: The top header hides automatically on scroll-down to save screen space, sliding back into view on scroll-up/return-to-top.
- **Active Focus Layout**: Once an interview starts, the navbar is hidden completely, and the workspace scales to full-width (`98vw`) to focus entirely on the session.

---

## 🛠️ Technology Stack

### Frontend
- **Framework**: Next.js (App Router, React)
- **Styling**: Vanilla CSS (Premium Glassmorphism & High-Density Dark Mode)
- **Code Editor**: Monaco Editor (Next.js wrappers)
- **Icons**: Lucide React

### Backend
- **Framework**: FastAPI (Python 3.13)
- **Database**: SQLAlchemy ORM (SQLite DB setup with automatic migration scripts)
- **Speech-to-Text**: OpenAI Whisper (`small` model for fast post-interview reports, `medium` model for live conversational STT)
- **Computer Vision**: Google MediaPipe (Face & Pose Landmarker task architectures) & OpenCV
- **Audio Extraction**: MoviePy & FFmpeg CLI integrations
- **AI Core**: Google Gemini LLM API (dynamic dialogue generation & code validation)
- **TTS Core**: Microsoft Edge TTS (`en-US-JennyNeural`)

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

---

## 📂 Key Directory Structures

```
Confidometer/
├── backend/
│   ├── app/
│   │   ├── models/       # SQLAlchemy models (User, Speech)
│   │   ├── resources/    # Face/Pose Landmarker models
│   │   ├── routes/       # FastAPI endpoints (auth, upload, analysis, agent)
│   │   ├── services/     # AI, computer vision (eye/gesture), and scoring pipelines
│   │   └── utils/        # Audio/video processing tools
│   ├── main.py           # Application entrypoint & migrations
│   └── requirements.txt  # Python requirements
├── frontend/
│   ├── app/              # Next.js page routers (upload, dashboard, history)
│   ├── components/       # Custom React controls (Navbar, Autocomplete, etc.)
│   ├── styles/           # Global and layout styles
│   └── package.json      # React dependencies
└── README.md
```