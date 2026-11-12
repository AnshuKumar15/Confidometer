"use client";

import { usePathname } from "next/navigation";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "./ThemeProvider";

export default function FloatingThemeToggle() {
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();

  // Hidden on Home ("/") and ApplyBuddy ("/autoapply*") per product design
  if (!pathname || pathname === "/" || pathname.startsWith("/autoapply")) {
    return null;
  }

  const isDark = theme === "dark";
  const label = isDark ? "Switch to light mode" : "Switch to dark mode";

  return (
    <button
      type="button"
      className={`floating-theme-toggle ${isDark ? "is-dark" : "is-light"}`}
      onClick={(e) => {
        toggleTheme();
        e.currentTarget.blur();
      }}
      title={label}
      aria-label={label}
      aria-pressed={isDark}
    >
      {isDark ? <Sun size={19} /> : <Moon size={19} />}
    </button>
  );
}

