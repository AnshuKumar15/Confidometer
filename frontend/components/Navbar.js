"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { clearSession, isAuthed, getUser } from "@/utils/auth";
import { useEffect, useState, useRef } from "react";
import {
  User,
  LayoutDashboard,
  Clock,
  Settings,
  HelpCircle,
  LogOut,
  ChevronDown,
} from "lucide-react";

const links = [
  { href: "/", label: "Home" },
  { href: "/upload", label: "AI Interview" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/history", label: "History" }
];

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [authed, setAuthed] = useState(false);
  const [user, setUser] = useState(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [navVisible, setNavVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);
  const dropdownRef = useRef(null);

  useEffect(() => {
    setAuthed(isAuthed());
    setUser(getUser());
  }, [pathname]);

  // Track scroll to show/hide navbar
  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      
      if (currentScrollY < 10) {
        setNavVisible(true);
      } else if (currentScrollY > lastScrollY) {
        setNavVisible(false); // Scrolling down: hide
      } else {
        setNavVisible(true); // Scrolling up: show
      }
      
      setLastScrollY(currentScrollY);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [lastScrollY]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    }
    if (dropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [dropdownOpen]);

  function onLogout() {
    clearSession();
    setAuthed(false);
    setUser(null);
    setDropdownOpen(false);
    router.push("/login");
  }

  // Get initials for the avatar
  function getInitials() {
    if (!user) return "U";
    if (user.name) {
      const parts = user.name.trim().split(/\s+/);
      if (parts.length >= 2) {
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
      }
      return parts[0][0].toUpperCase();
    }
    if (user.email) {
      return user.email[0].toUpperCase();
    }
    return "U";
  }

  return (
    <header className={`nav-wrap ${navVisible ? "" : "nav-hidden"}`}>
      <nav className="nav glass">
        <Link href="/" className="brand">
          <span className="brand-dot" />
          Confidometer
        </Link>

        <div className="nav-links">
          {links.map((link) => {
            const active = pathname === link.href;
            return (
              <Link key={link.href} href={link.href} className={active ? "active" : ""}>
                {link.label}
              </Link>
            );
          })}
        </div>

        <div className="nav-actions">
          {!authed ? (
            <div style={{ display: "flex", gap: "10px" }}>
              <Link href="/login" className="button subtle">
                Sign in
              </Link>
              <Link href="/register" className="button primary">
                Sign up
              </Link>
            </div>
          ) : (
            <div className="profile-wrapper" ref={dropdownRef}>
              <button
                type="button"
                className="profile-trigger"
                onClick={() => setDropdownOpen((prev) => !prev)}
                aria-expanded={dropdownOpen}
                aria-haspopup="true"
              >
                <span className="profile-avatar">{getInitials()}</span>
                <ChevronDown
                  size={14}
                  className={`profile-chevron ${dropdownOpen ? "open" : ""}`}
                />
              </button>

              {dropdownOpen && (
                <div className="profile-dropdown glass">
                  <div className="profile-dropdown-header">
                    <span className="profile-avatar-lg">{getInitials()}</span>
                    <div className="profile-info">
                      <span className="profile-name">{user?.name || "User"}</span>
                      <span className="profile-email">{user?.email || ""}</span>
                    </div>
                  </div>

                  <div className="profile-dropdown-divider" />

                  <Link
                    href="/dashboard"
                    className="profile-dropdown-item"
                    onClick={() => setDropdownOpen(false)}
                  >
                    <LayoutDashboard size={16} />
                    My Dashboard
                  </Link>
                  <Link
                    href="/history"
                    className="profile-dropdown-item"
                    onClick={() => setDropdownOpen(false)}
                  >
                    <Clock size={16} />
                    Interview History
                  </Link>
                  <Link
                    href="/upload"
                    className="profile-dropdown-item"
                    onClick={() => setDropdownOpen(false)}
                  >
                    <User size={16} />
                    New Interview
                  </Link>

                  <div className="profile-dropdown-divider" />

                  <button
                    type="button"
                    className="profile-dropdown-item"
                    onClick={() => setDropdownOpen(false)}
                    disabled
                  >
                    <Settings size={16} />
                    Settings
                    <span className="profile-soon-tag">Soon</span>
                  </button>
                  <button
                    type="button"
                    className="profile-dropdown-item"
                    onClick={() => setDropdownOpen(false)}
                    disabled
                  >
                    <HelpCircle size={16} />
                    Help & Support
                    <span className="profile-soon-tag">Soon</span>
                  </button>

                  <div className="profile-dropdown-divider" />

                  <button
                    type="button"
                    className="profile-dropdown-item logout-item"
                    onClick={onLogout}
                  >
                    <LogOut size={16} />
                    Log out
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </nav>
    </header>
  );
}
