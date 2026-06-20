import { useState } from "react";

interface BrandLogoProps {
  height?: string;
  className?: string;
}

export function BrandLogo({ height = "h-9", className = "" }: BrandLogoProps) {
  const [failed, setFailed] = useState(false);

  if (!failed) {
    return (
      <img
        src="/logo.png"
        alt="FinextHub Bank"
        className={`${height} w-auto max-w-[160px] object-contain ${className}`}
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <div
      className={`flex ${height} w-[110px] items-center justify-center rounded border-2 border-dashed border-current px-2 ${className}`}
      style={{ opacity: 0.35 }}
    >
      <svg viewBox="0 0 20 10" className="mr-1.5 h-3 w-3 shrink-0 opacity-70" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="1" y="1" width="18" height="8" rx="1" />
        <circle cx="7" cy="5" r="2" />
        <path d="M12 3h4M12 5h3M12 7h4" />
      </svg>
      <span className="text-[9px] font-bold uppercase tracking-widest">Logo</span>
    </div>
  );
}
