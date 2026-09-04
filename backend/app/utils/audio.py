from moviepy import VideoFileClip
import os
import wave
import subprocess
import tempfile
import threading
import imageio_ffmpeg
from app.utils.vad import is_speech_chunk
from app.utils.hallucination_filter import is_hallucination, clean_transcript_text

# Check for Groq API Key
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
groq_client = None

if GROQ_API_KEY:
    try:
        from groq import Groq
        groq_client = Groq(api_key=GROQ_API_KEY)
        print("[INFO] Groq API client initialized successfully for ultra-fast Whisper STT.")
    except Exception as e:
        print(f"[WARN] Failed to initialize Groq client ({e}). Will use local Whisper fallback.")

# Lazy local whisper models fallback
whisper = None
_whisper_lock = threading.Lock()
_model_stt = None
_model_batch = None

def _ensure_whisper_imported():
    global whisper
    if whisper is None:
        import whisper as _w
        whisper = _w

def get_model_batch():
    global _model_batch, _model_stt
    if _model_batch is None:
        try:
            _ensure_whisper_imported()
            print("[INFO] Loading Whisper 'small' model for batch processing...")
            _model_batch = whisper.load_model("small", device="cpu")
            print("[INFO] Whisper 'small' model loaded successfully for batch processing.")
        except Exception as e:
            print(f"[WARN] Failed to load Whisper 'small' model ({e}). Falling back to 'tiny'...")
            try:
                _ensure_whisper_imported()
                _model_batch = whisper.load_model("tiny", device="cpu")
                print("[INFO] Whisper 'tiny' model loaded successfully for batch processing.")
            except Exception as e_tiny:
                print(f"[ERROR] Failed to load any model for batch processing: {e_tiny}")
    return _model_batch

def get_model_stt():
    global _model_stt
    if _model_stt is None:
        print("[INFO] Using 'small' model for real-time STT (reusing batch model).")
        _model_stt = get_model_batch()
    return _model_stt

import wave
import struct

def _create_silent_wav(output_path: str, duration_sec: float = 1.0, sr: int = 16000):
    """Create a minimal silent WAV file to prevent pipeline crashes when video lacks audio."""
    try:
        with wave.open(output_path, "wb") as wav_file:
            wav_file.setnchannels(1)
            wav_file.setsampwidth(2)
            wav_file.setframerate(sr)
            num_samples = int(sr * duration_sec)
            wav_file.writeframes(struct.pack(f"<{num_samples}h", *([0] * num_samples)))
    except Exception as e:
        print(f"[WARN] Could not create silent fallback WAV: {e}")

def extract_audio(video_path: str, output_path: str):
    """
    Extract 16kHz mono audio from video file using ffmpeg directly (fast & low memory).
    Falls back to a silent WAV file if the video contains no audio track.
    """
    if not os.path.exists(video_path) or os.path.getsize(video_path) == 0:
        print(f"[WARN] Video file missing or empty ({video_path}). Generating silent placeholder.")
        _create_silent_wav(output_path)
        return

    # 1. Primary: Direct ffmpeg extraction (sub-second, <10MB RAM)
    try:
        ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
        cmd = [
            ffmpeg_exe,
            "-y",
            "-i", video_path,
            "-vn",
            "-acodec", "pcm_s16le",
            "-ar", "16000",
            "-ac", "1",
            output_path,
        ]
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        if result.returncode == 0 and os.path.exists(output_path) and os.path.getsize(output_path) > 44:
            return
        print(f"[WARN] Direct ffmpeg extraction non-zero or empty: {result.stderr[:200]}")
    except Exception as ffmpeg_err:
        print(f"[WARN] Direct ffmpeg extraction failed: {ffmpeg_err}")

    # 2. Secondary fallback: MoviePy
    try:
        clip = VideoFileClip(video_path)
        try:
            if clip.audio is not None:
                clip.audio.write_audiofile(output_path, fps=16000, nbytes=2, codec='pcm_s16le', logger=None)
                if os.path.exists(output_path) and os.path.getsize(output_path) > 44:
                    return
        finally:
            clip.close()
    except Exception as moviepy_error:
        print(f"[WARN] MoviePy extraction failed: {moviepy_error}")

    # 3. Final fallback: Silent WAV so downstream pipeline never crashes
    print(f"[INFO] Generating silent WAV fallback for {video_path}")
    _create_silent_wav(output_path)


def transcribe_audio(audio_path: str) -> str:
    """Transcribe audio with Groq Whisper API or local Whisper fallback."""
    if not os.path.exists(audio_path) or os.path.getsize(audio_path) < 100:
        return ""

    # 1. Try Groq API first if client exists
    if groq_client:
        try:
            print("[INFO] Transcribing full audio via Groq Whisper API (whisper-large-v3-turbo)...")
            with open(audio_path, "rb") as file:
                transcription = groq_client.audio.transcriptions.create(
                    file=(os.path.basename(audio_path), file.read()),
                    model="whisper-large-v3-turbo",
                    prompt="Um, uh, erm, like, so, basically, you know, at the end of the day.",
                    response_format="json",
                    language="en",
                    temperature=0.0
                )
                return transcription.text or ""
        except Exception as groq_err:
            print(f"[WARN] Groq API transcription failed: {groq_err}. Falling back...")

    # 2. Fallback to local Whisper if available
    try:
        active_model = get_model_batch()
        if active_model is None:
            active_model = get_model_stt()
        if active_model is not None:
            with _whisper_lock:
                result = active_model.transcribe(
                    audio_path,
                    initial_prompt="Um, uh, erm, like, so, basically, you know, at the end of the day.",
                    beam_size=1,
                    temperature=0.0,
                    condition_on_previous_text=True,
                    language="en",
                )
            return result.get("text", "")
    except Exception as local_whisper_err:
        print(f"[WARN] Local Whisper transcription failed: {local_whisper_err}")

    # Return empty string if transcription couldn't be performed
    return ""

def transcribe_chunk(audio_bytes: bytes) -> dict:
    """
    Transcribe a raw audio chunk (webm/wav bytes) for real-time STT.
    Uses Groq Whisper API if available for sub-100ms speed, or falls back to local Whisper.
    """
    tmp_input = None
    tmp_wav = None
    try:
        upload_dir = os.environ.get("UPLOAD_DIR", "uploads")
        os.makedirs(upload_dir, exist_ok=True)
        tmp_input = tempfile.NamedTemporaryFile(
            delete=False, suffix=".webm", dir=upload_dir
        )
        tmp_input.write(audio_bytes)
        tmp_input.close()

        tmp_wav = tempfile.NamedTemporaryFile(
            delete=False, suffix=".wav", dir=upload_dir
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

        # 1. Quick audio energy check (silence gate)
        try:
            import audioop
            with wave.open(tmp_wav.name, "rb") as wf:
                raw_frames = wf.readframes(wf.getnframes())
                rms = audioop.rms(raw_frames, 2)
            if rms < 200:  # Gated digital silence threshold
                return {"text": "", "segments": [], "language": "en"}
        except Exception:
            pass

        # 2. Multi-feature acoustic Voice Activity Detection (RMS + ZCR + Spectral Flatness)
        if not is_speech_chunk(tmp_wav.name):
            return {"text": "", "segments": [], "language": "en"}

        # Try Groq API for sub-100ms real-time chunk transcription
        if groq_client:
            try:
                with open(tmp_wav.name, "rb") as file:
                    transcription = groq_client.audio.transcriptions.create(
                        file=("chunk.wav", file.read()),
                        model="whisper-large-v3-turbo",
                        response_format="verbose_json",
                        language="en",
                        temperature=0.0
                    )
                    text = getattr(transcription, "text", "") or ""
                    raw_segments = getattr(transcription, "segments", []) or []
                    segments = []
                    for seg in raw_segments:
                        seg_dict = seg if isinstance(seg, dict) else seg.__dict__ if hasattr(seg, "__dict__") else {}
                        no_speech = seg_dict.get("no_speech_prob", 0.0)
                        avg_logprob = seg_dict.get("avg_logprob", 0.0)
                        # Filter out silent/hallucinated segments with tightened bounds
                        if no_speech > 0.4 or avg_logprob < -1.0:
                            continue
                        segments.append({
                            "text": seg_dict.get("text", ""),
                            "avg_logprob": avg_logprob,
                            "no_speech_prob": no_speech,
                        })
                    
                    if not segments:
                        return {"text": "", "segments": [], "language": "en"}

                    filtered_text = " ".join(s["text"].strip() for s in segments if s["text"].strip())
                    filtered_text = clean_transcript_text(filtered_text)

                    # Post-transcription hallucination validation
                    if is_hallucination(filtered_text):
                        return {"text": "", "segments": [], "language": "en"}

                    return {
                        "text": filtered_text.strip(),
                        "segments": segments,
                        "language": getattr(transcription, "language", "en") or "en",
                    }
            except Exception as groq_err:
                print(f"[WARN] Groq chunk transcription failed ({groq_err}), falling back to local Whisper...")

        # Fallback to local Whisper
        active_model = get_model_stt()
        if active_model is None:
            active_model = get_model_batch()
        if active_model is None:
            raise RuntimeError("No Whisper model is loaded")
        with _whisper_lock:
            result = active_model.transcribe(
                tmp_wav.name,
                beam_size=1,
                temperature=0.0,
                language="en",
                condition_on_previous_text=False,
                no_speech_threshold=0.4,
            )

        local_text = clean_transcript_text(result.get("text", "").strip())
        if is_hallucination(local_text):
            return {"text": "", "segments": [], "language": "en"}

        return {
            "text": local_text,
            "segments": [
                {
                    "text": seg.get("text", ""),
                    "avg_logprob": seg.get("avg_logprob", -1.0),
                    "no_speech_prob": seg.get("no_speech_prob", 0.0),
                }
                for seg in result.get("segments", [])
                if seg.get("no_speech_prob", 0.0) <= 0.4 and seg.get("avg_logprob", -1.0) >= -1.0
            ],
            "language": result.get("language", "en"),
        }

    except Exception as e:
        print(f"[ERROR] transcribe_chunk failed: {e}")
        return {"text": "", "segments": [], "language": "en"}

    finally:
        for f in [tmp_input, tmp_wav]:
            if f and os.path.exists(f.name):
                try:
                    os.remove(f.name)
                except OSError:
                    pass