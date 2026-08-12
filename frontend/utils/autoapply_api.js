import { getToken, clearSession } from "@/utils/auth";
import { API_BASE } from "@/utils/api";

async function request(path, { method = "GET", body, auth = true, headers = {} } = {}) {
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
  try {
    res = await fetch(`${API_BASE}${cleanPath}`, {
      method,
      headers: finalHeaders,
      body: payload,
      cache: "no-store"
    });
  } catch (err) {
    // If primary host failed (e.g. 127.0.0.1 vs localhost), try fallback URL
    const altBase = API_BASE.includes("127.0.0.1")
      ? API_BASE.replace("127.0.0.1", "localhost")
      : API_BASE.includes("localhost")
      ? API_BASE.replace("localhost", "127.0.0.1")
      : API_BASE;
    try {
      res = await fetch(`${altBase}${cleanPath}`, {
        method,
        headers: finalHeaders,
        body: payload,
        cache: "no-store"
      });
    } catch (fallbackErr) {
      throw err;
    }
  }

  if (!res.ok) {
    const contentType = res.headers.get("content-type") || "";
    if (res.status === 401 && path !== "/auth/login") {
      clearSession();
      if (typeof window !== "undefined") {
        window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`;
      }
      throw new Error("Unauthorized");
    }

    if (contentType.includes("application/json")) {
      const data = await res.json();
      throw new Error(data?.detail || `Request failed with ${res.status}`);
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

// ── AutoApply API Utilities ──

export function parseResume(file) {
  const formData = new FormData();
  formData.append("file", file);
  return request("/autoapply/resume/parse", {
    method: "POST",
    body: formData
  });
}

export function completeOnboarding(payload) {
  return request("/autoapply/onboard", {
    method: "POST",
    body: payload
  });
}

export function getProfile() {
  return request("/autoapply/profile");
}

export function updateProfile(profileData) {
  return request("/autoapply/profile", {
    method: "PUT",
    body: profileData
  });
}

export function getPreferences() {
  return request("/autoapply/preferences");
}

export function updatePreferences(prefsData) {
  return request("/autoapply/preferences", {
    method: "PUT",
    body: prefsData
  });
}

export function getDiscoveredJobs(status = null) {
  const query = status ? `?status=${encodeURIComponent(status)}` : "";
  return request(`/autoapply/jobs${query}`);
}

export function triggerJobSearch() {
  return request("/autoapply/jobs/search", { method: "POST" });
}

export function updateJobMatchStatus(matchId, status) {
  return request(`/autoapply/jobs/${matchId}/status`, {
    method: "PUT",
    body: { status }
  });
}

export function getApplications(status = null) {
  const query = status ? `?status=${encodeURIComponent(status)}` : "";
  return request(`/autoapply/applications${query}`);
}

export function updateApplicationStatus(appId, status, notes = "") {
  return request(`/autoapply/applications/${appId}/status`, {
    method: "PUT",
    body: { status, notes }
  });
}

export function getAutoApplyConfig() {
  return request("/autoapply/config");
}

export function updateAutoApplyConfig(configData) {
  return request("/autoapply/config", {
    method: "PUT",
    body: configData
  });
}

export function pauseAutomation() {
  return request("/autoapply/config/pause", { method: "POST" });
}

export function resumeAutomation() {
  return request("/autoapply/config/resume", { method: "POST" });
}

export function getDashboardStats() {
  return request("/autoapply/dashboard");
}

export function getNotifications() {
  return request("/autoapply/notifications");
}

export function markNotificationRead(notifId) {
  return request(`/autoapply/notifications/${notifId}/read`, { method: "PUT" });
}

export function getActivityLog() {
  return request("/autoapply/activity");
}
