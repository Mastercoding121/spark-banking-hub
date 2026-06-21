interface BrandLogoProps {
  height?: string;
  className?: string;
}

export function BrandLogo({ height = "h-9", className = "" }: BrandLogoProps) {
  function handleError(e: React.SyntheticEvent<HTMLImageElement>) {
    const img = e.currentTarget;
    const placeholder = document.createElement("div");
    placeholder.setAttribute(
      "style",
      "display:flex;align-items:center;justify-content:center;border:2px dashed currentColor;border-radius:4px;opacity:0.32;padding:0 10px;min-width:80px;"
    );
    placeholder.className = height;
    placeholder.innerHTML =
      '<svg viewBox="0 0 20 10" style="width:12px;height:12px;margin-right:4px;opacity:.7" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="1" y="1" width="18" height="8" rx="1"/><circle cx="7" cy="5" r="2"/><path d="M12 3h4M12 5h3M12 7h4"/></svg>' +
      '<span style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.12em">Logo</span>';
    img.parentNode?.replaceChild(placeholder, img);
  }

  return (
    <img
      src="/logo.png"
      alt="FinextHub Bank"
      className={`${height} w-auto max-w-[160px] object-contain ${className}`}
      onError={handleError}
    />
  );
}
