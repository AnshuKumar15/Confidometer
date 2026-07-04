import math
import librosa
import numpy as np


def _bell_curve_score(value: float, ideal: float, width: float) -> float:
    """Gaussian bell-curve: 100 at ideal, decaying towards 0."""
    return 100.0 * math.exp(-((value - ideal) / width) ** 2)


def analyze_voice(audio_path: str) -> dict:
    """
    Analyze voice characteristics from an audio file.

    Returns dict with:
    - duration_sec: total audio duration
    - silence_ratio: fraction of frames below silence threshold
    - avg_pitch: mean fundamental frequency (Hz)
    - pitch_std: std deviation of fundamental frequency (Hz)
    - speaking_rate_score: 0-100 score based on estimated WPM (ideal 130-150)
    """
    y, sr = librosa.load(audio_path, sr=None)

    # ── 1. Duration ──
    duration_sec = librosa.get_duration(y=y, sr=sr)

    # ── 2. Silence ratio with dual threshold ──
    S, phase = librosa.magphase(librosa.stft(y=y))
    rms = librosa.feature.rms(S=S)[0]

    # Dual threshold: use whichever is higher
    # - Absolute minimum: handles very quiet recordings where even the 10th pctl is noise
    # - Percentile-based: adapts to the recording's dynamic range
    absolute_silence_min = 0.005  # RMS below this is definitely silence
    percentile_threshold = float(np.percentile(rms, 10))
    silence_threshold = max(absolute_silence_min, percentile_threshold)

    silence_frames = int(np.sum(rms < silence_threshold))
    total_frames = len(rms)
    silence_ratio = silence_frames / total_frames if total_frames > 0 else 0.0

    # ── 3. Pitch analysis ──
    pitch_values = np.array([])

    try:
        fmin = 50.0
        fmax = 500.0
        f0 = librosa.pyin(y, fmin=fmin, fmax=fmax, sr=sr)
        if isinstance(f0, (tuple, list)):
            f0 = f0[0]

        if f0 is not None:
            pitch_values = f0[~np.isnan(f0)]
    except Exception:
        try:
            pitches, magnitudes = librosa.piptrack(y=y, sr=sr)
            pitch_values = pitches[magnitudes > np.median(magnitudes)]
        except Exception:
            pitch_values = np.array([])

    if pitch_values.size == 0:
        avg_pitch = 0.0
        pitch_std = 0.0
    else:
        avg_pitch = float(np.mean(pitch_values))
        pitch_std = float(np.std(pitch_values))

    # ── 4. Speaking rate estimation ──
    # Estimate syllables from audio energy peaks as a proxy for words spoken
    # This gives a rough WPM without needing the transcript
    # Use onset detection to estimate syllable count
    try:
        onset_env = librosa.onset.onset_strength(y=y, sr=sr)
        onsets = librosa.onset.onset_detect(onset_envelope=onset_env, sr=sr)
        estimated_syllables = len(onsets)
        # Rough conversion: ~1.5 syllables per word (English average)
        estimated_words = estimated_syllables / 1.5
        minutes = duration_sec / 60.0 if duration_sec > 0 else 1.0
        estimated_wpm = estimated_words / minutes if minutes > 0 else 0
    except Exception:
        estimated_wpm = 130.0  # Default to ideal if estimation fails

    # Score WPM: ideal = 140 WPM, width = 50
    # 90-190 WPM scores well; outside that range degrades
    speaking_rate_score = _bell_curve_score(estimated_wpm, ideal=140.0, width=50.0)
    speaking_rate_score = max(0.0, min(100.0, speaking_rate_score))

    print(f"[DEBUG] Voice: duration={duration_sec:.1f}s, silence_ratio={silence_ratio:.2%}, "
          f"pitch_std={pitch_std:.1f}Hz, est_wpm={estimated_wpm:.0f}, "
          f"speaking_rate_score={speaking_rate_score:.1f}")

    return {
        "duration_sec": duration_sec,
        "silence_ratio": silence_ratio,
        "avg_pitch": avg_pitch,
        "pitch_std": pitch_std,
        "speaking_rate_score": speaking_rate_score,
        "estimated_wpm": estimated_wpm,
    }