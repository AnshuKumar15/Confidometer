FROM python:3.10-slim

# Prevent Python from writing .pyc files and enable unbuffered logging
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Install system dependencies required for OpenCV, MediaPipe, and ffmpeg (for Whisper/video processing)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    libgl1 \
    libglib2.0-0 \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Set the working directory
WORKDIR /app

# Copy dependency definition and install Python packages
COPY requirements.txt .
RUN pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend application files
COPY app/ ./app/

# Pre-download and cache MediaPipe landmarker models (.task files) during build
RUN python -m app.utils.download_models

# Only pre-download local Whisper models if NOT using Groq API (saves ~2GB image size + build time)
# Uncomment the line below if you want local Whisper as a fallback:
# RUN python -c "import whisper; whisper.load_model('small', device='cpu')"

# Use /data for persistent file storage (Hugging Face Spaces provides this volume)
RUN mkdir -p /data/uploads
ENV UPLOAD_DIR=/data/uploads

# Expose FastAPI port (Hugging Face expects 7860, Render uses 10000, Koyeb uses 8000)
EXPOSE 7860

# Start FastAPI application with dynamic PORT fallback
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-7860}"]
