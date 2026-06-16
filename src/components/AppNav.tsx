"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { BookOpen, LayoutDashboard, Target } from "lucide-react";

const navItems = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard },
  { label: "Browser", href: "/questions", icon: BookOpen },
  { label: "Allenamento", href: "/allenamento", icon: Target },
];

export function SidebarNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const browserHref = getBrowserHref(pathname, searchParams.toString(), searchParams.get("returnTo"));

  return (
    <aside className="hidden min-h-screen w-56 shrink-0 border-r border-[#dfded6] bg-[#fbfbf8] px-4 py-5 md:flex md:flex-col">
      <Link href="/" className="mb-7 flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-[#ebe9df]">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[#1b4332] text-white">
          <BookOpen size={21} aria-hidden="true" />
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-[#181917]">ISW Quiz</span>
          <span className="block text-xs text-[#667064]">Preparazione esame</span>
        </span>
      </Link>

      <nav className="flex flex-col gap-1.5" aria-label="Navigazione principale">
        {navItems.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          const href = item.href === "/questions" ? browserHref : item.href;
          return (
            <Link
              key={item.href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={[
                "flex h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition",
                active
                  ? "bg-[#d8efe3] text-[#123027]"
                  : "text-[#4b5148] hover:bg-[#ebe9df] hover:text-[#181917]",
              ].join(" ")}
            >
              <item.icon size={18} aria-hidden="true" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

export function MobileNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const browserHref = getBrowserHref(pathname, searchParams.toString(), searchParams.get("returnTo"));

  return (
    <nav
      className="sticky top-0 z-40 grid grid-cols-3 border-b border-[#d8d6cc] bg-[#fbfbf8] px-2 py-2 shadow-[0_6px_20px_rgba(24,25,23,0.07)] md:hidden"
      aria-label="Navigazione principale"
    >
      {navItems.map((item) => {
        const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
        const href = item.href === "/questions" ? browserHref : item.href;
        return (
          <Link
            key={item.href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={[
              "flex min-w-0 flex-col items-center justify-center gap-1 rounded-lg px-1 py-1.5 text-[11px] font-medium",
              active ? "bg-[#d8efe3] text-[#123027]" : "text-[#4b5148]",
            ].join(" ")}
          >
            <item.icon size={18} aria-hidden="true" />
            <span className="w-full truncate text-center">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function getBrowserHref(pathname: string, queryString: string, returnTo: string | null) {
  if (pathname === "/questions") {
    return queryString ? `/questions?${queryString}` : "/questions";
  }

  if (pathname.startsWith("/questions/")) {
    return normalizeQuestionsReturn(returnTo);
  }

  return "/questions";
}

function normalizeQuestionsReturn(value: string | null) {
  if (!value) return "/questions";
  if (value === "/questions" || value.startsWith("/questions?")) return value;
  return "/questions";
}
