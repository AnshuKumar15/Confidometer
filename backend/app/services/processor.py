from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.models.speech import Speech
from app.services.scoring import calculate_confidence_score
from app.utils.audio import extract_audio, transcribe_audio
from app.services.filler import count_fillers
from app.services.voice import analyze_voice
from app.services.eye import analyze_eye_contact
from app.services.llm import analyze_interview_with_llm
import os
import json
import traceback
import math
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import cast, Any
from app.services.gesture import analyze_gesture
from app.utils.scoring_utils import bell_curve_score


def _update_progress(db: Session, speech: Speech, progress: int):
    """Persist progress percentage to database so the frontend can poll it."""
    try:
        speech.progress = progress  # type: ignore
        db.commit()
    except Exception:
        pass


def _audio_pipeline(video_path: str, audio_path: str) -> dict[str, Any]:
    """
    Audio pipeline: extract audio → transcribe → count fillers → voice analysis.
    Runs in its own thread. Returns all audio-derived results.
    """
    print(f"[INFO] [Thread-Audio] Extracting audio...")
    extract_audio(video_path, audio_path)

    print(f"[INFO] [Thread-Audio] Transcribing audio...")
    transcript_result = transcribe_audio(audio_path)
    transcript: str = transcript_result if isinstance(transcript_result, str) else ""
    print(f"[INFO] [Thread-Audio] Transcript: {transcript}")

    filler_count = count_fillers(transcript)
    print(f"[INFO] [Thread-Audio] Filler count: {filler_count}")

    print(f"[INFO] [Thread-Audio] Running voice analysis...")
    voice_metrics = analyze_voice(audio_path)

    return {
        "transcript": transcript,
        "filler_count": filler_count,
        "voice_metrics": voice_metrics,
    }


def _eye_pipeline(video_path: str) -> float:
    """Eye contact analysis. Runs in its own thread."""
    print("[INFO] [Thread-Eye] Running eye contact analysis...")
    result = analyze_eye_contact(video_path)
    print(f"[INFO] [Thread-Eye] Eye contact: {result}")
    return result


def _gesture_pipeline(video_path: str) -> float:
    """Gesture analysis. Runs in its own thread."""
    print("[INFO] [Thread-Gesture] Running gesture analysis...")
    result = analyze_gesture(video_path)
    print(f"[INFO] [Thread-Gesture] Gesture score: {result}")
    return result


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
        _update_progress(db, speech, 5)

        # ──────────────────────────────────────────────────────────
        # PARALLEL PHASE: Run audio, eye contact, and gesture
        # analysis concurrently using threads.
        # These tasks are independent and backed by C/C++ libraries
        # (OpenCV, MediaPipe, Whisper) that release the GIL,
        # enabling true parallel execution on multi-core CPUs.
        # ──────────────────────────────────────────────────────────
        print("[INFO] Starting parallel analysis (audio + eye + gesture)...")

        audio_result: dict[str, Any] = {}
        eye_contact_percentage: float = 0.0
        gesture_frequency: float = 0.0

        with ThreadPoolExecutor(max_workers=3) as executor:
            future_audio = executor.submit(_audio_pipeline, video_path, audio_path)
            future_eye = executor.submit(_eye_pipeline, video_path)
            future_gesture = executor.submit(_gesture_pipeline, video_path)

            futures: dict[Any, str] = {
                future_audio: "audio",
                future_eye: "eye",
                future_gesture: "gesture",
            }

            completed_count = 0
            for future in as_completed(futures):
                name = futures[future]
                try:
                    if name == "audio":
                        audio_result = cast(dict[str, Any], future.result())
                    elif name == "eye":
                        eye_contact_percentage = cast(float, future.result())
                    elif name == "gesture":
                        gesture_frequency = cast(float, future.result())

                    completed_count += 1
                    if completed_count == 1:
                        prog_val = 30
                    elif completed_count == 2:
                        prog_val = 55
                    elif completed_count == 3:
                        prog_val = 70
                    
                    _update_progress(db, speech, prog_val)
                except Exception as exc:
                    print(f"[ERROR] {name} pipeline failed: {exc}")
                    print(traceback.format_exc())

        print("[INFO] Parallel analysis complete.")

        # Extract audio results
        if not audio_result:
            raise RuntimeError("Audio pipeline failed — cannot proceed without transcript")

        transcript = cast(str, audio_result["transcript"])
        filler_count = cast(int, audio_result["filler_count"])
        voice_metrics = cast(dict[str, Any], audio_result["voice_metrics"])

        duration = voice_metrics["duration_sec"]
        silence_ratio = voice_metrics["silence_ratio"]
        pitch_std = voice_metrics["pitch_std"]
        speaking_rate_score = voice_metrics["speaking_rate_score"]

        # Pitch stability: ideal ~35 Hz std (natural variation), width 30
        pitch_score = bell_curve_score(pitch_std, ideal=35.0, width=30.0)
        pitch_score = max(0.0, min(100.0, pitch_score))

        # Silence management: ideal ~25% pause ratio, width 20%
        silence_score = bell_curve_score(silence_ratio, ideal=0.25, width=0.20)
        silence_score = max(0.0, min(100.0, silence_score))

        # Combine: pitch 45%, silence 30%, speaking rate 25%
        voice_stability_score = (
            pitch_score * 0.45 +
            silence_score * 0.30 +
            speaking_rate_score * 0.25
        )
        voice_stability_score = max(0.0, min(100.0, voice_stability_score))

        print(f"[DEBUG] Pitch std: {pitch_std:.2f} Hz => pitch_score: {pitch_score:.1f}")
        print(f"[DEBUG] Silence ratio: {silence_ratio:.2%} => silence_score: {silence_score:.1f}")
        print(f"[DEBUG] Speaking rate score: {speaking_rate_score:.1f}")
        print(f"[INFO] Voice stability: {voice_stability_score:.1f}")
        _update_progress(db, speech, 75)

        # 7️⃣ Final Confidence Score
        confidence_score = calculate_confidence_score(
            filler_count=filler_count,
            eye_contact=eye_contact_percentage,
            gesture=gesture_frequency,
            voice=voice_stability_score,
            speaking_rate=speaking_rate_score
        )

        # 8️⃣ Save raw results
        speech.filler_count = int(filler_count)  # type: ignore
        speech.eye_contact_percentage = float(eye_contact_percentage)  # type: ignore
        speech.gesture_frequency = float(gesture_frequency)  # type: ignore
        speech.voice_stability_score = float(voice_stability_score)  # type: ignore
        speech.confidence_score = float(confidence_score)  # type: ignore

        # 8.5 Compute fidgeting index & speech rate variance for stress metric logging
        fidgeting = min(100.0, max(0.0, float(gesture_frequency) * 1.25))
        speech_var = min(100.0, max(0.0, float(pitch_std) * 0.75))
        speech.fidgeting_index = fidgeting  # type: ignore
        speech.speech_rate_variance = speech_var  # type: ignore

        # If stress mode was active, calculate stress tolerance score
        if speech.stress_mode:
            from app.services.scoring import calculate_stress_tolerance_score
            speech.stress_tolerance_score = float(
                calculate_stress_tolerance_score(
                    fidgeting_index=fidgeting,
                    speech_rate_variance=speech_var,
                    filler_count=filler_count,
                    eye_contact=eye_contact_percentage
                )
            )  # type: ignore

        db.commit()
        _update_progress(db, speech, 80)

        # 9️⃣ LLM-based detailed analysis (reports + sub-scores)
        print("[INFO] Running LLM interview analysis...")
        conversation_history = []
        if speech.conversation_history:
            try:
                conversation_history = json.loads(str(speech.conversation_history))
            except Exception:
                pass

        role_str = str(speech.role) if speech.role else ""
        company_str = str(speech.company_name) if speech.company_name else ""
        interview_type_str = str(speech.interview_type) if speech.interview_type else "technical"
        dsa_code_str = str(speech.dsa_code) if speech.dsa_code else ""
        dsa_question_str = str(speech.dsa_question_details) if speech.dsa_question_details else ""

        analysis = analyze_interview_with_llm(
            role=role_str,
            company_name=company_str,
            conversation_history=conversation_history,
            eye_contact=eye_contact_percentage,
            gesture=gesture_frequency,
            voice=voice_stability_score,
            filler_count=filler_count,
            interview_type=interview_type_str,
            dsa_code=dsa_code_str,
            dsa_question_details=dsa_question_str,
        )
        _update_progress(db, speech, 90)

        # 🔟 Save LLM analysis results
        sub_scores = analysis.get("sub_scores", {})
        speech.eye_contact_score = float(sub_scores.get("eye_contact_score", eye_contact_percentage))  # type: ignore
        speech.technical_knowledge_score = float(sub_scores.get("technical_knowledge_score", 50.0))  # type: ignore
        speech.fluency_score = float(sub_scores.get("fluency_score", 50.0))  # type: ignore
        speech.use_of_words_score = float(sub_scores.get("use_of_words_score", 50.0))  # type: ignore
        speech.filler_words_score = float(sub_scores.get("filler_words_score", max(0, 100 - filler_count * 3)))  # type: ignore
        speech.explanation_quality_score = float(sub_scores.get("explanation_quality_score", 50.0))  # type: ignore

        # Negotiation simulation specific scoring
        if interview_type_str == "negotiation":
            speech.negotiation_score = float(sub_scores.get("negotiation_score", 60.0))  # type: ignore

        # Coding-specific scores (DSA / Technical rounds with code)
        if interview_type_str in ("dsa", "technical") and dsa_code_str:
            speech.code_quality_score = float(sub_scores.get("code_quality_score", 50.0))  # type: ignore
            speech.optimization_score = float(sub_scores.get("optimization_score", 50.0))  # type: ignore
            speech.thinking_process_score = float(sub_scores.get("thinking_process_score", 50.0))  # type: ignore
            speech.communication_score = float(sub_scores.get("communication_score", 50.0))  # type: ignore

        speech.technical_feedback = json.dumps(analysis.get("technical_feedback", []))  # type: ignore
        speech.non_technical_feedback = json.dumps(analysis.get("non_technical_feedback", {}))  # type: ignore
        # Include coding_feedback inside non_technical_feedback if present
        if analysis.get("coding_feedback"):
            try:
                nt = json.loads(speech.non_technical_feedback) if speech.non_technical_feedback else {}
                nt["coding_feedback"] = analysis["coding_feedback"]
                speech.non_technical_feedback = json.dumps(nt)  # type: ignore
            except Exception:
                pass
        speech.short_summary_feedback = analysis.get("short_summary_feedback", "")  # type: ignore

        # ── Prefetch TTS audio for the short summary feedback ──
        try:
            from app.routes.agent import prefetch_tts
            if speech.short_summary_feedback:
                print(f"[INFO] Prefetching TTS audio for speech ID {speech.id} short summary feedback...")
                prefetch_tts(speech.short_summary_feedback)
        except Exception as prefetch_err:
            print(f"[WARN] Failed to prefetch TTS: {prefetch_err}")




        speech.status = "completed"  # type: ignore
        _update_progress(db, speech, 100)
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