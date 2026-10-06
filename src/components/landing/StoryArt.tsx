export function BrandHeart({ className = "" }: { className?: string }) {
  return <svg className={`m-brand-heart ${className}`} viewBox="0 0 200 180" aria-hidden="true"><path d="M100 162C62 130 12 96 12 55 12 26 34 10 59 10c19 0 33 10 41 25 8-15 22-25 41-25 25 0 47 16 47 45 0 41-50 75-88 107Z" fill="currentColor" /></svg>;
}

export function SectionWave({ from }: { from: "cream" | "red" }) {
  const to = from === "cream" ? "var(--m-red)" : "var(--m-cream)";
  return <div className={`m-section-wave from-${from}`} aria-hidden="true"><svg viewBox="0 0 1440 90" preserveAspectRatio="none"><path className="m-wave-back" d="M0,48 C240,88 480,8 720,44 C960,80 1200,18 1440,54 L1440,90 L0,90 Z" /><path style={{ fill: to }} d="M0,60 C260,94 520,24 760,54 C1000,84 1220,34 1440,60 L1440,90 L0,90 Z" /></svg></div>;
}
