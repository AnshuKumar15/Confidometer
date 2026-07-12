# How to Explain the Confidometer Deployment in an Interview

When explaining this deployment in an interview, you want to show that you didn't just host a website—you made **deliberate system design and architectural choices** to handle the project's heavy AI/ML requirements. 

Here is a structured guide on how to talk about this deployment like a seasoned software engineer.

---

## 1. High-Level Summary (The Elevator Pitch)
> *"I deployed the application on a containerized architecture using **Docker Compose** on an **AWS EC2 virtual machine**, fronted by **Nginx** acting as a reverse proxy. The entire stack—consisting of a Next.js frontend, a FastAPI backend, and a PostgreSQL database—is orchestrated inside self-contained containers to ensure high portability, simple scaling, and consistent environments."*

---

## 2. Why this Architecture? (The "Why EC2 and Docker" Question)
Interviewers love to ask: *"Why didn't you just deploy the frontend to Vercel and the backend to serverless (like AWS Lambda)?"*

**Your Answer:**
1. **AI/ML Package Size Limits:** 
   * *"Our backend uses **PyTorch**, **OpenAI Whisper**, and **Google MediaPipe**. PyTorch alone is massive, and the Whisper 'small' model is 460MB. Serverless platforms like Vercel or AWS Lambda have strict package size limits (usually 50MB to 250MB) and memory caps that make loading these models impossible."*
2. **Cold Starts and Execution Timeouts:** 
   * *"Transcribing audio/video and running pose detection takes time. Serverless functions would hit execution timeouts (typically 10–30 seconds). A dedicated EC2 instance allows long-running CPU/GPU processes without timeouts."*
3. **Same-Origin/CORS Resolution:**
   * *"By hosting the frontend and backend on the same EC2 instance behind an Nginx reverse proxy, I resolved CORS (Cross-Origin Resource Sharing) issues completely. The browser makes requests to the same domain/IP, which reduces latency and removes the need for complex cross-origin headers."*

---

## 3. The Architecture Breakdown (How it Works)

You can describe the architecture using this component-by-component flow:

```
                  ┌──────────────────────────────────────────────┐
                  │                 AWS EC2 VM                   │
                  │                                              │
                  │       ┌──────────────────────────────┐       │
                  │       │     Nginx (Port 80/HTTP)     │       │
                  │       └──────────────┬───────────────┘       │
                  │                      │                       │
                  │         ┌────────────┴────────────┐          │
                  │         ▼                         ▼          │
                  │  ┌──────────────┐          ┌──────────────┐  │
                  │  │   Next.js    │          │   FastAPI    │  │
                  │  │  (Port 3000) │          │  (Port 8000) │  │
                  │  └──────────────┘          └──────┬───────┘  │
                  │                                   │          │
                  │                            ┌──────▼───────┐  │
                  │                            │  PostgreSQL  │  │
                  │                            │  (Port 5432) │  │
                  │                            └──────────────┘  │
                  └──────────────────────────────────────────────┘
```

1. **Nginx (The Entrypoint):**
   * Runs on port 80. It intercepts all incoming requests. 
   * If a user requests `/`, Nginx routes it to the **Next.js frontend container** (port 3000).
   * If the client requests `/api/*`, Nginx rewrites the URL (stripping `/api`) and forwards it to the **FastAPI backend container** (port 8000).
2. **Next.js Frontend Container:**
   * Built as a production server. 
   * To keep the deployment environment-agnostic, I configured the environment variable `NEXT_PUBLIC_API_BASE` to `/api` (a relative path) during the Docker build. This means the frontend dynamically inherits the host's IP/domain without hardcoding.
3. **FastAPI Backend Container:**
   * Runs Python. 
   * **Build-time Optimization:** To prevent performance lags during runtime, I wrote the Dockerfile to pre-download and cache the MediaPipe `.task` models and the Whisper `small` model during the image build phase.
4. **PostgreSQL Database Container:**
   * Runs Postgres Alpine. Data is persisted securely using **Docker Named Volumes**, ensuring that database records (interviews, users) are not lost if the containers restart or are rebuilt.

---

## 4. Problem-Solving Story (Excellent for "Tell me about a challenge you faced")
Interviewers want to see how you troubleshoot. You can tell the story of the deployment:

> *"During the initial deployment on a Free Tier EC2 instance, I faced two main constraints: **resource limits** and **disk space leaks**."*
>
> *"First, because the instance only had 1GB of RAM, PyTorch and Whisper caused the server to crash due to Out-Of-Memory (OOM) exceptions. I resolved this by allocating **4GB of Swap Space (virtual memory)** on the SSD, allowing the server to handle heavy audio transcription loads without crashing."*
>
> *"Second, during container rebuilds, Docker build caches quickly exhausted the server's disk space. I resolved this by installing **Docker Compose V2** to handle build steps more efficiently, running system prunes to release unused cache layers, and optimizing the backend Dockerfile to use cache layers for heavy packages like PyTorch."*

---

## 5. Key Buzzwords to Use
* **Containerization & Orchestration:** Using Docker and Docker Compose to bundle and run services.
* **Reverse Proxy:** Using Nginx to direct traffic and resolve CORS.
* **Stateless vs. Stateful:** The backend and frontend are stateless (can be recreated anytime), while the database is stateful (persisted using Docker volumes).
* **Swap Allocation:** Allocating virtual memory to support heavy memory workloads on constrained hardware.

---

## 6. How We Update the App (Manual CI/CD Flow)
If asked how updates are shipped to the server, here is the clean, manual flow we use:
1. **Push Changes to GitHub:** Push code changes from the local development workspace to the remote repository:
   ```bash
   git add .
   git commit -m "Your update message"
   git push origin main
   ```
2. **Access the EC2 Server:** Log into the EC2 instance using the secure SSH key:
   ```bash
   ssh -i "/path/to/key.pem" ubuntu@<EC2-IP>
   ```
3. **Pull the Updates:** Navigate to the repository directory on the server and pull the fresh code:
   ```bash
   cd /home/ubuntu/confidometer
   git pull origin main
   ```
4. **Rebuild the Container Stack:** Run Docker Compose to rebuild only the containers with changes:
   ```bash
   docker compose up --build -d
   ```
   *(By running `docker compose up --build -d`, Docker Compose uses cached layers for unchanged services and dependencies, resulting in a fast, low-downtime update.)*

