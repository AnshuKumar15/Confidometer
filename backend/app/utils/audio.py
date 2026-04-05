import whisper
from moviepy import VideoFileClip
import os

# Load model once (important)
model = whisper.load_model("base") # loads wishper base model and keeps it in memory

#extracts audio and sends it to output_path
def extract_audio(video_path: str, output_path: str):
    clip = VideoFileClip(video_path)
    try:
        if clip.audio is None:
            raise ValueError(f"No audio track found in video: {video_path}")
        clip.audio.write_audiofile(output_path)
    finally:
        clip.close()

#takes the output path and converts the audio to text
def transcribe_audio(audio_path: str):
    result = model.transcribe(audio_path)
    return result["text"]