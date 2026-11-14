import { uploadVideo } from "@/utils/api";

let activeUploadPromise = null;
let pendingFilePayload = null;

export function startInterviewUpload(file, sessionId) {
  pendingFilePayload = { file, sessionId };
  activeUploadPromise = uploadVideo(file, sessionId);
  if (typeof window !== "undefined") {
    window.__CONFIDOMETER_ACTIVE_UPLOAD_PROMISE__ = activeUploadPromise;
    window.__CONFIDOMETER_PENDING_FILE_PAYLOAD__ = pendingFilePayload;
  }
  return activeUploadPromise;
}

export function getActiveInterviewUpload() {
  if (activeUploadPromise) return activeUploadPromise;
  if (typeof window !== "undefined" && window.__CONFIDOMETER_ACTIVE_UPLOAD_PROMISE__) {
    return window.__CONFIDOMETER_ACTIVE_UPLOAD_PROMISE__;
  }
  // Fallback: If promise wasn't stored but payload was, start upload now
  const payload = pendingFilePayload || (typeof window !== "undefined" ? window.__CONFIDOMETER_PENDING_FILE_PAYLOAD__ : null);
  if (payload && payload.file) {
    return startInterviewUpload(payload.file, payload.sessionId);
  }
  return null;
}

export function clearActiveInterviewUpload() {
  activeUploadPromise = null;
  pendingFilePayload = null;
  if (typeof window !== "undefined") {
    delete window.__CONFIDOMETER_ACTIVE_UPLOAD_PROMISE__;
    delete window.__CONFIDOMETER_PENDING_FILE_PAYLOAD__;
  }
}
