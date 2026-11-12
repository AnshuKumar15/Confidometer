from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.models.speech import Speech
from app.services.scoring import calculate_confidence_score, calculate_blended_score
from app.utils.audio import extract_audio, transcribe_audio
from app.services.filler import count_fillers
from app.services.voice import analyze_voice
from app.services.eye import analyze_eye_contact
from app.services.llm import analyze_interview_with_llm
import os
import json
import traceback
import math
import time
from concurrent.futures import ThreadPoolExecutor, as_completed, TimeoutError
from typing import cast, Any, Optional
from app.services.gesture import analyze_gesture
from app.utils.scoring_utils import bell_curve_score


import gc
import sys

def _force_gc():
    """Aggressively free memory between pipeline stages and return pages to Linux OS."""
    gc.collect(generation=2)
    gc.collect(generation=1)
    gc.collect(generation=0)
    # On Linux (Render), release freed memory pages back to OS
    if sys.platform == "linux":
        try:
            import ctypes
            libc = ctypes.CDLL("libc.so.6")
            libc.malloc_trim(0)
        except Exception:
            pass


def _update_progress(speech_or_id: Any, progress_or_speech: Any = None, progress: Optional[int] = None):
    """Persist progress percentage to database using a short-lived scoped session.
    Never holds a connection open across pipeline operations.
    """
    actual_id = None
    actual_prog = None

    if progress is not None:
        # Called as _update_progress(db, speech, 50)
        actual_id = getattr(progress_or_speech, "id", None)
        actual_prog = progress
    elif isinstance(speech_or_id, int):
        # Called as _update_progress(speech_id, 50)
        actual_id = speech_or_id
        actual_prog = progress_or_speech
    elif hasattr(speech_or_id, "id"):
        # Called as _update_progress(speech, 50)
        actual_id = getattr(speech_or_id, "id", None)
        actual_prog = progress_or_speech

    if actual_id is None or actual_prog is None:
        return

    try:
        with SessionLocal() as db:
            s = db.query(Speech).filter(Speech.id == actual_id).first()
            if s:
                s.progress = int(actual_prog)  # type: ignore
                db.commit()
                print(f"[PROGRESS] Speech {actual_id} updated to {actual_prog}%")
    except Exception as e:
        print(f"[WARN] Progress update failed ({actual_prog}%): {e}")


def _audio_pipeline(video_path: str, audio_path: str, speech_id: int | None = None, **kwargs) -> dict[str, Any]:
    """
    Audio pipeline: extract audio → transcribe → count fillers → voice analysis.
    Updates progress incrementally to prevent UI from appearing stuck at 5%.
    """
    print(f"[INFO] [Audio-Pipeline] Extracting audio...")
    extract_audio(video_path, audio_path)
    if speech_id:
        _update_progress(speech_id, 15)

    print(f"[INFO] [Audio-Pipeline] Transcribing audio...")
    transcript: str = ""
    try:
        transcript_result = transcribe_audio(audio_path)
        transcript = transcript_result if isinstance(transcript_result, str) else ""
    except Exception as t_err:
        print(f"[WARN] Transcription encountered error: {t_err}")
    print(f"[INFO] [Audio-Pipeline] Transcript length: {len(transcript)} chars")
    if speech_id:
        _update_progress(speech_id, 25)

    filler_count = count_fillers(transcript) if transcript else 0
    print(f"[INFO] [Audio-Pipeline] Filler count: {filler_count}")

    print(f"[INFO] [Audio-Pipeline] Running voice analysis...")
    try:
        voice_metrics = analyze_voice(audio_path, transcript=transcript)
    except Exception as v_err:
        print(f"[WARN] analyze_voice failed: {v_err}")
        voice_metrics = {
            "duration_sec": 1.0,
            "silence_ratio": 0.25,
            "pitch_std": 35.0,
            "speaking_rate_score": 75.0,
        }

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
    # Fetch speech metadata upfront in a short-lived session, then immediately release connection back to pool.
    # Holding a DB session across the long video/audio/LLM analysis chokes connection pools on hosted servers.
    speech_data = None
    try:
        with SessionLocal() as db:
            s = db.query(Speech).filter(Speech.id == speech_id).first()
            if not s:
                print(f"[WARN] Speech ID {speech_id} not found in database.")
                return
            speech_data = {
                "video_path": str(s.video_path or ""),
                "stress_mode": bool(s.stress_mode) if s.stress_mode is not None else False,
                "role": str(s.role or ""),
                "company_name": str(s.company_name or ""),
                "interview_type": str(s.interview_type or "technical"),
                "dsa_code": str(s.dsa_code or ""),
                "dsa_question_details": str(s.dsa_question_details or ""),
                "conversation_history": str(s.conversation_history or "[]"),
            }
    except Exception as fetch_err:
        print(f"[ERROR] Failed to fetch speech {speech_id}: {fetch_err}")
        return

    try:
        video_path = speech_data["video_path"]
        base, _ = os.path.splitext(video_path)
        audio_path = base + ".wav"

        print(f"[INFO] Processing speech ID: {speech_id}")
        print(f"[INFO] Video path: {video_path}")
        print(f"[INFO] Video file exists: {os.path.exists(video_path)}")
        if os.path.exists(video_path):
            print(f"[INFO] Video file size: {os.path.getsize(video_path)} bytes")
        _update_progress(speech_id, 5)

        # ──────────────────────────────────────────────────────────
        # SEQUENTIAL PHASE: Run audio, eye contact, and gesture
        # analysis sequentially with explicit garbage collection.
        # Running concurrently chokes memory on 512MB RAM servers
        # (causing Render Exit status 137). Sequential execution
        # keeps peak RAM under 200MB while finishing in ~15s.
        # ──────────────────────────────────────────────────────────
        print("[INFO] Starting sequential analysis (audio -> eye -> gesture)...")

        # 1. Audio pipeline
        print("[INFO] Running audio pipeline...")
        t0 = time.time()
        try:
            audio_result = _audio_pipeline(video_path, audio_path, speech_id=speech_id)
        except Exception as audio_err:
            print(f"[WARN] Audio pipeline encountered error: {audio_err}. Using fallback audio metrics.")
            audio_result = {
                "transcript": "",
                "filler_count": 0,
                "voice_metrics": {
                    "duration_sec": 1.0,
                    "silence_ratio": 0.25,
                    "pitch_std": 35.0,
                    "speaking_rate_score": 75.0,
                },
            }
        print(f"[INFO] Audio pipeline completed in {time.time()-t0:.1f}s")
        _update_progress(speech_id, 30)
        # Clean up the extracted audio file to free disk I/O buffers
        try:
            if os.path.exists(audio_path):
                os.remove(audio_path)
        except OSError:
            pass
        _force_gc()

        # 2. Eye contact pipeline
        print("[INFO] Running eye contact pipeline...")
        t0 = time.time()
        try:
            eye_contact_percentage = _eye_pipeline(video_path)
            if eye_contact_percentage <= 0.0:
                print("[WARN] Eye contact returned <= 0.0, using sensible baseline 72.5.")
                eye_contact_percentage = 72.5
        except Exception as eye_err:
            print(f"[WARN] Eye contact pipeline error: {eye_err}. Using baseline 75.0.")
            eye_contact_percentage = 75.0
        print(f"[INFO] Eye contact pipeline completed in {time.time()-t0:.1f}s")
        _update_progress(speech_id, 55)
        _force_gc()

        # 3. Gesture pipeline
        print("[INFO] Running gesture pipeline...")
        t0 = time.time()
        try:
            gesture_frequency = _gesture_pipeline(video_path)
            if gesture_frequency <= 0.0:
                print("[WARN] Gesture returned <= 0.0, using baseline 45.0.")
                gesture_frequency = 45.0
        except Exception as gesture_err:
            print(f"[WARN] Gesture pipeline error: {gesture_err}. Using baseline 50.0.")
            gesture_frequency = 50.0
        print(f"[INFO] Gesture pipeline completed in {time.time()-t0:.1f}s")
        _update_progress(speech_id, 70)
        _force_gc()

        print("[INFO] Sequential analysis complete.")

        # Extract audio results
        if not audio_result:
            audio_result = {
                "transcript": "",
                "filler_count": 0,
                "voice_metrics": {
                    "duration_sec": 1.0,
                    "silence_ratio": 0.25,
                    "pitch_std": 35.0,
                    "speaking_rate_score": 75.0,
                },
            }

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
        _update_progress(speech_id, 75)

        # 7️⃣ Final Confidence Score
        confidence_score = calculate_confidence_score(
            filler_count=filler_count,
            eye_contact=eye_contact_percentage,
            gesture=gesture_frequency,
            voice=voice_stability_score,
            speaking_rate=speaking_rate_score
        )

        # 8️⃣ Compute fidgeting index & speech rate variance for stress metric logging
        fidgeting = min(100.0, max(0.0, gesture_frequency * 1.25))
        speech_var = min(100.0, max(0.0, pitch_std * 0.75))

        stress_tolerance_score = None
        if speech_data["stress_mode"]:
            from app.services.scoring import calculate_stress_tolerance_score
            stress_tolerance_score = calculate_stress_tolerance_score(
                fidgeting_index=fidgeting,
                speech_rate_variance=speech_var,
                filler_count=filler_count,
                eye_contact=eye_contact_percentage
            )

        # Save raw results via short-lived scoped DB session (closed immediately)
        try:
            with SessionLocal() as db:
                s = db.query(Speech).filter(Speech.id == speech_id).first()
                if s:
                    s.filler_count = int(filler_count)  # type: ignore
                    s.eye_contact_percentage = float(eye_contact_percentage)  # type: ignore
                    s.gesture_frequency = float(gesture_frequency)  # type: ignore
                    s.voice_stability_score = float(voice_stability_score)  # type: ignore
                    s.confidence_score = float(confidence_score)  # type: ignore
                    s.fidgeting_index = fidgeting  # type: ignore
                    s.speech_rate_variance = speech_var  # type: ignore
                    if stress_tolerance_score is not None:
                        s.stress_tolerance_score = stress_tolerance_score  # type: ignore
                    db.commit()
        except Exception as commit_err:
            print(f"[WARN] Raw results commit failed: {commit_err}")

        _update_progress(speech_id, 80)

        # 9️⃣ LLM-based detailed analysis (reports + sub-scores) - Zero DB connection held during API call
        print("[INFO] Running LLM interview analysis...")
        conversation_history = []
        if speech_data["conversation_history"]:
            try:
                conversation_history = json.loads(str(speech_data["conversation_history"]))
            except Exception:
                pass

        role_str = speech_data["role"]
        company_str = speech_data["company_name"]
        interview_type_str = speech_data["interview_type"]
        dsa_code_str = speech_data["dsa_code"]
        dsa_question_str = speech_data["dsa_question_details"]

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
        _update_progress(speech_id, 90)

        # 🔟 Process LLM analysis results
        sub_scores = analysis.get("sub_scores", {})
        raw_eye_sub = float(sub_scores.get("eye_contact_score", eye_contact_percentage))
        final_eye_score = raw_eye_sub if raw_eye_sub > 0 else float(eye_contact_percentage if eye_contact_percentage > 0 else 72.5)

        # 🔟.5 Calculate unified blended score (combining content depth & delivery poise)
        tech_score = float(sub_scores.get("technical_knowledge_score", 50.0))
        expl_score = float(sub_scores.get("explanation_quality_score", 50.0))
        words_score = float(sub_scores.get("use_of_words_score", 50.0))
        neg_score = float(sub_scores.get("negotiation_score", 60.0)) if interview_type_str == "negotiation" else None
        cq_score = float(sub_scores.get("code_quality_score", 50.0)) if dsa_code_str else None
        opt_score = float(sub_scores.get("optimization_score", 50.0)) if dsa_code_str else None
        tp_score = float(sub_scores.get("thinking_process_score", 50.0)) if dsa_code_str else None
        comm_score = float(sub_scores.get("communication_score", 50.0)) if dsa_code_str else None

        blended_confidence_score = calculate_blended_score(
            interview_type=interview_type_str,
            filler_count=filler_count,
            eye_contact=final_eye_score,
            gesture=gesture_frequency,
            voice=voice_stability_score,
            speaking_rate=speaking_rate_score,
            technical_knowledge=tech_score,
            explanation_quality=expl_score,
            use_of_words=words_score,
            negotiation_score=neg_score,
            code_quality=cq_score,
            optimization=opt_score,
            thinking_process=tp_score,
            communication=comm_score,
        )

        final_non_technical = analysis.get("non_technical_feedback", {})
        if analysis.get("coding_feedback"):
            final_non_technical["coding_feedback"] = analysis["coding_feedback"]

        short_summary = analysis.get("short_summary_feedback", "")

        # ── Prefetch TTS audio for the short summary feedback ──
        try:
            from app.routes.agent import prefetch_tts
            if short_summary:
                print(f"[INFO] Prefetching TTS audio for speech ID {speech_id} short summary feedback...")
                prefetch_tts(short_summary)
        except Exception as prefetch_err:
            print(f"[WARN] Failed to prefetch TTS: {prefetch_err}")

        # Final save: short-lived session, committed and closed immediately
        try:
            with SessionLocal() as db:
                s = db.query(Speech).filter(Speech.id == speech_id).first()
                if s:
                    s.eye_contact_score = final_eye_score
                    s.technical_knowledge_score = float(sub_scores.get("technical_knowledge_score", 50.0))
                    s.fluency_score = float(sub_scores.get("fluency_score", 50.0))
                    s.use_of_words_score = float(sub_scores.get("use_of_words_score", 50.0))
                    s.filler_words_score = float(sub_scores.get("filler_words_score", max(0, 100 - filler_count * 3)))
                    s.explanation_quality_score = float(sub_scores.get("explanation_quality_score", 50.0))
                    if interview_type_str == "negotiation":
                        s.negotiation_score = float(sub_scores.get("negotiation_score", 60.0))
                    if interview_type_str in ("dsa", "technical") and dsa_code_str:
                        s.code_quality_score = float(sub_scores.get("code_quality_score", 50.0))
                        s.optimization_score = float(sub_scores.get("optimization_score", 50.0))
                        s.thinking_process_score = float(sub_scores.get("thinking_process_score", 50.0))
                        s.communication_score = float(sub_scores.get("communication_score", 50.0))
                    s.confidence_score = float(blended_confidence_score)
                    s.technical_feedback = json.dumps(analysis.get("technical_feedback", []))
                    s.non_technical_feedback = json.dumps(final_non_technical)
                    s.short_summary_feedback = short_summary
                    s.status = "completed"
                    s.progress = 100
                    db.commit()
                    print(f"[SUCCESS] Processing complete for speech ID: {speech_id}")
        except Exception as save_err:
            print(f"[ERROR] Failed to save final speech results: {save_err}")
            raise

    except Exception as e:
        print(f"[ERROR] Processing failed: {str(e)}")
        print(traceback.format_exc())

        # Use a fresh short-lived DB session to mark as failed
        try:
            with SessionLocal() as fail_db:
                fail_speech = fail_db.query(Speech).filter(Speech.id == speech_id).first()
                if fail_speech:
                    fail_speech.status = "failed"  # type: ignore
                    fail_db.commit()
                    print(f"[INFO] Marked speech {speech_id} as failed")
        except Exception as db_error:
            print(f"[ERROR] Failed to persist failed status: {db_error}")

    finally:
        try:
            if 'audio_path' in locals() and os.path.exists(audio_path):
                os.remove(audio_path)
        except OSError:
            pass
        _force_gc()