import { ReactNode } from "react";

export function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto min-h-screen max-w-5xl px-4 pb-16 pt-8 sm:px-6">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-3 border-b border-[var(--line)] pb-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
            EDXSO · Assignment 3
          </p>
          <h1 className="display mt-1 text-4xl tracking-tight sm:text-5xl">Interview Accelerator</h1>
          <p className="mt-2 max-w-xl text-sm text-[var(--muted)]">
            JD + resume → role fit → adaptive voice interview → readiness report.
          </p>
        </div>
        <a
          className="text-sm font-medium text-[var(--accent)] underline-offset-4 hover:underline"
          href="https://github.com/nishant-uxs/edxso-interview-accelerator"
          target="_blank"
          rel="noreferrer"
        >
          GitHub
        </a>
      </header>
      {children}
    </div>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-[var(--line)] bg-[var(--card)] p-5 shadow-sm ${className}`}>
      {children}
    </div>
  );
}

export function Pill({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "good" | "warn" | "bad" }) {
  const map = {
    neutral: "bg-[#ece7dc] text-[var(--ink)]",
    good: "bg-[#d7efe6] text-[var(--good)]",
    warn: "bg-[#ffe8c2] text-[var(--warn)]",
    bad: "bg-[#fadadf] text-[var(--bad)]",
  };
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${map[tone]}`}>
      {children}
    </span>
  );
}

export function Button({
  children,
  onClick,
  disabled,
  variant = "primary",
  type = "button",
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "primary" | "ghost" | "danger";
  type?: "button" | "submit";
  className?: string;
}) {
  const styles = {
    primary: "bg-[var(--accent)] text-white hover:brightness-110",
    ghost: "bg-transparent border border-[var(--line)] hover:bg-white/70",
    danger: "bg-[var(--bad)] text-white",
  };
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition ${styles[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

export function List({ items }: { items: string[] }) {
  if (!items?.length) return <p className="text-sm text-[var(--muted)]">None noted</p>;
  return (
    <ul className="space-y-1.5 text-sm">
      {items.map((x) => (
        <li key={x} className="flex gap-2">
          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent)]" />
          <span>{x}</span>
        </li>
      ))}
    </ul>
  );
}

export function Stepper({ step }: { step: number }) {
  const labels = ["Input", "Role", "Fit", "Interview", "Report"];
  return (
    <ol className="mb-6 grid grid-cols-5 gap-2">
      {labels.map((label, i) => {
        const active = i === step;
        const done = i < step;
        return (
          <li
            key={label}
            className={`rounded-xl border px-2 py-2 text-center text-[11px] font-semibold sm:text-xs ${
              active
                ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                : done
                  ? "border-[var(--line)] bg-[#e7f3ee] text-[var(--accent)]"
                  : "border-[var(--line)] bg-white/50 text-[var(--muted)]"
            }`}
          >
            {label}
          </li>
        );
      })}
    </ol>
  );
}
