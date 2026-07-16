"use client";

import { useState, useRef, useEffect } from "react";

// --- Suggestion Data ---
export const COMPANY_SUGGESTIONS = [
  "Google", "Microsoft", "Amazon", "Apple", "Meta", "Netflix", "Uber", "Lyft",
  "Stripe", "Airbnb", "Salesforce", "Adobe", "Oracle", "IBM", "Intel", "Nvidia",
  "Tesla", "SpaceX", "Twitter / X", "Snap", "Pinterest", "LinkedIn", "Spotify",
  "Shopify", "Atlassian", "Databricks", "Snowflake", "Palantir", "Coinbase",
  "Robinhood", "Block (Square)", "PayPal", "Visa", "Mastercard", "Goldman Sachs",
  "JPMorgan Chase", "Morgan Stanley", "Bloomberg", "Citadel", "Two Sigma",
  "Jane Street", "Samsung", "Sony", "Qualcomm", "AMD", "Cisco", "VMware",
  "ServiceNow", "Workday", "Twilio", "Cloudflare", "MongoDB", "Elastic",
  "HashiCorp", "GitHub", "GitLab", "Figma", "Notion", "Slack", "Zoom",
  "Dropbox", "Box", "HubSpot", "Zendesk", "Okta", "CrowdStrike", "Palo Alto Networks",
  "Infosys", "TCS", "Wipro", "HCL Technologies", "Tech Mahindra", "Cognizant",
  "Capgemini", "Accenture", "Deloitte", "McKinsey", "BCG", "Bain",
  "Flipkart", "Swiggy", "Zomato", "PhonePe", "Razorpay", "CRED", "Zerodha",
  "Ola", "Meesho", "Dream11", "Byju's", "Freshworks", "Zoho",
  "Grab", "GoTo", "Sea Group", "ByteDance", "Tencent", "Alibaba", "Baidu"
];

export const ROLE_SUGGESTIONS = [
  // General Software Engineering & Management
  "Software Engineer",
  "Senior Software Engineer",
  "Staff Software Engineer",
  "Frontend Developer",
  "Backend Developer",
  "Full Stack Developer",
  "Mobile Developer",
  "Android Developer",
  "iOS Developer",
  "DevOps Engineer",
  "Site Reliability Engineer (SRE)",
  "Platform Engineer",
  "Cloud Engineer",
  "Solutions Architect",
  "Infrastructure Engineer",
  "Product Manager",
  "Technical Program Manager",
  "Engineering Manager",
  "QA Engineer",
  "SDET",
  "Test Automation Engineer",
  "Security Engineer",
  "Cybersecurity Analyst",
  "UI/UX Designer",
  "Product Designer",
  "Embedded Systems Engineer",
  "Firmware Engineer",
  "Blockchain Developer",
  "Game Developer",
  "Technical Writer",
  "Developer Advocate",
  "Database Administrator",
  "Network Engineer",
  "System Administrator",
  "Business Analyst",
  "Scrum Master",

  // AI & Machine Learning Roles
  "AI Engineer",
  "Machine Learning Engineer",
  "Generative AI Engineer",
  "LLM Engineer",
  "AI Research Engineer",
  "AI Research Scientist",
  "Deep Learning Engineer",
  "Computer Vision Engineer",
  "Natural Language Processing (NLP) Engineer",
  "Speech AI Engineer",
  "Reinforcement Learning Engineer",
  "AI Solutions Engineer",
  "AI Applications Engineer",
  "AI Software Engineer",
  "AI Platform Engineer",
  "AI Integration Engineer",
  "Prompt Engineer",
  "MLOps Engineer",
  "AI Infrastructure Engineer",
  "Robotics AI Engineer",

  // Data Science Roles
  "Data Scientist",
  "Junior Data Scientist",
  "Applied Data Scientist",
  "Decision Scientist",
  "Research Data Scientist",
  "Product Data Scientist",
  "Marketing Data Scientist",
  "Business Data Scientist",
  "Quantitative Data Scientist",
  "Statistical Analyst",

  // Data Analytics Roles
  "Data Analyst",
  "Business Intelligence (BI) Analyst",
  "Business Intelligence Developer",
  "Product Analyst",
  "Marketing Analyst",
  "Operations Analyst",
  "Financial Data Analyst",
  "Reporting Analyst",
  "Insights Analyst",
  "Risk Analyst",

  // Data Engineering Roles
  "Data Engineer",
  "Junior Data Engineer",
  "Big Data Engineer",
  "Analytics Engineer",
  "ETL Developer",
  "Data Pipeline Engineer",
  "Data Platform Engineer",
  "Data Warehouse Engineer",
  "Database Developer",
  "Database Engineer",

  // AI + Data Hybrid Roles
  "Applied AI Engineer",
  "Applied Machine Learning Engineer",
  "AI/ML Engineer",
  "AI Data Scientist",
  "ML Research Engineer",
  "AI Consultant",
  "AI Solutions Architect",
  "AI Product Engineer",
  "AI Automation Engineer",
  "Intelligent Automation Engineer",

  // Cloud AI & MLOps
  "ML Platform Engineer",
  "AI Cloud Engineer",
  "AWS Machine Learning Engineer",
  "Azure AI Engineer",
  "Google Cloud ML Engineer",
  "AI DevOps Engineer",
  "Model Deployment Engineer",

  // Research Roles
  "Research Scientist (AI/ML)",
  "Machine Learning Researcher",
  "AI Scientist",
  "Data Science Researcher",
  "Computer Vision Researcher",
  "NLP Research Scientist",

  // Entry-Level / Fresher Titles
  "AI Intern",
  "Machine Learning Intern",
  "Data Science Intern",
  "Data Analyst Intern",
  "AI/ML Intern",
  "Junior AI Engineer",
  "Associate AI Engineer",
  "Associate Data Scientist",
  "Associate Data Analyst",
  "Graduate AI Engineer",
  "Graduate Data Scientist",
  "Trainee AI Engineer",
  "Trainee Data Scientist",
  "Software Engineer – AI/ML"
];

// --- AutocompleteInput Component ---
export default function AutocompleteInput({
  value,
  onChange,
  suggestions = [],
  placeholder = "",
  disabled = false,
  label = "",
  icon = null,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [filteredSuggestions, setFilteredSuggestions] = useState([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const wrapperRef = useRef(null);

  // Filter suggestions based on input value
  useEffect(() => {
    if (!value || value.length < 1) {
      setFilteredSuggestions([]);
      setIsOpen(false);
      return;
    }

    const query = value.toLowerCase();
    const filtered = suggestions
      .filter((s) => s.toLowerCase().includes(query))
      .slice(0, 8); // Limit to 8 visible suggestions

    setFilteredSuggestions(filtered);
    setIsOpen(filtered.length > 0);
  }, [value, suggestions]);

  // Reset active index when suggestions change
  useEffect(() => {
    setActiveIndex(-1);
  }, [filteredSuggestions]);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleKeyDown(e) {
    if (e.key === "Escape") {
      setIsOpen(false);
    } else if (e.key === "ArrowDown") {
      e.preventDefault(); // Prevent cursor moving in text input
      if (!isOpen && filteredSuggestions.length > 0) {
        setIsOpen(true);
        setActiveIndex(0);
      } else if (isOpen && filteredSuggestions.length > 0) {
        setActiveIndex((prev) => (prev + 1) % filteredSuggestions.length);
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault(); // Prevent cursor moving in text input
      if (isOpen && filteredSuggestions.length > 0) {
        setActiveIndex((prev) => (prev - 1 + filteredSuggestions.length) % filteredSuggestions.length);
      }
    } else if (e.key === "Enter") {
      if (isOpen && activeIndex >= 0 && activeIndex < filteredSuggestions.length) {
        e.preventDefault(); // Prevent form submission
        handleSelect(filteredSuggestions[activeIndex]);
      }
    }
  }

  function handleSelect(suggestion) {
    onChange(suggestion);
    setIsOpen(false);
  }

  // Highlight matching substring
  function renderHighlighted(text) {
    if (!value) return text;
    const query = value.toLowerCase();
    const idx = text.toLowerCase().indexOf(query);
    if (idx === -1) return text;

    return (
      <>
        {text.slice(0, idx)}
        <span className="autocomplete-highlight">{text.slice(idx, idx + value.length)}</span>
        {text.slice(idx + value.length)}
      </>
    );
  }

  return (
    <div className="autocomplete-wrapper" ref={wrapperRef}>
      {label && <span className="autocomplete-label">{label}</span>}
      <div className="autocomplete-input-row">
        {icon && <span className="autocomplete-icon">{icon}</span>}
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => {
            if (filteredSuggestions.length > 0) setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          className="autocomplete-input"
          autoComplete="off"
        />
      </div>

      {isOpen && filteredSuggestions.length > 0 && (
        <ul className="autocomplete-dropdown">
          {filteredSuggestions.map((suggestion, idx) => (
            <li
              key={idx}
              className={`autocomplete-item ${idx === activeIndex ? "active" : ""}`}
              onMouseEnter={() => setActiveIndex(idx)}
              onMouseDown={(e) => {
                e.preventDefault(); // Prevent blur before click fires
                handleSelect(suggestion);
              }}
            >
              {renderHighlighted(suggestion)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
