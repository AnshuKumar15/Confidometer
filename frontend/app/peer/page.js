"use client";

import { useState, useEffect } from "react";
import { Users, Briefcase, User, Play, ArrowLeft } from "lucide-react";
import Link from "next/link";
import PeerRoom from "@/components/PeerRoom";
import { ROLE_SUGGESTIONS } from "@/components/AutocompleteInput";

export default function PeerInterviewPage() {
  const [inRoom, setInRoom] = useState(false);
  const [role, setRole] = useState("software_engineer");
  const [userName, setUserName] = useState("");

  // Retrieve user name if saved locally, or prompt
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedName = localStorage.getItem("confidometer_user_name") || "";
      setUserName(savedName);
    }
  }, []);

  const handleStartMatching = (e) => {
    e.preventDefault();
    if (!userName.trim()) return;

    if (typeof window !== "undefined") {
      localStorage.setItem("confidometer_user_name", userName.trim());
    }
    setInRoom(true);
  };

  if (inRoom) {
    return (
      <div className="peer-workspace-wrapper">
        <PeerRoom
          role={role}
          userName={userName}
          onLeave={() => setInRoom(false)}
        />
      </div>
    );
  }

  return (
    <div className="peer-setup-page">
      <div className="back-link-container">
        <Link href="/upload" className="back-link">
          <ArrowLeft size={16} />
          <span>Back to Solo Mode</span>
        </Link>
      </div>

      <section className="section-head">
        <h1>Peer-to-Peer Mock Interviews</h1>
        <p>
          Connect instantly with other candidates preparing for interviews. Take turns
          roleplaying as the Interviewer (following AI rubrics) and the Interviewee
          while we run our local communication diagnostics in the background.
        </p>
      </section>

      <div className="peer-setup-card glass">
        <div className="setup-card-header">
          <Users size={32} style={{ color: "var(--teal)" }} />
          <h2>Join Matchmaking Lobby</h2>
        </div>

        <form onSubmit={handleStartMatching} className="peer-setup-form">
          <label className="peer-form-label">
            <span className="label-text">Your Display Name</span>
            <div className="input-with-icon">
              <User size={16} className="input-icon" />
              <input
                type="text"
                required
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                placeholder="Enter your name"
                className="peer-input"
              />
            </div>
          </label>

          <label className="peer-form-label">
            <span className="label-text">Target Interview Domain</span>
            <div className="input-with-icon">
              <Briefcase size={16} className="input-icon" />
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="peer-input select-input"
              >
                <option value="software_engineer">Software Engineer (General)</option>
                <option value="frontend_developer">Frontend Developer</option>
                <option value="backend_developer">Backend Developer</option>
                <option value="product_manager">Product Manager</option>
                <option value="data_scientist">Data Scientist</option>
                <option value="hr_manager">Human Resources</option>
              </select>
            </div>
          </label>

          <button type="submit" className="button primary match-btn" disabled={!userName.trim()}>
            <Play size={16} />
            Find a Match
          </button>
        </form>
      </div>
    </div>
  );
}
