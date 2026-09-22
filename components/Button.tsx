import Link from "next/link";
import type { ComponentProps } from "react";

type Variant = "primary" | "dark" | "outline" | "ghost";
type Size = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 rounded-full font-medium whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange disabled:opacity-50 disabled:pointer-events-none";

const variants: Record<Variant, string> = {
  primary: "bg-orange text-white hover:bg-orange-hover",
  dark: "bg-navy text-white hover:bg-navy-soft",
  outline: "border border-line bg-surface text-foreground hover:border-navy",
  ghost: "text-foreground hover:bg-black/5",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-4 text-sm",
  md: "h-11 px-5 text-sm",
  lg: "h-12 px-6 text-base",
};

export function cx(variant: Variant = "primary", size: Size = "md", extra = "") {
  return `${base} ${variants[variant]} ${sizes[size]} ${extra}`;
}

type LinkProps = ComponentProps<typeof Link> & {
  variant?: Variant;
  size?: Size;
};

export function ButtonLink({
  variant = "primary",
  size = "md",
  className = "",
  ...props
}: LinkProps) {
  return <Link className={cx(variant, size, className)} {...props} />;
}

type BtnProps = ComponentProps<"button"> & { variant?: Variant; size?: Size };

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  type = "button",
  ...props
}: BtnProps) {
  return <button type={type} className={cx(variant, size, className)} {...props} />;
}
