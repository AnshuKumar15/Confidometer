import { getToken, clearSession } from "@/utils/auth";
import { getApiBase } from "@/utils/api";

async function request(path, { method = "GET", body, auth = true, headers = {} } = {}, retries = 3) {
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

      if ((res.status === 502 || res.status === 503 || res.status === 504) && attempt < retries - 1) {
        attempt++;
        await new Promise((resolve) => setTimeout(resolve, 2500 * attempt));
        continue;
      }

      break;
    } catch (fetchError) {
      attempt++;
      if (attempt >= retries) {
        throw fetchError;
      }
      await new Promise((resolve) => setTimeout(resolve, 2500 * attempt));
    }
  }

  if (!res.ok) {
    const contentType = res.headers.get("content-type") || "";
    if (res.status === 401 && path !== "/auth/login") {
      clearSession();
      let detail = "Unauthorized";
      try {
        const data = contentType.includes("application/json") ? await res.json() : null;
        if (data && typeof data?.detail === "string") {
          detail = data.detail;
        }
      } catch (e) {
        // ignore
      }
      throw new Error(detail);
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

export function getDiscoveredJobs(filterOrOptions = {}) {
  const params = new URLSearchParams();
  if (typeof filterOrOptions === "string" || filterOrOptions === null) {
    if (filterOrOptions && filterOrOptions !== "all") params.append("status", filterOrOptions);
    params.append("limit", "100");
  } else {
    const { status, platform, search, limit = 100, offset = 0 } = filterOrOptions;
    if (status && status !== "all") params.append("status", status);
    if (platform && platform !== "all") params.append("platform", platform);
    if (search && search.trim()) params.append("search", search.trim());
    if (limit) params.append("limit", limit);
    if (offset) params.append("offset", offset);
  }
  const qs = params.toString() ? `?${params.toString()}` : "";
  return request(`/autoapply/jobs${qs}`);
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
