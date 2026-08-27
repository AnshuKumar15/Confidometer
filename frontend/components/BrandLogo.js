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

        {/* Orange Badge with Rounded Left Corners and Right Notch */}
        <path
          d="M 96 48 
             L 432 48 
             A 20 20 0 0 1 450 76 
             L 366 244 
             Q 354 256 366 268 
             L 450 436 
             A 20 20 0 0 1 432 464 
             L 96 464 
             A 48 48 0 0 1 48 416 
             L 48 96 
             A 48 48 0 0 1 96 48 Z"
          fill="url(#exactNavGrad)"
        />

        {/* Three Concentric "C" Hemispheres */}
        {/* Outer Arc */}
        <path
          d="M 333 137 A 145 145 0 1 0 333 375"
          stroke="#FFFFFF"
          strokeWidth="32"
          strokeLinecap="round"
        />

        {/* Middle Arc */}
        <path
          d="M 306 176 A 98 98 0 1 0 306 336"
          stroke="#FFFFFF"
          strokeWidth="30"
          strokeLinecap="round"
        />

        {/* Inner Arc */}
        <path
          d="M 280 213 A 52 52 0 1 0 280 299"
          stroke="#FFFFFF"
          strokeWidth="28"
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
