"use client";

import { useState, useEffect, useRef } from "react";
import { Users, Briefcase, User, Play, ArrowLeft, PlusCircle, Calendar, Check, AlertCircle, Clock, FileText, CheckCircle, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { isAuthed } from "@/utils/auth";
import PeerRoom from "@/components/PeerRoom";
import DateTimePicker from "@/components/DateTimePicker";
import AutocompleteInput, { ROLE_SUGGESTIONS, COMPANY_SUGGESTIONS } from "@/components/AutocompleteInput";
import { 
  createMeetingRequest, 
  getPendingMeetingRequests, 
  getMyMeetingRequests, 
  acceptMeetingRequest, 
  getMeetingRequestStatus,
  deleteMeetingRequest
} from "@/utils/api";

export default function PeerInterviewPage() {
  const router = useRouter();

  // Auth check on mount
  useEffect(() => {
    if (!isAuthed()) {
      router.push("/login?next=/peer");
    }
  }, [router]);

  const [inRoom, setInRoom] = useState(false);
  const [activeRoomId, setActiveRoomId] = useState("");
  const [activeRole, setActiveRole] = useState("");
  const [activeRequestRoleName, setActiveRequestRoleName] = useState("");
  const [userName, setUserName] = useState("");
  const [isNameSet, setIsNameSet] = useState(false);

  // Tabs: "lobby" | "post" | "my-schedule"
  const [activeTab, setActiveTab] = useState("lobby");

  // Post form states
  const [postRole, setPostRole] = useState("Software Engineer");
  const [companyName, setCompanyName] = useState("");
  const [interviewType, setInterviewType] = useState("technical");
  const [jobDescription, setJobDescription] = useState("");
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduledAt, setScheduledAt] = useState("");
  const [resumeFile, setResumeFile] = useState(null);

  // Request list states
  const [pendingRequests, setPendingRequests] = useState([]);
  const [myRequests, setMyRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [postLoading, setPostLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Polling reference for immediate matching
  const pollingIntervalsRef = useRef({});

  // Retrieve user name
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedName = localStorage.getItem("confidometer_user_name") || "";
      if (savedName.trim()) {
        setUserName(savedName);
        setIsNameSet(true);
      }
    }
  }, []);

  // Fetch lobby and schedule data
  const fetchData = async () => {
    if (!isNameSet) return;
    setLoading(true);
    setError("");
    try {
      const pending = await getPendingMeetingRequests();
      const my = await getMyMeetingRequests();
      setPendingRequests(pending);
      setMyRequests(my);
    } catch (err) {
      setError(err.message || "Failed to load lobby data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [isNameSet]);

  // Setup status polling for immediate matched requests
  useEffect(() => {
    // Check if any of "myRequests" is immediate, pending, and not already polled
    myRequests.forEach((req) => {
      if (req.status === "pending" && req.scheduled_at === null) {
        if (!pollingIntervalsRef.current[req.id]) {
          console.log(`[POLLING] Started status check for request ID ${req.id}`);
          const intervalId = setInterval(async () => {
            try {
              const statusData = await getMeetingRequestStatus(req.id);
              if (statusData.status === "accepted" && statusData.room_id) {
                // Matched! Clear interval, reload requests, and join room
                clearInterval(intervalId);
                delete pollingIntervalsRef.current[req.id];
                fetchData();
                
                // Set match states to join
                setActiveRoomId(statusData.room_id);
                setActiveRole("interviewee");
                setActiveRequestRoleName(statusData.role);
                setInRoom(true);
              }
            } catch (err) {
              console.warn("[POLLING] Status check failed:", err);
            }
          }, 3000);
          pollingIntervalsRef.current[req.id] = intervalId;
        }
      }
    });

    // Cleanup cancelled/finished intervals
    return () => {
      // Nothing needed on simple ticks, but let's clear all on unmount
    };
  }, [myRequests]);

  // Clear all polling intervals on unmount
  useEffect(() => {
    return () => {
      Object.values(pollingIntervalsRef.current).forEach((intervalId) => clearInterval(intervalId));
    };
  }, []);

  const handleSaveName = (e) => {
    e.preventDefault();
    if (!userName.trim()) return;
    if (typeof window !== "undefined") {
      localStorage.setItem("confidometer_user_name", userName.trim());
    }
    setIsNameSet(true);
  };

  const handlePostRequest = async (e) => {
    e.preventDefault();
    if (!postRole.trim()) {
      setError("Please select or type a target role.");
      return;
    }
    if (!companyName.trim()) {
      setError("Please select or type a target company name.");
      return;
    }
    if (!resumeFile) {
      setError("Please upload your resume to post a request.");
      return;
    }
    if (isScheduled && !scheduledAt) {
      setError("Please select a date and time for the scheduled interview.");
      return;
    }
    setPostLoading(true);
    setError("");
    setSuccessMsg("");

    try {
      const formData = new FormData();
      formData.append("role", postRole);
      formData.append("company_name", companyName);
      formData.append("interview_type", interviewType);
      formData.append("resume", resumeFile);
      if (jobDescription) formData.append("job_description", jobDescription);
      if (isScheduled && scheduledAt) {
        formData.append("scheduled_at", scheduledAt);
      }

      await createMeetingRequest(formData);
      setSuccessMsg("Interview request posted successfully!");
      setCompanyName("");
      setJobDescription("");
      setResumeFile(null);
      setIsScheduled(false);
      setScheduledAt("");
      setActiveTab("my-schedule");
      fetchData();
    } catch (err) {
      setError(err.message || "Failed to post interview request.");
    } finally {
      setPostLoading(false);
    }
  };

  const handleAcceptRequest = async (requestId) => {
    setError("");
    setSuccessMsg("");
    try {
      const result = await acceptMeetingRequest(requestId);
      if (result.room_id) {
        // Immediate request accepted, put acceptor directly into the room
        setActiveRoomId(result.room_id);
        setActiveRole("interviewer");
        setActiveRequestRoleName(result.role);
        setInRoom(true);
      } else {
        // Scheduled request accepted
        setSuccessMsg(`Mock Interview request accepted successfully! Details added to your schedule.`);
        setActiveTab("my-schedule");
        fetchData();
      }
    } catch (err) {
      setError(err.message || "Failed to accept interview request.");
    }
  };

  const handleDeleteRequest = async (requestId) => {
    if (!window.confirm("Are you sure you want to delete this interview request?")) {
      return;
    }
    setError("");
    setSuccessMsg("");
    try {
      await deleteMeetingRequest(requestId);
      setSuccessMsg("Interview request deleted successfully.");
      fetchData();
    } catch (err) {
      setError(err.message || "Failed to delete request.");
    }
  };

  const handleJoinPredefinedRoom = (req) => {
    if (!req.room_id) return;
    setActiveRoomId(req.room_id);
    const roleForUser = req.user_id === req.user?.id ? "interviewee" : "interviewer";
    // wait, actually req.user_id is the interviewee (poster)
    // If the request was posted by current user (whose name or ID matches), they are interviewee.
    // Since we returned user detail, let's verify if req.user_id is the interviewee.
    // If the logged in user created it, they are interviewee, else interviewer.
    // We can check if req.interviewer_id is the user. Or since we know they clicked it,
    // let's pass interviewee if current user is poster.
    // We don't have user ID in state directly, but we can check if req.user?.name matches userName
    // Or simpler: backend returns user object. We can check if req.user?.name === userName
    // Let's pass the role to join.
    const isPoster = req.user?.name === userName || req.interviewer?.name !== userName;
    setActiveRole(isPoster ? "interviewee" : "interviewer");
    setActiveRequestRoleName(req.role);
    setInRoom(true);
  };

  if (inRoom && activeRoomId && activeRole) {
    return (
      <div className="peer-workspace-wrapper">
        <PeerRoom
          role={activeRequestRoleName}
          userName={userName}
          roomId={activeRoomId}
          myRoleProp={activeRole}
          onLeave={() => {
            setInRoom(false);
            setActiveRoomId("");
            setActiveRole("");
            fetchData();
          }}
        />
      </div>
    );
  }

  if (!isNameSet) {
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
            Practice interviewing with a real person. Post your mock interview requests or accept 
            requests from other candidates to take turns as the Interviewer and the Interviewee.
          </p>
        </section>

        <div className="peer-setup-card glass">
          <div className="setup-card-header">
            <Users size={32} style={{ color: "var(--teal)" }} />
            <h2>Enter Your Display Name</h2>
          </div>

          <form onSubmit={handleSaveName} className="peer-setup-form">
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

            <button type="submit" className="button primary match-btn" disabled={!userName.trim()}>
              <Play size={16} />
              Enter Request Lobby
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="peer-lobby-page" style={{ padding: "40px 20px", maxWidth: "1200px", margin: "0 auto" }}>
      <div className="back-link-container" style={{ marginBottom: "20px" }}>
        <Link href="/upload" className="back-link" style={{ display: "inline-flex", alignItems: "center", gap: "8px", color: "var(--muted)", textDecoration: "none" }}>
          <ArrowLeft size={16} />
          <span>Back to Solo Mode</span>
        </Link>
      </div>

      <header className="lobby-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "40px" }}>
        <div>
          <h1 style={{ fontSize: "2.4rem", margin: "0 0 8px 0", color: "var(--text)" }}>Peer-to-Peer Interview Lobby</h1>
          <p style={{ color: "var(--muted)", margin: 0 }}>Logged in as <strong>{userName}</strong> · Practice with other candidates</p>
        </div>
        
        <div className="lobby-tabs glass" style={{ display: "flex", gap: "5px", padding: "5px", borderRadius: "10px", border: "1px solid var(--line)", background: "rgba(255,255,255,0.02)" }}>
          <button 
            className={`tab-btn ${activeTab === "lobby" ? "active" : ""}`}
            onClick={() => setActiveTab("lobby")}
            style={{
              padding: "8px 16px",
              border: "none",
              borderRadius: "6px",
              background: activeTab === "lobby" ? "rgba(0,184,148,0.15)" : "transparent",
              color: activeTab === "lobby" ? "var(--teal)" : "var(--muted)",
              cursor: "pointer",
              fontWeight: "600",
              fontSize: "0.92rem",
              transition: "all 0.2s"
            }}
          >
            Lobby Board
          </button>
          <button 
            className={`tab-btn ${activeTab === "post" ? "active" : ""}`}
            onClick={() => setActiveTab("post")}
            style={{
              padding: "8px 16px",
              border: "none",
              borderRadius: "6px",
              background: activeTab === "post" ? "rgba(0,184,148,0.15)" : "transparent",
              color: activeTab === "post" ? "var(--teal)" : "var(--muted)",
              cursor: "pointer",
              fontWeight: "600",
              fontSize: "0.92rem",
              transition: "all 0.2s"
            }}
          >
            Post Interview Request
          </button>
          <button 
            className={`tab-btn ${activeTab === "my-schedule" ? "active" : ""}`}
            onClick={() => setActiveTab("my-schedule")}
            style={{
              padding: "8px 16px",
              border: "none",
              borderRadius: "6px",
              background: activeTab === "my-schedule" ? "rgba(0,184,148,0.15)" : "transparent",
              color: activeTab === "my-schedule" ? "var(--teal)" : "var(--muted)",
              cursor: "pointer",
              fontWeight: "600",
              fontSize: "0.92rem",
              transition: "all 0.2s"
            }}
          >
            My Schedule
          </button>
        </div>
      </header>

      {/* Messages */}
      {error && (
        <div className="alert error-alert" style={{ display: "flex", gap: "10px", background: "rgba(225,112,85,0.1)", border: "1px solid #e17055", color: "#e17055", padding: "12px 16px", borderRadius: "8px", marginBottom: "20px", alignItems: "center" }}>
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}
      {successMsg && (
        <div className="alert success-alert" style={{ display: "flex", gap: "10px", background: "rgba(0,184,148,0.1)", border: "1px solid var(--teal)", color: "var(--teal)", padding: "12px 16px", borderRadius: "8px", marginBottom: "20px", alignItems: "center" }}>
          <Check size={18} />
          <span>{successMsg}</span>
        </div>
      )}

      {/* TAB CONTENT: LOBBY BOARD */}
      {activeTab === "lobby" && (
        <section className="lobby-section">
          {loading ? (
            <div style={{ textAlign: "center", padding: "60px 0" }}>
              <div className="peer-lobby-spinner" style={{ margin: "0 auto 20px auto" }} />
              <p style={{ color: "var(--muted)" }}>Loading requests feed...</p>
            </div>
          ) : pendingRequests.length === 0 ? (
            <div className="glass" style={{ textAlign: "center", padding: "60px 20px", borderRadius: "16px", border: "1px solid var(--line)" }}>
              <Users size={48} style={{ color: "var(--muted)", marginBottom: "16px", opacity: 0.5 }} />
              <h2 style={{ fontSize: "1.4rem", margin: "0 0 8px 0" }}>Lobby is Empty</h2>
              <p style={{ color: "var(--muted)", margin: "0 0 24px 0", maxWidth: "450px", marginLeft: "auto", marginRight: "auto" }}>
                There are currently no mock interview requests posted by other users. Try posting a request yourself!
              </p>
              <button className="button primary" onClick={() => setActiveTab("post")}>
                Post Interview Request
              </button>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: "20px" }}>
              {pendingRequests.map((req) => (
                <div key={req.id} className="request-card glass" style={{ padding: "24px", borderRadius: "16px", border: "1px solid var(--line)", background: "rgba(255,255,255,0.01)", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
                      <span className="badge" style={{ background: "rgba(0,184,148,0.12)", color: "var(--teal)", padding: "4px 10px", borderRadius: "6px", fontSize: "0.78rem", fontWeight: "600", textTransform: "uppercase" }}>
                        {req.interview_type}
                      </span>
                      <div style={{ display: "flex", alignItems: "center", gap: "4px", color: req.scheduled_at ? "var(--cyan)" : "#fdcb6e", fontSize: "0.82rem", fontWeight: "600" }}>
                        <Clock size={14} />
                        <span>{req.scheduled_at ? "Scheduled" : "Interview Now"}</span>
                      </div>
                    </div>

                    <h3 style={{ fontSize: "1.25rem", margin: "0 0 6px 0", color: "var(--text)" }}>
                      {req.role.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}
                    </h3>
                    <p style={{ color: "var(--muted)", margin: "0 0 16px 0", fontSize: "0.92rem" }}>
                      Target Company: <strong>{req.company_name}</strong>
                    </p>

                    <div style={{ display: "flex", flexDirection: "column", gap: "10px", margin: "16px 0", padding: "12px 14px", borderRadius: "8px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.03)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem" }}>
                        <span style={{ color: "var(--muted)" }}>Candidate Name:</span>
                        <strong style={{ color: "var(--text)" }}>{req.user?.name || "Anonymous"}</strong>
                      </div>
                      {req.scheduled_at && (
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem" }}>
                          <span style={{ color: "var(--muted)" }}>Scheduled For:</span>
                          <strong style={{ color: "var(--cyan)" }}>
                            {new Date(req.scheduled_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                          </strong>
                        </div>
                      )}
                    </div>
                  </div>

                  <button 
                    onClick={() => handleAcceptRequest(req.id)}
                    className="button primary" 
                    style={{ width: "100%", marginTop: "10px" }}
                  >
                    Accept Request & Interview
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* TAB CONTENT: POST REQUEST FORM */}
      {activeTab === "post" && (
        <section className="post-section glass" style={{ padding: "30px", borderRadius: "16px", border: "1px solid var(--line)", background: "rgba(255,255,255,0.01)", maxWidth: "700px", margin: "0 auto" }}>
          <h2 style={{ fontSize: "1.6rem", margin: "0 0 20px 0", borderBottom: "1px solid var(--line)", paddingBottom: "12px" }}>
            Post Interview Request
          </h2>

          <form onSubmit={handlePostRequest} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
             <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
              <label style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <span style={{ fontSize: "0.9rem", color: "var(--muted)", fontWeight: "600" }}>Target Role</span>
                <AutocompleteInput
                  value={postRole}
                  onChange={setPostRole}
                  suggestions={ROLE_SUGGESTIONS}
                  placeholder="e.g. Software Engineer, AI Specialist"
                />
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <span style={{ fontSize: "0.9rem", color: "var(--muted)", fontWeight: "600" }}>Interview Type</span>
                <select
                  value={interviewType}
                  onChange={(e) => setInterviewType(e.target.value)}
                  className="styled-select"
                  style={{ width: "100%" }}
                >
                  <option value="technical">Technical</option>
                  <option value="hr">HR Round</option>
                  <option value="behavioural">Behavioural</option>
                  <option value="negotiation">Negotiation</option>
                </select>
              </label>
            </div>

            <label style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <span style={{ fontSize: "0.9rem", color: "var(--muted)", fontWeight: "600" }}>Company Name</span>
              <AutocompleteInput
                value={companyName}
                onChange={setCompanyName}
                suggestions={COMPANY_SUGGESTIONS}
                placeholder="e.g. Google, Stripe"
              />
            </label>

            <label style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <span style={{ fontSize: "0.9rem", color: "var(--muted)", fontWeight: "600" }}>Upload Resume (PDF only)</span>
              <input
                type="file"
                accept=".pdf"
                required
                onChange={(e) => setResumeFile(e.target.files[0])}
                style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px dashed var(--line)", background: "rgba(255,255,255,0.01)", color: "var(--muted)", cursor: "pointer" }}
              />
            </label>

            <label style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <span style={{ fontSize: "0.9rem", color: "var(--muted)", fontWeight: "600" }}>Job Description (Optional)</span>
              <textarea
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
                placeholder="Paste the target Job Description to help personalize the interviewer questions."
                style={{ width: "100%", minHeight: "100px", padding: "12px 14px", borderRadius: "8px", background: "rgba(0,0,0,0.2)", border: "1px solid var(--line)", color: "var(--text)", resize: "vertical", fontFamily: "inherit" }}
              />
            </label>

            {/* Time Toggle */}
            <div style={{ display: "flex", flexDirection: "column", gap: "10px", margin: "10px 0" }}>
              <span style={{ fontSize: "0.9rem", color: "var(--muted)", fontWeight: "600" }}>Scheduling Mode</span>
              <div style={{ display: "flex", gap: "20px" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
                  <input
                    type="radio"
                    checked={!isScheduled}
                    onChange={() => setIsScheduled(false)}
                    name="schedule-mode"
                  />
                  <span>Interview Immediately (Now)</span>
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
                  <input
                    type="radio"
                    checked={isScheduled}
                    onChange={() => setIsScheduled(true)}
                    name="schedule-mode"
                  />
                  <span>Schedule for Future Date</span>
                </label>
              </div>
            </div>

            {isScheduled && (
              <label style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <span style={{ fontSize: "0.9rem", color: "var(--muted)", fontWeight: "600" }}>Interview Date & Time</span>
                <DateTimePicker
                  value={scheduledAt}
                  onChange={setScheduledAt}
                  required={isScheduled}
                />
              </label>
            )}

            <button 
              type="submit" 
              className="button primary" 
              disabled={postLoading}
              style={{ padding: "12px 20px", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", cursor: "pointer", fontWeight: "600" }}
            >
              {postLoading ? (
                <>
                  <div className="peer-lobby-spinner" style={{ width: "16px", height: "16px", borderWidth: "2px" }} />
                  <span>Posting Request...</span>
                </>
              ) : (
                <>
                  <PlusCircle size={18} />
                  <span>Post Interview Request</span>
                </>
              )}
            </button>
          </form>
        </section>
      )}

      {/* TAB CONTENT: MY SCHEDULE */}
      {activeTab === "my-schedule" && (
        <section className="schedule-section">
          {loading ? (
            <div style={{ textAlign: "center", padding: "60px 0" }}>
              <div className="peer-lobby-spinner" style={{ margin: "0 auto 20px auto" }} />
              <p style={{ color: "var(--muted)" }}>Loading schedule...</p>
            </div>
          ) : myRequests.length === 0 ? (
            <div className="glass" style={{ textAlign: "center", padding: "60px 20px", borderRadius: "16px", border: "1px solid var(--line)" }}>
              <Calendar size={48} style={{ color: "var(--muted)", marginBottom: "16px", opacity: 0.5 }} />
              <h2 style={{ fontSize: "1.4rem", margin: "0 0 8px 0" }}>No Active Matches</h2>
              <p style={{ color: "var(--muted)", margin: "0 0 24px 0", maxWidth: "450px", marginLeft: "auto", marginRight: "auto" }}>
                You haven't posted any request slots or accepted any peer interviews yet.
              </p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {myRequests.map((req) => {
                const isMyPost = req.user_id === req.user?.id || req.user?.name === userName;
                const roleInInterview = isMyPost ? "Interviewee (Candidate)" : "Interviewer (Evaluator)";
                const matchedUser = isMyPost ? req.interviewer?.name : req.user?.name;

                return (
                  <div key={req.id} className="schedule-item glass" style={{ padding: "20px 24px", borderRadius: "12px", border: "1px solid var(--line)", background: "rgba(255,255,255,0.01)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "20px" }}>
                    <div style={{ display: "flex", gap: "20px", alignItems: "center" }}>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "10px 14px", borderRadius: "8px", background: "rgba(0,184,148,0.08)", border: "1px solid rgba(0,184,148,0.15)", minWidth: "110px" }}>
                        <span style={{ fontSize: "0.72rem", color: "var(--teal)", fontWeight: "600", textTransform: "uppercase" }}>Role</span>
                        <strong style={{ fontSize: "0.95rem", color: "var(--text)" }}>{isMyPost ? "Candidate" : "Interviewer"}</strong>
                      </div>

                      <div>
                        <h3 style={{ fontSize: "1.15rem", margin: "0 0 4px 0" }}>
                          {req.role.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}
                        </h3>
                        <div style={{ display: "flex", gap: "16px", color: "var(--muted)", fontSize: "0.88rem", flexWrap: "wrap" }}>
                          <span>Company: <strong style={{ color: "var(--text)" }}>{req.company_name}</strong></span>
                          <span>Type: <strong style={{ color: "var(--text)" }}>{req.interview_type}</strong></span>
                          {req.scheduled_at && (
                            <span>Date: <strong style={{ color: "var(--cyan)" }}>{new Date(req.scheduled_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</strong></span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                      {/* Status / Matching Info */}
                      {req.status === "pending" ? (
                        req.scheduled_at === null ? (
                          <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "8px 14px", borderRadius: "8px", background: "rgba(253,203,110,0.08)", border: "1px solid rgba(253,203,110,0.15)" }}>
                            <div className="peer-lobby-spinner" style={{ width: "14px", height: "14px", borderWidth: "2px" }} />
                            <span style={{ fontSize: "0.88rem", color: "#fdcb6e", fontWeight: "600" }}>Searching for match...</span>
                          </div>
                        ) : (
                          <div style={{ padding: "6px 12px", borderRadius: "6px", background: "rgba(255,255,255,0.03)", border: "1px solid var(--line)" }}>
                            <span style={{ fontSize: "0.85rem", color: "var(--muted)" }}>Awaiting match acceptance</span>
                          </div>
                        )
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
                          <span style={{ fontSize: "0.82rem", color: "var(--muted)", marginBottom: "4px" }}>
                            Matched with: <strong style={{ color: "var(--text)" }}>{matchedUser || "Anonymous"}</strong>
                          </span>
                          
                          {/* Join room button for immediate matched requests */}
                          {req.scheduled_at === null && req.room_id && (
                            <button 
                              onClick={() => handleJoinPredefinedRoom(req)}
                              className="button primary" 
                              style={{ display: "flex", alignItems: "center", gap: "6px", padding: "6px 14px", fontSize: "0.88rem" }}
                            >
                              <Play size={14} />
                              Join Room
                            </button>
                          )}

                          {/* Scheduled Match Info */}
                          {req.scheduled_at !== null && (
                            <span style={{ fontSize: "0.82rem", color: "var(--teal)", fontWeight: "600", display: "flex", alignItems: "center", gap: "4px" }}>
                              <CheckCircle size={14} /> Match Active
                            </span>
                          )}
                        </div>
                      )}

                      {/* Delete button for candidate's own request */}
                      {isMyPost && (
                        <button
                          onClick={() => handleDeleteRequest(req.id)}
                          style={{
                            background: "rgba(248, 113, 113, 0.08)",
                            border: "1px solid rgba(248, 113, 113, 0.25)",
                            borderRadius: "8px",
                            color: "var(--danger)",
                            padding: "8px",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            transition: "all 0.2s"
                          }}
                          className="delete-req-btn"
                          title="Delete Request"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      <style jsx global>{`
        .delete-req-btn:hover {
          background: rgba(248, 113, 113, 0.2) !important;
          border-color: var(--danger) !important;
          transform: scale(1.05);
        }
      `}</style>
    </div>
  );
}
