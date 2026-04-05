from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.models.speech import Speech
from app.services.scoring import calculate_confidence_score
from app.utils.audio import extract_audio, transcribe_audio
from app.services.filler import count_fillers
from app.services.voice import analyze_voice
from app.services.eye import analyze_eye_contact
import os
import traceback
from app.services.gesture import analyze_gesture

def process_speech(speech_id: int):

    db: Session = SessionLocal()
    speech = None

    try:
        speech = db.query(Speech).filter(Speech.id == speech_id).first()

        if not speech:
            return

        # Extract string value from SQLAlchemy Column
        video_path: str = str(speech.video_path)

        # Handle different formats safely
        base, _ = os.path.splitext(video_path)
        audio_path = base + ".wav"

        print(f"[INFO] Processing speech ID: {speech_id}")
        print(f"[INFO] Extracting audio...")

        # 1️⃣ Extract audio
        extract_audio(video_path, audio_path)

        print(f"[INFO] Transcribing audio...")

        # 2️⃣ Transcribe using Whisper
        transcript_result = transcribe_audio(audio_path)
        # Ensure transcript is a string
        transcript: str = transcript_result if isinstance(transcript_result, str) else ""

        print(f"[INFO] Transcript: {transcript}")

        # 3️⃣ Count filler words
        filler_count = count_fillers(transcript)

        print(f"[INFO] Filler count: {filler_count}")

        # 4️⃣ Voice Analysis
        print(f"[INFO] Running voice analysis...")

        voice_metrics = analyze_voice(audio_path)

        duration = voice_metrics["duration_sec"]
        silence_ratio = voice_metrics["silence_ratio"]
        pitch_std = voice_metrics["pitch_std"]

        # Convert to score (simple heuristic)
        voice_stability_score = max(
            0.0,
            100 - (pitch_std * 0.5 + silence_ratio * 100)
        )

        # Optional: speaking speed
        word_count = len(transcript.split())
        minutes = duration / 60 if duration > 0 else 1
        words_per_minute = word_count / minutes if minutes > 0 else 0

        print(f"[INFO] Voice stability: {voice_stability_score}")
        print(f"[INFO] Words per minute: {words_per_minute}")

        # 5️⃣ Temporary placeholders (next step: replace with CV models)
        print("[INFO] Running eye contact analysis...")

        eye_contact_percentage = analyze_eye_contact(video_path)

        print(f"[INFO] Eye contact: {eye_contact_percentage}")
        print("[INFO] Running gesture analysis...")

        gesture_frequency = analyze_gesture(video_path)

        print(f"[INFO] Gesture score: {gesture_frequency}")

        # 6️⃣ Final Confidence Score
        confidence_score = calculate_confidence_score(
            filler_count=filler_count,
            eye_contact=eye_contact_percentage,
            gesture=gesture_frequency,
            voice=voice_stability_score
        )

        # 7️⃣ Save results
        speech.filler_count = int(filler_count)  # type: ignore
        speech.eye_contact_percentage = float(eye_contact_percentage)  # type: ignore
        speech.gesture_frequency = float(gesture_frequency)  # type: ignore
        speech.voice_stability_score = float(voice_stability_score)  # type: ignore
        speech.confidence_score = float(confidence_score)  # type: ignore
        speech.status = "completed"  # type: ignore

        db.commit()

        print(f"[SUCCESS] Processing complete for speech ID: {speech_id}")

    except Exception as e:
        print(f"[ERROR] Processing failed: {str(e)}")
        print(traceback.format_exc())

        try:
            # If failure happens before `speech` is fetched, load it and mark failed
            if speech is None:
                speech = db.query(Speech).filter(Speech.id == speech_id).first()

            if speech:
                speech.status = "failed"  # type: ignore
                db.commit()
        except Exception as db_error:
            print(f"[ERROR] Failed to persist failed status: {db_error}")

    finally:
        db.close()