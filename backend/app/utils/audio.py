import whisper
from moviepy import VideoFileClip
import os
import subprocess
import tempfile

import imageio_ffmpeg

# Load models lazily
_model_stt = None
_model_batch = None

def get_model_batch():
    global _model_batch, _model_stt
    if _model_batch is None:
        try:
            print("[INFO] Loading Whisper 'small' model for batch processing...")
            _model_batch = whisper.load_model("small", device="cpu")
            print("[INFO] Whisper 'small' model loaded successfully for batch processing.")
        except Exception as e:
            print(f"[WARN] Failed to load Whisper 'small' model ({e}). Falling back to 'tiny'...")
            try:
                _model_batch = whisper.load_model("tiny", device="cpu")
                print("[INFO] Whisper 'tiny' model loaded successfully for batch processing.")
            except Exception as e_tiny:
                print(f"[ERROR] Failed to load any model for batch processing: {e_tiny}")
    return _model_batch

def get_model_stt():
    global _model_stt, _model_batch
    if _model_stt is None:
        try:
            print("[INFO] Loading Whisper 'medium' model for real-time STT...")
            _model_stt = whisper.load_model("medium", device="cpu")
            print("[INFO] Whisper 'medium' model loaded successfully for real-time STT.")
        except Exception as e:
            print(f"[WARN] Failed to load Whisper 'medium' model ({e}). Falling back to 'small'...")
            # Reuse model_batch as fallback to avoid loading another copy of 'small'
            _model_stt = get_model_batch()
            print("[INFO] Using batch model as fallback for real-time STT.")
    return _model_stt

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
    # Use model_batch (small/tiny) for post-interview processing speed
    active_model = get_model_batch()
    if active_model is None:
        active_model = get_model_stt()
    if active_model is None:
        raise RuntimeError("No Whisper model is loaded")
    result = active_model.transcribe(
        audio_path,
        initial_prompt="Um, uh, erm, like, so, basically, you know, at the end of the day.",
        beam_size=5,           # wider beam search for more accurate decoding
        best_of=5,             # consider top-5 candidates
        temperature=0.0,       # deterministic — no sampling randomness
        condition_on_previous_text=True,  # use context for coherence
        language="en",         # lock to English to avoid language detection overhead
    )
    return result["text"]


def transcribe_chunk(audio_bytes: bytes) -> dict:
    """
    Transcribe a raw audio chunk (webm/wav bytes) for real-time STT.

    Accepts raw audio bytes from the frontend WebSocket, writes to a temp file,
    runs Whisper, and returns structured results including text and confidence.

    Returns:
        dict with keys:
        - "text": transcribed text string
        - "segments": list of segment dicts with avg_logprob for confidence
        - "language": detected language
    """
    tmp_input = None
    tmp_wav = None
    try:
        # Write incoming audio bytes to a temp file
        tmp_input = tempfile.NamedTemporaryFile(
            delete=False, suffix=".webm", dir="uploads"
        )
        tmp_input.write(audio_bytes)
        tmp_input.close()

        # Convert to WAV 16kHz mono using ffmpeg (Whisper's expected format)
        tmp_wav = tempfile.NamedTemporaryFile(
            delete=False, suffix=".wav", dir="uploads"
        )
        tmp_wav.close()

        ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
        cmd = [
            ffmpeg_exe, "-y",
            "-i", tmp_input.name,
            "-vn",
            "-acodec", "pcm_s16le",
            "-ar", "16000",
            "-ac", "1",
            tmp_wav.name,
        ]
        conv_result = subprocess.run(cmd, capture_output=True, text=True)
        if conv_result.returncode != 0:
            print(f"[WARN] ffmpeg chunk conversion failed: {conv_result.stderr}")
            return {"text": "", "segments": [], "language": "en"}

        # Run Whisper on the chunk
        # Use model_stt (medium) for live real-time transcription latency test
        active_model = get_model_stt()
        if active_model is None:
            active_model = get_model_batch()
        if active_model is None:
            raise RuntimeError("No Whisper model is loaded")
        result = active_model.transcribe(
            tmp_wav.name,
            beam_size=5,
            best_of=3,             # slightly fewer candidates for speed in real-time
            temperature=0.0,
            language="en",
            condition_on_previous_text=False,  # each chunk is independent
            no_speech_threshold=0.5,           # filter out non-speech noise
            initial_prompt="Interview response. Natural conversational English.",
        )

        return {
            "text": result.get("text", "").strip(),
            "segments": [
                {
                    "text": seg.get("text", ""),
                    "avg_logprob": seg.get("avg_logprob", -1.0),
                    "no_speech_prob": seg.get("no_speech_prob", 0.0),
                }
                for seg in result.get("segments", [])
            ],
            "language": result.get("language", "en"),
        }

    except Exception as e:
        print(f"[ERROR] transcribe_chunk failed: {e}")
        return {"text": "", "segments": [], "language": "en"}

    finally:
        # Clean up temp files
        for f in [tmp_input, tmp_wav]:
            if f and os.path.exists(f.name):
                try:
                    os.remove(f.name)
                except OSError:
                    pass