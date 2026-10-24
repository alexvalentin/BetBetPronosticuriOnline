"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Menu entries, in display order.
const items = [
  { href: "/", label: "Meciuri" },
  { href: "/rezultate", label: "Rezultate" },
  { href: "/clasamente", label: "Clasamente" },
  { href: "/punctaj", label: "Punctaj" },
];

// Top navigation bar; the link of the current page gets aria-current="page" (styled as active).
export default function Nav() {
  const pathname = usePathname();
  return (
    <nav className="nav" aria-label="Principal">
      {items.map((i) => (
        <Link key={i.href} href={i.href} aria-current={pathname === i.href ? "page" : undefined}>
          {i.label}
        </Link>
      ))}
    </nav>
  );
}
