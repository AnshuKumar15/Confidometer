"""
Voice Activity Detection (VAD) module for Confidometer.

Lightweight, high-performance acoustic signal processing module using numpy and
standard library wave/struct. Evaluates PCM audio for energy, zero-crossing rate,
and spectral flatness to distinguish human speech from ambient room noise,
fan whir, keyboard clicks, and silence before sending chunks to Groq Whisper.
"""

import io
import os
import wave
from typing import Union, BinaryIO
import numpy as np

# Configurable thresholds via environment variables
VAD_ENERGY_THRESHOLD = float(os.environ.get("VAD_ENERGY_THRESHOLD", "0.008"))
VAD_SPECTRAL_FLATNESS_MAX = float(os.environ.get("VAD_SPECTRAL_FLATNESS_MAX", "0.65"))
VAD_ZCR_MAX = float(os.environ.get("VAD_ZCR_MAX", "0.45"))
VAD_MIN_SPEECH_MS = int(os.environ.get("VAD_MIN_SPEECH_MS", "150"))
VAD_FRAME_MS = int(os.environ.get("VAD_FRAME_MS", "30"))


def _read_wav_samples(wav_input: Union[str, bytes, BinaryIO]) -> tuple[np.ndarray, int]:
    """
    Read WAV audio into a normalized float32 numpy array [-1.0, 1.0] and sample rate.
    Handles mono and stereo 16-bit PCM.
    """
    if isinstance(wav_input, bytes):
        wav_file = io.BytesIO(wav_input)
    elif isinstance(wav_input, str):
        wav_file = wav_input
    else:
        wav_file = wav_input

    with wave.open(wav_file, "rb") as wf:
        n_channels = wf.getnchannels()
        sampwidth = wf.getsampwidth()
        sample_rate = wf.getframerate()
        n_frames = wf.getnframes()

        if n_frames == 0:
            return np.array([], dtype=np.float32), sample_rate

        raw_bytes = wf.readframes(n_frames)

    # Decode according to sample width
    if sampwidth == 2:  # 16-bit PCM
        data = np.frombuffer(raw_bytes, dtype=np.int16).astype(np.float32) / 32768.0
    elif sampwidth == 1:  # 8-bit unsigned PCM
        data = (np.frombuffer(raw_bytes, dtype=np.uint8).astype(np.float32) - 128.0) / 128.0
    elif sampwidth == 4:  # 32-bit float or int
        try:
            data = np.frombuffer(raw_bytes, dtype=np.float32)
        except Exception:
            data = np.frombuffer(raw_bytes, dtype=np.int32).astype(np.float32) / 2147483648.0
    else:
        data = np.frombuffer(raw_bytes, dtype=np.int16).astype(np.float32) / 32768.0

    # If stereo or multichannel, average channels to mono
    if n_channels > 1:
        data = data.reshape(-1, n_channels).mean(axis=1)

    return data, sample_rate


def is_speech_chunk(
    wav_input: Union[str, bytes, BinaryIO],
    energy_threshold: float = VAD_ENERGY_THRESHOLD,
    flatness_max: float = VAD_SPECTRAL_FLATNESS_MAX,
    zcr_max: float = VAD_ZCR_MAX,
    min_speech_ms: int = VAD_MIN_SPEECH_MS,
    frame_ms: int = VAD_FRAME_MS,
) -> bool:
    """
    Determines whether a WAV audio chunk contains sufficient human speech to warrant STT transcription.
    
    Returns:
        bool: True if chunk contains >= min_speech_ms of voiced speech, False otherwise.
    """
    try:
        samples, sample_rate = _read_wav_samples(wav_input)
        if len(samples) == 0 or sample_rate <= 0:
            return False

        frame_len = int(sample_rate * (frame_ms / 1000.0))
        if frame_len <= 0 or len(samples) < frame_len:
            return False

        # Precompute hamming window for spectral analysis
        window = np.hamming(frame_len)

        n_frames = len(samples) // frame_len
        speech_frame_count = 0

        for i in range(n_frames):
            frame = samples[i * frame_len : (i + 1) * frame_len]

            # 1. RMS Energy
            rms = float(np.sqrt(np.mean(frame ** 2)))
            if rms < energy_threshold:
                continue

            # 2. Zero Crossing Rate (ZCR)
            # High ZCR indicates unvoiced noise / hiss; lower indicates voiced signal
            signs = np.signbit(frame)
            zcr = float(np.mean(signs[:-1] != signs[1:]))

            # 3. Spectral Flatness (Wiener entropy)
            # Flat spectrum ≈ 1.0 (white noise, hiss), peaked spectrum < 0.4 (speech formants)
            windowed = frame * window
            fft_mag = np.abs(np.fft.rfft(windowed)) ** 2 + 1e-12
            geom_mean = float(np.exp(np.mean(np.log(fft_mag))))
            arith_mean = float(np.mean(fft_mag))
            flatness = geom_mean / arith_mean if arith_mean > 0 else 1.0

            # Combined voice decision:
            # Voiced speech has harmonic structure (lower flatness) and lower ZCR than random noise
            is_voiced = (flatness <= flatness_max) or (zcr <= zcr_max)
            if is_voiced:
                speech_frame_count += 1

        detected_speech_ms = speech_frame_count * frame_ms
        return detected_speech_ms >= min_speech_ms

    except Exception as e:
        print(f"[VAD] Error evaluating speech chunk: {e}")
        # In case of an unexpected error, return False to avoid hallucinating on corrupted audio
        return False
