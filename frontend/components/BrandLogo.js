"use client";

export default function BrandLogo({ size = 32, showText = true, className = "" }) {
  return (
    <div
      className={`brand-logo-container ${className}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 10,
        cursor: "pointer"
      }}
    >
      <svg
        viewBox="0 0 512 512"
        width={size}
        height={size}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{
          flexShrink: 0,
          filter: "drop-shadow(0 4px 10px rgba(255, 110, 0, 0.35))",
          transition: "transform 0.2s ease, filter 0.2s ease"
        }}
      >
        <defs>
          <linearGradient id="exactNavGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FF7F00" />
            <stop offset="100%" stopColor="#FF6200" />
          </linearGradient>
        </defs>

        {/* Orange Badge with Pointy End on Left and Balanced Notch */}
        <path
          d="M 416 48 
             L 88 48 
             A 20 20 0 0 0 70 76 
             L 122 244 
             Q 130 256 122 268 
             L 70 436 
             A 20 20 0 0 0 88 464 
             L 416 464 
             A 48 48 0 0 0 464 416 
             L 464 96 
             A 48 48 0 0 0 416 48 Z"
          fill="url(#exactNavGrad)"
        />

        {/* Three Concentric "C" Hemispheres with Generous Spacing */}
        {/* Outer Arc */}
        <path
          d="M 380 153 A 126 126 0 1 0 380 359"
          stroke="#FFFFFF"
          strokeWidth="28"
          strokeLinecap="round"
        />

        {/* Middle Arc */}
        <path
          d="M 355 186 A 85 85 0 1 0 355 326"
          stroke="#FFFFFF"
          strokeWidth="26"
          strokeLinecap="round"
        />

        {/* Inner Arc */}
        <path
          d="M 330 220 A 45 45 0 1 0 330 292"
          stroke="#FFFFFF"
          strokeWidth="24"
          strokeLinecap="round"
        />
      </svg>

      {showText && (
        <span
          style={{
            fontFamily: "var(--font-heading), 'Space Grotesk', sans-serif",
            fontWeight: 800,
            fontSize: "1.25rem",
            letterSpacing: "-0.025em",
            color: "var(--text)",
            display: "inline-block"
          }}
        >
          Confidometer
        </span>
      )}
    </div>
  );
}
