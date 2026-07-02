import librosa
import numpy as np

def analyze_voice(audio_path: str):
    # load audio
    y, sr = librosa.load(audio_path, sr=None)

    # 1) Speaking rate: words per minute (rough)
    # We'll depend on filler+transcript length later; here we return duration and let caller compute wpm
    duration_sec = librosa.get_duration(y=y, sr=sr)

    # 2) Silence ratio: ratio of low-energy frames
    # Using a frame-wise energy approach
    S, phase = librosa.magphase(librosa.stft(y=y))
    rms = librosa.feature.rms(S=S)[0]
    # threshold for silence: consider frames with very low RMS
    silence_threshold = np.percentile(rms, 10)  # bottom 10% as silence baseline
    silence_frames = np.sum(rms < silence_threshold)
    total_frames = len(rms)
    silence_ratio = silence_frames / total_frames if total_frames > 0 else 0.0

    # 3) Pitch analysis: variability
    pitch_values = np.array([])

    # Prefer librosa.pyin for robust fundamental frequency estimation, fall back to piptrack
    try:
        # reasonable voice range for humans
        fmin = 50.0
        fmax = 500.0
        f0 = librosa.pyin(y, fmin=fmin, fmax=fmax, sr=sr)
        # librosa.pyin may return a tuple in some versions; handle that
        if isinstance(f0, tuple) or isinstance(f0, list):
            f0 = f0[0]

        if f0 is not None:
            pitch_values = f0[~np.isnan(f0)]
    except Exception as e:
        # fallback
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

    return {
        "duration_sec": duration_sec,
        "silence_ratio": silence_ratio,
        "avg_pitch": avg_pitch,
        "pitch_std": pitch_std
    }