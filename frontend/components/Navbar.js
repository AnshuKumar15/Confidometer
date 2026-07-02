"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { clearSession, isAuthed } from "@/utils/auth";
import { useEffect, useState } from "react";

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

  useEffect(() => {
    setAuthed(isAuthed());
  }, [pathname]);

  function onLogout() {
    clearSession();
    setAuthed(false);
    router.push("/login");
  }

  return (
    <header className="nav-wrap">
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
            <button onClick={onLogout} className="button subtle" type="button">
              Logout
            </button>
          )}
        </div>
      </nav>
    </header>
  );
}
