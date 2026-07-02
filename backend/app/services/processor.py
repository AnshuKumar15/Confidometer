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

        # Calculate voice stability score with better normalization
        # Voice stability indicates how consistent and natural the voice sounds.
        # We compute two components (0-100): pitch stability and silence management,
        # then combine them with a weighted average.

        # 1) Pitch stability component (0-100)
        # Typical speech pitch_std (Hz) often falls in a moderate range; map ranges to scores
        if pitch_std < 10:
            # Very little variation (monotone)
            pitch_score = 50.0
        elif pitch_std < 50:
            # Good/typical range
            pitch_score = 100.0 - (pitch_std - 30.0) * 1.5
        elif pitch_std < 100:
            # Increasing variation, gradually penalize
            pitch_score = 100.0 - (pitch_std - 50.0) * 0.8
        else:
            # Very high variation
            pitch_score = max(20.0, 100.0 - (pitch_std - 100.0) * 0.5)

        # Clamp pitch_score
        pitch_score = max(0.0, min(100.0, float(pitch_score)))

        # 2) Silence management component (0-100)
        # Natural pause ratio is usually between ~0.15 and 0.35 (15%-35%).
        if silence_ratio < 0.05:
            silence_score = 60.0
        elif silence_ratio < 0.15:
            silence_score = 75.0
        elif silence_ratio < 0.35:
            silence_score = 95.0
        elif silence_ratio < 0.50:
            silence_score = 85.0
        else:
            silence_score = max(30.0, 85.0 - (silence_ratio * 100.0 - 50.0))

        silence_score = max(0.0, min(100.0, float(silence_score)))

        # 3) Combine: weight pitch more than silence
        voice_stability_score = (pitch_score * 0.6 + silence_score * 0.4)
        voice_stability_score = max(0.0, min(100.0, float(voice_stability_score)))

        # Debugging detail to help tune on real recordings
        print(f"[DEBUG] Pitch std: {pitch_std:.2f} Hz => pitch_score: {pitch_score:.1f}")
        print(f"[DEBUG] Silence ratio: {silence_ratio:.2%} => silence_score: {silence_score:.1f}")

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