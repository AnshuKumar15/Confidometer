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

# Pre-download and cache Whisper "small" and "medium" models during build to prevent runtime download delays
RUN python -c "import whisper; whisper.load_model('small', device='cpu'); whisper.load_model('medium', device='cpu')"

# Expose FastAPI port
EXPOSE 8000

# Start FastAPI application
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
