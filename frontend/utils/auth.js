"use client";

const TOKEN_KEY = "confidometer_token";
const USER_KEY = "confidometer_user";

export function saveSession({ accessToken, user }) {
  if (typeof window === "undefined") return;
  localStorage.setItem(TOKEN_KEY, accessToken);
  if (user) {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  }
}

export function getToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function getUser() {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function clearSession() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function isAuthed() {
  const token = getToken();
  if (!token) return false;
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return false;
    
    // Decode base64url payload
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    
    const payload = JSON.parse(jsonPayload);
    const exp = payload.exp;
    if (!exp) return true;

    const currentTime = Math.floor(Date.now() / 1000);
    if (currentTime >= exp) {
      console.warn("[AUTH] JWT token expired. Clearing session.");
      clearSession();
      return false;
    }
    return true;
  } catch (e) {
    console.error("[AUTH] Error parsing JWT token:", e);
    clearSession();
    return false;
  }
}

