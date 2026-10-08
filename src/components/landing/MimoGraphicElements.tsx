function MimoHeart({ className }: { className: string }) {
  return <svg className={`m-graphic-heart ${className}`} viewBox="0 0 200 180" fill="none"><path d="M100 162C62 130 12 96 12 55 12 26 34 10 59 10c19 0 33 10 41 25 8-15 22-25 41-25 25 0 47 16 47 45 0 41-50 75-88 107Z" fill="currentColor" /></svg>;
}

export default function MimoGraphicElements() {
  return <div className="m-story-graphics z-0 pointer-events-none" aria-hidden="true">
    <MimoHeart className="m-graphic-heart-one" />
    <MimoHeart className="m-graphic-heart-two" />
    <MimoHeart className="m-graphic-heart-three" />
    <MimoHeart className="m-graphic-heart-four" />
    <svg className="m-graphic-tube m-graphic-tube-top" viewBox="0 0 530 320" fill="none"><path d="M-65 39C84 43 119 49 132 127c17 101 108 162 231 119 87-30 116-30 219 13" stroke="currentColor" strokeWidth="34" strokeLinecap="round" /></svg>
    <svg className="m-graphic-tube m-graphic-tube-bottom" viewBox="0 0 650 270" fill="none"><path d="M-44 230C99 207 133 122 236 131c119 10 166 148 290 66 49-33 84-38 157-26" stroke="currentColor" strokeWidth="39" strokeLinecap="round" /></svg>
    <MimoHeart className="m-graphic-small-heart" />
  </div>;
}
