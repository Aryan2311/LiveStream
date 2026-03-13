"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Button } from "@/components/ui/button";
import { useSession } from "@/components/providers/session-provider";

const items = [
  { href: "/", label: "Home" },
  { href: "/browse", label: "Browse" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/studio", label: "Studio" },
];

export function AppNav() {
  const pathname = usePathname();
  const { user, isAuthenticated, clearSession } = useSession();

  return (
    <div className="flex flex-col gap-4 rounded-3xl border border-white/10 bg-white/5 p-4 backdrop-blur sm:flex-row sm:items-center sm:justify-between">
      <nav className="flex flex-wrap gap-2">
        {items.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-full px-4 py-2 text-sm transition ${
                active ? "bg-cyan-400 text-slate-950" : "text-slate-300 hover:bg-white/8 hover:text-white"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="flex flex-wrap items-center gap-3 text-sm text-slate-300">
        {isAuthenticated && user ? (
          <>
            <span>
              Signed in as <span className="font-medium text-white">{user.display_name}</span>
            </span>
            <Button variant="secondary" onClick={clearSession}>
              Sign out
            </Button>
          </>
        ) : (
          <>
            <Link className="text-slate-300 transition hover:text-white" href="/login">
              Login
            </Link>
            <Link className="text-slate-300 transition hover:text-white" href="/register">
              Register
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
