/**
 * Safe Clipboard Utility
 * Protects against clipboard hijacking, pastejacking, ANSI escape sequence injection,
 * and BiDi / zero-width character evasion attacks when copying text to the user's clipboard.
 */

/**
 * Sanitizes text before copying to prevent terminal/shell injection and pastejacking:
 * 1. Strips ANSI escape codes (e.g. \x1b[31m).
 * 2. Strips bidirectional override characters (U+202A to U+202E, U+2066 to U+2069).
 * 3. Strips zero-width invisible characters (U+200B, U+200C, U+200D, U+FEFF).
 * 4. Strips dangerous ASCII control characters (\x00-\x08, \x0B, \x0C, \x0E-\x1F, \x7F-\x9F).
 * 5. Normalizes carriage returns (\r\n -> \n).
 */
export function sanitizeForClipboard(text) {
  if (typeof text !== "string") {
    return "";
  }

  return (
    text
      // Normalize line endings
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      // Remove ANSI escape sequences
      .replace(/\x1b\[[0-9;]*[a-zA-Z]/g, "")
      // Remove BiDi override / embedding control characters
      .replace(/[\u202A-\u202E\u2066-\u2069]/g, "")
      // Remove zero-width spaces and formatting invisible chars
      .replace(/[\u200B-\u200D\uFEFF]/g, "")
      // Remove ASCII control characters (keeping tab \t and newline \n)
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, "")
  );
}

/**
 * Safely copies sanitized text to the user's clipboard.
 * Works across both modern secure contexts (navigator.clipboard) and fallback environments.
 * 
 * @param {string} text - The raw text to copy.
 * @returns {Promise<boolean>} - True if copy succeeded, false otherwise.
 */
export async function safeCopyToClipboard(text) {
  const sanitized = sanitizeForClipboard(text);

  if (!sanitized) {
    return false;
  }

  // 1. Try modern Async Clipboard API
  if (typeof navigator !== "undefined" && navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(sanitized);
      return true;
    } catch (err) {
      console.warn("[CLIPBOARD] navigator.clipboard failed, attempting fallback:", err);
    }
  }

  // 2. Fallback for older browsers or non-secure contexts
  if (typeof document !== "undefined") {
    try {
      const textArea = document.createElement("textarea");
      textArea.value = sanitized;
      textArea.style.position = "fixed";
      textArea.style.left = "-999999px";
      textArea.style.top = "-999999px";
      textArea.setAttribute("readonly", "");
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();

      const successful = document.execCommand("copy");
      document.body.removeChild(textArea);
      return successful;
    } catch (fallbackErr) {
      console.error("[CLIPBOARD] Fallback copy failed:", fallbackErr);
      return false;
    }
  }

  return false;
}
