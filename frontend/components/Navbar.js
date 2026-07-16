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
  ListTodo,
  BookOpen,
  Award,
  Coins,
  Beaker,
  ClipboardList,
  MonitorPlay,
  Sun,
  Moon,
  X
} from "lucide-react";
import { getTrends } from "@/utils/api";

const links = [
  { href: "/", label: "Home" },
  { href: "/upload", label: "AI Interview" },
  { href: "/speak", label: "Get Set Speak" },
  { href: "/peer", label: "Peer-to-Peer" },
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

  // Gamification & Theme states
  const [theme, setTheme] = useState("dark");
  const [showBadgesModal, setShowBadgesModal] = useState(false);
  const [trendsData, setTrendsData] = useState(null);

  useEffect(() => {
    setAuthed(isAuthed());
    setUser(getUser());
  }, [pathname]);

  // Load and apply theme and trends
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedTheme = localStorage.getItem("confidometer_theme") || "dark";
      setTheme(savedTheme);
      if (savedTheme === "light") {
        document.body.classList.add("light-theme");
      } else {
        document.body.classList.remove("light-theme");
      }
    }
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === "dark" ? "light" : "dark";
    setTheme(newTheme);
    if (typeof window !== "undefined") {
      localStorage.setItem("confidometer_theme", newTheme);
      if (newTheme === "light") {
        document.body.classList.add("light-theme");
      } else {
        document.body.classList.remove("light-theme");
      }
    }
  };

  const handleOpenBadges = async () => {
    setDropdownOpen(false);
    setShowBadgesModal(true);
    try {
      const data = await getTrends();
      setTrendsData(data);
    } catch (err) {
      console.warn("Failed to load badges:", err);
    }
  };

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
                <div className="profile-dropdown custom-profile-dropdown glass-premium">
                  {/* Profile Header */}
                  <div className="profile-dropdown-header">
                    <span className="profile-avatar-lg">{getInitials()}</span>
                    <div className="profile-info">
                      <span className="profile-name">{user?.name || "User"}</span>
                      <span className="profile-email">Access all features with our Premium subscription!</span>
                    </div>
                  </div>

                  {/* Profile Grid of Cards */}
                  <div className="profile-cards-grid">
                    <button type="button" className="profile-grid-card">
                      <ListTodo size={20} className="card-icon blue" />
                      <span>My Lists</span>
                    </button>
                    <button type="button" className="profile-grid-card">
                      <BookOpen size={20} className="card-icon green" />
                      <span>Notebook</span>
                    </button>
                    <button type="button" className="profile-grid-card" onClick={handleOpenBadges}>
                      <Award size={20} className="card-icon orange" />
                      <span>Badges</span>
                    </button>
                    <button type="button" className="profile-grid-card">
                      <Coins size={20} className="card-icon gold" />
                      <span>Points</span>
                    </button>
                  </div>

                  <div className="profile-dropdown-divider" />

                  {/* Standard Text List Items */}
                  <Link
                    href="/peer"
                    className="profile-dropdown-item-new"
                    onClick={() => setDropdownOpen(false)}
                  >
                    <Beaker size={16} className="item-icon" />
                    Try New Features
                  </Link>

                  <button
                    type="button"
                    className="profile-dropdown-item-new disabled"
                  >
                    <ClipboardList size={16} className="item-icon" />
                    Orders
                  </button>

                  <button
                    type="button"
                    className="profile-dropdown-item-new disabled"
                  >
                    <MonitorPlay size={16} className="item-icon" />
                    My Playgrounds
                  </button>

                  <button
                    type="button"
                    className="profile-dropdown-item-new disabled"
                  >
                    <Settings size={16} className="item-icon" />
                    Settings
                  </button>

                  <button
                    type="button"
                    className="profile-dropdown-item-new"
                    onClick={toggleTheme}
                  >
                    {theme === "dark" ? <Sun size={16} className="item-icon" /> : <Moon size={16} className="item-icon" />}
                    Appearance: {theme === "dark" ? "Dark Mode" : "Light Mode"}
                  </button>

                  <div className="profile-dropdown-divider" />

                  <button
                    type="button"
                    className="profile-dropdown-item-new logout-item"
                    onClick={onLogout}
                  >
                    <LogOut size={16} className="item-icon" />
                    Log out
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </nav>

      {/* ── Badges & Achievements Modal Overlay ── */}
      {showBadgesModal && (
        <div className="badges-modal-backdrop">
          <div className="badges-modal-content glass-premium">
            <button className="badges-modal-close" onClick={() => setShowBadgesModal(false)}>
              <X size={18} />
            </button>
            <div className="badges-modal-header">
              <Award size={36} className="modal-title-icon" />
              <h2>Badges & Achievements</h2>
              <p>View your active mock interview progress milestones and unlocks.</p>
            </div>

            {trendsData ? (
              <div className="modal-gamification-body">
                <div className="modal-streak-banner glass">
                  <span className="modal-streak-fire">🔥</span>
                  <div className="modal-streak-details">
                    <h3>{trendsData.streak || 0} Day Practice Streak</h3>
                    <p>Practice daily to keep your streak active and boost consistency!</p>
                  </div>
                  <div className="modal-sessions-badge">
                    Total Sessions: {trendsData.total_interviews || 0}
                  </div>
                </div>

                <div className="modal-badges-grid">
                  {(trendsData.badges || []).map((badge) => (
                    <div key={badge.id} className={`modal-badge-card ${badge.unlocked ? "unlocked" : "locked"}`}>
                      <span className="modal-badge-icon">{badge.icon}</span>
                      <div className="modal-badge-info">
                        <h4>{badge.name}</h4>
                        <p>{badge.description}</p>
                      </div>
                      {badge.unlocked && <span className="modal-badge-check">✓</span>}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="loading-modal-text">Loading your profile achievements...</p>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
