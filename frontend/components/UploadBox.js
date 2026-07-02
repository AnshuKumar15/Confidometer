"use client";

import { UploadCloud, Video } from "lucide-react";
import { useRef, useState } from "react";

export default function UploadBox({ onSubmit, isLoading, compact = false }) {
  const inputRef = useRef(null);
  const [fileName, setFileName] = useState("");

  function handleSelect(file) {
    if (!file) return;
    setFileName(file.name);
    onSubmit(file);
  }

  return (
    <section className={`upload-box glass ${compact ? "compact" : ""}`}>
      <button
        type="button"
        className="upload-dropzone"
        onClick={() => inputRef.current?.click()}
        disabled={isLoading}
      >
        <UploadCloud size={compact ? 24 : 36} />
        <h3>{isLoading ? "Uploading..." : compact ? "Upload pre-recorded video" : "Drop your interview recording"}</h3>
        {!compact && (
          <p>MP4 or MOV format works best. We analyze voice, eye contact, fillers, and gestures.</p>
        )}
        <span className="button">Choose video</span>
      </button>

      <input
        ref={inputRef}
        type="file"
        accept="video/*"
        className="hidden-input"
        onChange={(event) => handleSelect(event.target.files?.[0])}
      />

      {fileName && (
        <div className="file-chip">
          <Video size={16} />
          <span>{fileName}</span>
        </div>
      )}
    </section>
  );
}
