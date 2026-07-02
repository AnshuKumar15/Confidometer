"use client";

import { Camera, Mic, Square } from "lucide-react";
import { useEffect, useRef, useState } from "react";

function formatDuration(totalSeconds) {
  const mins = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const secs = (totalSeconds % 60).toString().padStart(2, "0");
  return `${mins}:${secs}`;
}

export default function RecordingBox({ onSubmit, isLoading }) {
  const liveVideoRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const shouldUploadRef = useRef(true);
  const lastChunksRef = useRef(null);

  const [isRecording, setIsRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [status, setStatus] = useState("Ready to record");
  const [error, setError] = useState("");
  const [recordedUrl, setRecordedUrl] = useState(null);

  useEffect(() => {
    if (!isRecording || isPaused) return undefined;

    const interval = setInterval(() => {
      setSeconds((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [isRecording, isPaused]);

  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  async function startRecording() {
    setError("");
    setStatus("Requesting camera and microphone access...");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });

      streamRef.current = stream;
      chunksRef.current = [];
      setSeconds(0);

      if (liveVideoRef.current) {
        liveVideoRef.current.srcObject = stream;
      }

      const preferredMime = MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
        ? "video/webm;codecs=vp9,opus"
        : "video/webm";

      const recorder = new MediaRecorder(stream, { mimeType: preferredMime });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        try {
          setStatus("Finalizing recording...");

          const blobType = recorder.mimeType || "video/webm";
          const extension = blobType.includes("mp4") ? "mp4" : "webm";
          const blob = new Blob(chunksRef.current, { type: blobType });
          const file = new File([blob], `recording-${Date.now()}.${extension}`, { type: blobType });

          if (shouldUploadRef.current) {
            setStatus("Uploading recording...");
            await onSubmit(file);
          } else {
            // store chunks for later analyze
            lastChunksRef.current = chunksRef.current.slice();
            try {
              const blobForPlayback = new Blob(lastChunksRef.current, { type: blobType });
              const url = URL.createObjectURL(blobForPlayback);
              setRecordedUrl(url);
              // attach url to video element for playback
              if (liveVideoRef.current) {
                liveVideoRef.current.srcObject = null;
                liveVideoRef.current.src = url;
                liveVideoRef.current.controls = true;
                liveVideoRef.current.muted = false;
              }
            } catch (e) {
              // ignore playback creation errors
            }
            setStatus("Recording stopped — ready to analyze");
          }
        } catch (uploadError) {
          setError(uploadError?.message || "Failed to upload recording");
          setStatus("Upload failed");
        } finally {
          if (streamRef.current) {
            streamRef.current.getTracks().forEach((track) => track.stop());
            streamRef.current = null;
          }

          if (liveVideoRef.current) {
            liveVideoRef.current.srcObject = null;
          }
        }
      };

      recorder.start(1000);
      setIsRecording(true);
      setIsPaused(false);
      setStatus("Recording in progress...");
    } catch (err) {
      setError(err?.message || "Unable to access camera/microphone");
      setStatus("Permission denied or device unavailable");
    }
  }

  function stopRecording() {
    if (!mediaRecorderRef.current || mediaRecorderRef.current.state === "inactive") {
      return;
    }

    // stop but do not upload immediately; allow user to analyze later
    shouldUploadRef.current = false;
    setIsRecording(false);
    setIsPaused(false);
    setStatus("Stopping recording...");
    mediaRecorderRef.current.stop();
  }

  function togglePause() {
    const rec = mediaRecorderRef.current;
    if (!rec) return;

    if (rec.state === "recording") {
      try {
        rec.pause();
        // also pause the preview video so the UI shows a frozen frame
        try {
          liveVideoRef.current?.pause();
        } catch {}
        setIsPaused(true);
        setStatus("Paused");
      } catch {
        // not supported
      }
    } else if (rec.state === "paused") {
      try {
        rec.resume();
        // resume preview playback as well
        try {
          liveVideoRef.current?.play();
        } catch {}
        setIsPaused(false);
        setStatus("Recording in progress...");
      } catch {
        // not supported
      }
    }
  }

  async function analyzeRecording() {
    // if still recording, request upload-on-stop
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      shouldUploadRef.current = true;
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setStatus("Finalizing recording for analysis...");
      return;
    }

    // if we have stored chunks from a stopped recording, upload them
    if (lastChunksRef.current && lastChunksRef.current.length > 0) {
      setStatus("Finalizing recording...");
      try {
        const blob = new Blob(lastChunksRef.current, { type: "video/webm" });
        const file = new File([blob], `recording-${Date.now()}.webm`, { type: "video/webm" });
        setStatus("Uploading recording...");
        await onSubmit(file);
      } catch (uploadError) {
        setError(uploadError?.message || "Failed to upload recording");
        setStatus("Upload failed");
      } finally {
        lastChunksRef.current = null;
        if (recordedUrl) {
          try {
            URL.revokeObjectURL(recordedUrl);
          } catch {}
          setRecordedUrl(null);
        }
      }
    }
  }

  function playPreview() {
    const v = liveVideoRef.current;
    if (!v) return;

    if (v.paused) v.play();
    else v.pause();
  }

  function recordAgain() {
    if (recordedUrl) {
      try {
        URL.revokeObjectURL(recordedUrl);
      } catch {}
      setRecordedUrl(null);
    }
    lastChunksRef.current = null;
    setSeconds(0);
    setStatus("Ready to record");
    setIsPaused(false);
    if (liveVideoRef.current) {
      liveVideoRef.current.src = null;
      liveVideoRef.current.controls = false;
      liveVideoRef.current.muted = true;
    }
  }

  return (
    <section className="recording-box glass">
      <div className="recording-head">
        <h3>Or record directly in browser</h3>
        <p>Press start, answer naturally, then stop to analyze instantly.</p>
      </div>

      <div className={`recording-preview-wrap ${isRecording ? "recording-active" : ""}`}>
        <video
          ref={liveVideoRef}
          autoPlay={isRecording}
          muted={isRecording}
          playsInline
          controls={!!recordedUrl}
          className="recording-preview"
        />

        {!isRecording && !recordedUrl ? (
          <div className="recording-overlay">
            <Camera size={24} />
            <span>Camera preview appears here once recording starts</span>
          </div>
        ) : null}
      </div>

      <div className="recording-controls">
        {!isRecording && !recordedUrl ? (
          <button
            type="button"
            className="button primary"
            onClick={() => {
              // clear any previous recorded url
              if (recordedUrl) {
                try {
                  URL.revokeObjectURL(recordedUrl);
                } catch {}
                setRecordedUrl(null);
              }
              startRecording();
            }}
            disabled={isLoading || isRecording}
          >
            <Mic size={16} />
            Start Recording
          </button>
        ) : null}

        {isRecording ? (
          <>
            <button
              type="button"
              className="button subtle"
              onClick={togglePause}
              disabled={isLoading || !isRecording}
            >
              Pause/Resume
            </button>

            <button
              type="button"
              className="button subtle"
              onClick={stopRecording}
              disabled={isLoading || !isRecording}
            >
              Stop
            </button>
          </>
        ) : null}

        {!isRecording && recordedUrl ? (
          <>
            <button type="button" className="button subtle" onClick={playPreview}>
              Play/Pause
            </button>

            <button type="button" className="button primary" onClick={analyzeRecording}>
              Analyze
            </button>

            <button type="button" className="button subtle" onClick={recordAgain}>
              Record Again
            </button>
          </>
        ) : null}

        <p className="recording-timer">
          {isRecording ? <span className="record-dot" /> : null}
          {formatDuration(seconds)}
        </p>
      </div>

      <p className="muted">{status}</p>
      {error ? <p className="error-text">{error}</p> : null}
    </section>
  );
}
