from moviepy import VideoFileClip
import os
import subprocess
import tempfile
import threading
import imageio_ffmpeg

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

def transcribe_audio(audio_path: str) -> str:
    # Try Groq API first if available
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
                return transcription.text
        except Exception as groq_err:
            print(f"[WARN] Groq API transcription failed: {groq_err}")
            if os.getenv("GROQ_API_KEY"):
                raise RuntimeError(f"Groq Whisper STT API error: {groq_err}")
            print("[INFO] Falling back to local Whisper...")

    # Fallback to local Whisper
    active_model = get_model_batch()
    if active_model is None:
        active_model = get_model_stt()
    if active_model is None:
        raise RuntimeError("No Whisper model is loaded")
    with _whisper_lock:
        result = active_model.transcribe(
            audio_path,
            initial_prompt="Um, uh, erm, like, so, basically, you know, at the end of the day.",
            beam_size=1,           # Fast greedy search
            temperature=0.0,       # deterministic
            condition_on_previous_text=True,
            language="en",
        )
    return result["text"]

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

        # Try Groq API for sub-100ms real-time chunk transcription
        if groq_client:
            try:
                with open(tmp_wav.name, "rb") as file:
                    transcription = groq_client.audio.transcriptions.create(
                        file=("chunk.wav", file.read()),
                        model="whisper-large-v3-turbo",
                        prompt="Interview response. Natural conversational English.",
                        response_format="verbose_json",
                        language="en",
                        temperature=0.0
                    )
                    text = getattr(transcription, "text", "") or ""
                    raw_segments = getattr(transcription, "segments", []) or []
                    segments = []
                    for seg in raw_segments:
                        seg_dict = seg if isinstance(seg, dict) else seg.__dict__ if hasattr(seg, "__dict__") else {}
                        segments.append({
                            "text": seg_dict.get("text", ""),
                            "avg_logprob": seg_dict.get("avg_logprob", 0.0),
                            "no_speech_prob": seg_dict.get("no_speech_prob", 0.0),
                        })
                    return {
                        "text": text.strip(),
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
                no_speech_threshold=0.5,
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
        for f in [tmp_input, tmp_wav]:
            if f and os.path.exists(f.name):
                try:
                    os.remove(f.name)
                except OSError:
                    pass