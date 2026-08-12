"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, Info } from "lucide-react";
import { saveSession } from "@/utils/auth";
import { register, login } from "@/utils/api";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showGuidelines, setShowGuidelines] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [rules, setRules] = useState({
    length: false,
    uppercase: false,
    lowercase: false,
    number: false,
    special: false,
    noPersonal: false,
    noPredictable: false
  });

  // Calculate password strength rules dynamically
  useEffect(() => {
    const emailPrefix = email ? email.split("@")[0].toLowerCase() : "";
    const nameLower = name ? name.toLowerCase() : "";
    const passLower = password.toLowerCase();

    const newRules = {
      length: password.length >= 8,
      uppercase: /[A-Z]/.test(password),
      lowercase: /[a-z]/.test(password),
      number: /[0-9]/.test(password),
      special: /[^A-Za-z0-9]/.test(password),
      noPersonal: true,
      noPredictable: true
    };

    if (password) {
      if (nameLower && nameLower.length > 2 && passLower.includes(nameLower)) {
        newRules.noPersonal = false;
      }
      if (emailPrefix && emailPrefix.length > 2 && passLower.includes(emailPrefix)) {
        newRules.noPersonal = false;
      }

      const commonWords = ["password", "123456", "12345678", "qwerty", "admin", "welcome", "letmein"];
      for (const word of commonWords) {
        if (passLower.includes(word)) {
          newRules.noPredictable = false;
        }
      }

      if (/123|234|345|456|567|678|789/.test(password)) {
        newRules.noPredictable = false;
      }
    } else {
      newRules.noPersonal = false;
      newRules.noPredictable = false;
    }

    setRules(newRules);
  }, [password, name, email]);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    // Verify all password guidelines are met
    const allRulesMet = Object.values(rules).every((val) => val === true);
    if (!allRulesMet) {
      setError("Please follow the guidelines for the password.");
      setShowGuidelines(true);
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);

    try {
      // 1. Call registration API with name
      await register({ email, password, name });

      // 2. Automatically log in to get the access token
      const loginData = await login({ email, password });

      // 3. Save session and redirect
      saveSession({
        accessToken: loginData.access_token,
        user: { email, name }
      });

      router.push("/upload");
      router.refresh();
    } catch (err) {
      setError(err.message || "Registration failed");
      setLoading(false);
    }
  }

  return (
    <div className="auth-wrap">
      <form className="auth-card glass" onSubmit={handleSubmit}>
        <h1>Create your account</h1>
        <p>Sign up to run confidence analysis on your interview recordings.</p>

        <label>
          What should we call you?
          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            placeholder="Your name"
          />
        </label>

        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            placeholder="name@example.com"
          />
        </label>

        <label style={{ position: "relative" }}>
          Password
          <div className="password-input-wrapper">
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              onFocus={() => setShowGuidelines(true)}
              required
              placeholder="Enter secure password"
            />
            <div className="password-controls-right">
              <button
                type="button"
                className="icon-button"
                onClick={() => setShowPassword(!showPassword)}
                title={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
              <button
                type="button"
                className="icon-button"
                onClick={() => setShowGuidelines(!showGuidelines)}
                title="Password guidelines"
              >
                <Info size={16} />
              </button>
            </div>
          </div>

          {showGuidelines && (
            <div className="guidelines-card glass">
              <h4>Password Guidelines</h4>
              <ul>
                <li className={rules.length ? "valid" : "invalid"}>
                  <span className="bullet">{rules.length ? "✓" : "•"}</span> Minimum 8 characters long
                </li>
                <li className={rules.uppercase ? "valid" : "invalid"}>
                  <span className="bullet">{rules.uppercase ? "✓" : "•"}</span> One uppercase letter
                </li>
                <li className={rules.lowercase ? "valid" : "invalid"}>
                  <span className="bullet">{rules.lowercase ? "✓" : "•"}</span> One lowercase letter
                </li>
                <li className={rules.number ? "valid" : "invalid"}>
                  <span className="bullet">{rules.number ? "✓" : "•"}</span> One number
                </li>
                <li className={rules.special ? "valid" : "invalid"}>
                  <span className="bullet">{rules.special ? "✓" : "•"}</span> One special character
                </li>
                <li className={rules.noPersonal ? "valid" : "invalid"}>
                  <span className="bullet">{rules.noPersonal ? "✓" : "•"}</span> Avoid name or email prefix
                </li>
                <li className={rules.noPredictable ? "valid" : "invalid"}>
                  <span className="bullet">{rules.noPredictable ? "✓" : "•"}</span> Avoid common patterns (e.g. 123, password)
                </li>
              </ul>
            </div>
          )}
        </label>

        <label>
          Confirm Password
          <input
            type={showPassword ? "text" : "password"}
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            required
            placeholder="Repeat password"
          />
        </label>

        {error ? <p className="error-text">{error}</p> : null}

        <button className="button primary" disabled={loading} type="submit" style={{ marginTop: "24px" }}>
          {loading ? "Creating account..." : "Sign up"}
        </button>

        <div className="auth-card-footer">
          Already have an account? <Link href="/login">Sign in</Link>
        </div>
      </form>
    </div>
  );
}
