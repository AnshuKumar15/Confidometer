import { getToken, clearSession } from "@/utils/auth";

export const getApiBase = () => {
  if (process.env.NEXT_PUBLIC_API_BASE) {
    return process.env.NEXT_PUBLIC_API_BASE.replace(/\/+$/, "");
  }
  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    if (host === "localhost" || host === "127.0.0.1") {
      return "http://127.0.0.1:8000";
    }
    return "https://confidometer-backend.onrender.com";
  }
  // Server-side (SSR) context
  if (process.env.NODE_ENV === "development") {
    return "http://127.0.0.1:8000";
  }
  return "https://confidometer-backend.onrender.com";
};

export const getWsBase = () => {
  return getApiBase().replace(/^http/, "ws");
};

export const API_BASE = getApiBase();

// Derive WebSocket URL from API_BASE (http → ws, https → wss)
export const WS_BASE = getWsBase();

async function request(path, { method = "GET", body, auth = false, headers = {} } = {}, retries = 3) {
  const finalHeaders = {
    ...headers
  };

  const isFormData = body instanceof FormData;
  const isUrlEncoded = body instanceof URLSearchParams;
  const hasContentType = Object.keys(finalHeaders).some(
    (key) => key.toLowerCase() === "content-type"
  );

  if (!isFormData && !isUrlEncoded && body && !hasContentType) {
    finalHeaders["Content-Type"] = "application/json";
  }

  if (auth) {
    const token = getToken();
    if (token) {
      finalHeaders.Authorization = `Bearer ${token}`;
    }
  }

  const payload = body
    ? isFormData || isUrlEncoded || typeof body === "string"
      ? body
      : JSON.stringify(body)
    : undefined;

  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  
  let res;
  let attempt = 0;
  while (attempt < retries) {
    const baseUrl = getApiBase();
    try {
      res = await fetch(`${baseUrl}${cleanPath}`, {
        method,
        headers: finalHeaders,
        body: payload,
        cache: "no-store"
      });

      // If Render backend is waking up from sleep (502 / 503 / 504), wait and retry
      if ((res.status === 502 || res.status === 503 || res.status === 504) && attempt < retries - 1) {
        attempt++;
        await new Promise((resolve) => setTimeout(resolve, 2500 * attempt));
        continue;
      }

      break;
    } catch (fetchError) {
      // Network error (Failed to fetch) - likely Render sleeping or cold start
      attempt++;
      if (attempt >= retries) {
        throw fetchError;
      }
      await new Promise((resolve) => setTimeout(resolve, 2500 * attempt));
    }
  }

  if (!res.ok) {
    const contentType = res.headers.get("content-type") || "";

    // Handle rate limiting (429) gracefully
    if (res.status === 429) {
      const retryAfter = res.headers.get("Retry-After") || "60";
      throw new Error(`Too many requests. Please wait ${retryAfter}s and try again.`);
    }

    // If unauthorized, clear local session (unless it's the login request itself)
    if (res.status === 401 && path !== "/auth/login") {
      clearSession();
      let detail = "Unauthorized";
      try {
        const data = contentType.includes("application/json") ? await res.json() : null;
        if (data && typeof data?.detail === "string") {
          detail = data.detail;
        }
      } catch (e) {
        // ignore JSON parse error
      }
      throw new Error(detail);
    }

    if (contentType.includes("application/json")) {
      const data = await res.json();
      const detail = typeof data?.detail === "string" ? data.detail : JSON.stringify(data);
      throw new Error(detail || `Request failed with ${res.status}`);
    }

    const message = await res.text();
    throw new Error(message || `Request failed with ${res.status}`);
  }

  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return res.json();
  }

  return res.text();
}

export function login(payload) {
  const form = new URLSearchParams();
  form.append("username", payload.email);
  form.append("password", payload.password);

  return request("/auth/login", {
    method: "POST",
    body: form,
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    }
  });
}

export function register(payload) {
  return request("/auth/register", {
    method: "POST",
    body: {
      email: payload.email,
      password: payload.password,
      name: payload.name
    }
  });
}

export function uploadVideo(file, sessionId = null) {
  const formData = new FormData();
  formData.append("file", file);
  if (sessionId) formData.append("session_id", sessionId);

  return request("/upload/", {
    method: "POST",
    body: formData,
    auth: true
  });
}

export function getAnalysis(speechId) {
  return request(`/analysis/${speechId}`, { auth: true });
}

export function initiateInterview(resumeFile, role, companyName = "", experienceLevel = "", jobDescription = "", interviewType = "technical", duration = 10, stressMode = false) {
  const formData = new FormData();
  formData.append("resume", resumeFile);
  formData.append("role", role);
  if (companyName) formData.append("company_name", companyName);
  if (experienceLevel) formData.append("experience_level", experienceLevel);
  if (jobDescription) formData.append("job_description", jobDescription);
  formData.append("interview_type", interviewType);
  formData.append("duration", duration);
  formData.append("stress_mode", stressMode);

  return request("/agent/initiate", {
    method: "POST",
    body: formData,
    auth: true
  });
}

export function respondToAgent(sessionId, message, code = null, questionIndex = 0, elapsedSeconds = 0) {
  const formData = new FormData();
  formData.append("session_id", sessionId);
  formData.append("message", message);
  if (code) {
    formData.append("code", code);
    formData.append("question_index", questionIndex);
  }
  formData.append("elapsed_seconds", elapsedSeconds);

  return request("/agent/respond", {
    method: "POST",
    body: formData,
    auth: true
  });
}

export function runCode(code, language, questionNumber, questionTitle, description) {
  const formData = new FormData();
  formData.append("code", code);
  formData.append("language", language);
  formData.append("question_number", questionNumber);
  formData.append("question_title", questionTitle);
  formData.append("description", description);

  return request("/agent/run", {
    method: "POST",
    body: formData,
    auth: true
  });
}

export async function fetchTTSAudio(text) {
  return `${getApiBase()}/agent/tts?text=${encodeURIComponent(text)}`;
}

export function transcribeSpeech(audioBlob) {
  const formData = new FormData();
  formData.append("file", audioBlob, "speech.webm");
  return request("/agent/transcribe", {
    method: "POST",
    body: formData,
    auth: true
  });
}


export function getUserHistory() {
  return request("/analysis/history", { auth: true });
}

export function getTrends() {
  return request("/trends/", { auth: true });
}

export function createMeetingRequest(formData) {
  return request("/meeting/request", {
    method: "POST",
    body: formData,
    auth: true
  });
}

export function getPendingMeetingRequests() {
  return request("/meeting/requests/pending", { auth: true });
}

export function getMyMeetingRequests() {
  return request("/meeting/requests/my", { auth: true });
}

export function acceptMeetingRequest(requestId) {
  return request(`/meeting/request/${requestId}/accept`, {
    method: "POST",
    auth: true
  });
}

export function getMeetingRequestStatus(requestId) {
  return request(`/meeting/request/${requestId}/status`, { auth: true });
}

export function deleteMeetingRequest(requestId) {
  return request(`/meeting/request/${requestId}`, {
    method: "DELETE",
    auth: true
  });
}


/**
 * Create a WebSocket connection for real-time Speech-to-Text via server-side Whisper.
 *
 * @param {string} sessionId - The interview session ID
 * @param {function} onResult - Called with { type, text, corrections, full_transcript }
 * @param {function} onError - Called with error message string
 * @param {function} onOpen - Called when WebSocket connects successfully
 * @param {function} onClose - Called when WebSocket closes
 * @returns {{ send: function, close: function, isConnected: function }}
 */
export function createSTTWebSocket(sessionId, onResult, onError, onOpen, onClose) {
  const url = `${getWsBase()}/agent/ws/stt?session_id=${encodeURIComponent(sessionId)}`;
  let ws = null;
  let closed = false;

  try {
    ws = new WebSocket(url);
    ws.binaryType = "arraybuffer";
  } catch (e) {
    onError?.("Failed to create WebSocket: " + e.message);
    return { send: () => {}, close: () => {}, isConnected: () => false };
  }

  ws.onopen = () => {
    console.log("[STT-WS] Connected to server");
    onOpen?.();
  };

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      onResult?.(data);
    } catch (e) {
      console.warn("[STT-WS] Failed to parse message:", e);
    }
  };

  ws.onerror = (event) => {
    console.error("[STT-WS] WebSocket error:", event);
    onError?.("WebSocket connection error");
  };

  ws.onclose = (event) => {
    console.log("[STT-WS] Connection closed:", event.code, event.reason);
    closed = true;
    onClose?.();
  };

  return {
    /**
     * Send an audio blob/arraybuffer to the server for transcription.
     * @param {Blob|ArrayBuffer} audioData
     */
    send: (audioData) => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        if (audioData instanceof Blob) {
          audioData.arrayBuffer().then((buf) => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(buf);
            }
          });
        } else {
          ws.send(audioData);
        }
      }
    },

    /** Close the WebSocket connection. */
    close: () => {
      closed = true;
      if (ws && ws.readyState !== WebSocket.CLOSED) {
        ws.close();
      }
    },

    /** Check if the WebSocket is currently connected. */
    isConnected: () => ws && ws.readyState === WebSocket.OPEN && !closed,
  };
}
