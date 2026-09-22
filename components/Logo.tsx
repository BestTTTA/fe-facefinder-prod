import Link from "next/link";

// The 2x2 mark from the brand image: navy top-right, orange bottom-left.
export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <rect x="12" y="0" width="12" height="12" fill="var(--navy)" />
      <rect x="0" y="12" width="12" height="12" fill="var(--orange)" />
    </svg>
  );
}

export function Logo({ className = "" }: { className?: string }) {
  return (
    <Link
      href="/"
      className={`flex items-center gap-2.5 font-semibold tracking-tight ${className}`}
    >
      <LogoMark />
      <span className="text-lg">
        Face<span className="text-orange">Finder</span>
      </span>
    </Link>
  );
}
