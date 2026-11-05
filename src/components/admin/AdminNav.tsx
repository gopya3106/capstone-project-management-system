"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { UserRole } from "@/lib/auth/types";

type NavLink = { href: string; label: string; adminOnly?: boolean };

const LINKS: NavLink[] = [
  { href: "/dashboard/admin", label: "Dashboard Overview" },
  { href: "/dashboard/admin/proposals", label: "Proposals" },
  { href: "/dashboard/admin/projects", label: "Capstone Projects" },
  { href: "/dashboard/admin/mentors", label: "Faculty Mentors" },
  { href: "/dashboard/admin/milestones", label: "Milestones" },
  { href: "/dashboard/admin/submissions", label: "Submissions" },
  { href: "/dashboard/admin/reports", label: "Reports" },
  { href: "/dashboard/admin/students", label: "Student Directory", adminOnly: true },
  { href: "/dashboard/admin/groups", label: "Capstone Groups", adminOnly: true },
];

export function AdminNav({ role = "Admin" }: { role?: UserRole }) {
  const pathname = usePathname();
  const links = LINKS.filter((link) => role === "Admin" || !link.adminOnly);

  return (
    <nav className="flex space-x-1 border-b border-zinc-200 dark:border-zinc-800 pb-3 mb-6 overflow-x-auto">
      {links.map((link) => {
        const isActive =
          link.href === "/dashboard/admin"
            ? pathname === "/dashboard/admin"
            : pathname.startsWith(link.href);

        return (
          <Link
            key={link.href}
            href={link.href}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
              isActive
                ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-sm"
                : "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-zinc-200 dark:hover:bg-zinc-800"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
