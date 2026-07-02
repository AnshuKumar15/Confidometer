import whisper
from moviepy import VideoFileClip
import os
import subprocess

import imageio_ffmpeg

# Load model once (important)
model = whisper.load_model("base", device="cpu") # loads wishper base model and keeps it in memory

#extracts audio and sends it to output_path
def extract_audio(video_path: str, output_path: str):
    try:
        clip = VideoFileClip(video_path)
        try:
            if clip.audio is None:
                raise ValueError(f"No audio track found in video: {video_path}")
            clip.audio.write_audiofile(output_path)
            return
        finally:
            clip.close()
    except Exception as moviepy_error:
        # Some browser-recorded webm files have missing duration metadata.
        print(f"[WARN] MoviePy audio extraction failed, trying ffmpeg fallback: {moviepy_error}")

    ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
    cmd = [
        ffmpeg_exe,
        "-y",
        "-i",
        video_path,
        "-vn",
        "-acodec",
        "pcm_s16le",
        "-ar",
        "16000",
        "-ac",
        "1",
        output_path,
    ]

    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(
            f"ffmpeg fallback failed for {video_path}: {result.stderr.strip() or result.stdout.strip()}"
        )

#takes the output path and converts the audio to text
def transcribe_audio(audio_path: str):
    result = model.transcribe(audio_path)
    return result["text"]