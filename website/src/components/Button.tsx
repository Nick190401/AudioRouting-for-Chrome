import type { ReactNode } from "react";

type Props = {
  readonly href: string;
  readonly variant?: "primary" | "ghost";
  readonly size?: "sm" | "md" | "lg";
  readonly block?: boolean;
  readonly className?: string;
  readonly children: ReactNode;
};

const BASE =
  "inline-flex items-center justify-center gap-2.5 rounded-xl font-body text-center transition-[filter,transform,border-color] duration-150";

const VARIANT = {
  primary:
    "text-on-mint border border-[#78f2be] surface-primary shadow-primary font-semibold hover:brightness-105 hover:-translate-y-px active:translate-y-px",
  ghost:
    "text-ink border border-line-strong bg-white/[0.02] font-medium hover:border-mint/35",
} as const;

const SIZE = {
  sm: "min-h-11 px-[18px] text-[13px]",
  md: "min-h-12 px-[22px] text-[14.5px]",
  lg: "min-h-[54px] px-[26px] text-[14.5px]",
} as const;

export function Button({
  href,
  variant = "primary",
  size = "md",
  block = false,
  className = "",
  children,
}: Props) {
  return (
    <a
      href={href}
      className={`${BASE} ${VARIANT[variant]} ${SIZE[size]} ${block ? "w-full" : ""} ${className}`}
    >
      {children}
    </a>
  );
}
