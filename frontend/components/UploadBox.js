"use client";

import { UploadCloud, Video, Play, X } from "lucide-react";
import { useRef, useState, useEffect } from "react";

export default function UploadBox({ onSubmit, isLoading, compact = false }) {
  const inputRef = useRef(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);

  // Create / revoke object URL for preview
  useEffect(() => {
    if (selectedFile) {
      const url = URL.createObjectURL(selectedFile);
      setPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setPreviewUrl(null);
    }
  }, [selectedFile]);

  function handleSelect(file) {
    if (!file) return;
    setSelectedFile(file);
  }

  function handleAnalyze() {
    if (!selectedFile) return;
    onSubmit(selectedFile);
  }

  function handleRemove() {
    setSelectedFile(null);
    setPreviewUrl(null);
    // Reset the file input so re-selecting the same file triggers onChange
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }

  // Format file size
  function formatSize(bytes) {
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  }

  return (
    <section className={`upload-box glass ${compact ? "compact" : ""}`}>
      {!selectedFile ? (
        /* ── File Picker ── */
        <button
          type="button"
          className="upload-dropzone"
          onClick={() => inputRef.current?.click()}
          disabled={isLoading}
        >
          <UploadCloud size={compact ? 24 : 36} />
          <h3>
            {isLoading
              ? "Uploading..."
              : compact
              ? "Upload pre-recorded video"
              : "Drop your interview recording"}
          </h3>
          {!compact && (
            <p>
              MP4 or MOV format works best. We analyze voice, eye contact,
              fillers, and gestures.
            </p>
          )}
          <span className="button">Choose video</span>
        </button>
      ) : (
        /* ── Video Preview + Analyze ── */
        <div className="upload-preview-container">
          <div className="upload-preview-video-wrap">
            <video
              src={previewUrl}
              controls
              className="upload-preview-video"
              playsInline
            />
            <button
              type="button"
              className="upload-preview-remove"
              onClick={handleRemove}
              disabled={isLoading}
              title="Remove video"
            >
              <X size={16} />
            </button>
          </div>

          <div className="upload-preview-info">
            <div className="file-chip">
              <Video size={16} />
              <span>{selectedFile.name}</span>
              <span className="file-size">{formatSize(selectedFile.size)}</span>
            </div>

            <button
              type="button"
              className="button primary upload-analyze-btn"
              onClick={handleAnalyze}
              disabled={isLoading}
            >
              <Play size={16} />
              {isLoading ? "Analyzing..." : "Analyze Interview"}
            </button>
          </div>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="video/*"
        className="hidden-input"
        onChange={(event) => handleSelect(event.target.files?.[0])}
      />
    </section>
  );
}
