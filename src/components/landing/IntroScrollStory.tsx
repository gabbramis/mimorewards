"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Heart } from "lucide-react";
import Hero from "./Hero";
import { NfcStand } from "./BrandStory";
import { BrandHeart } from "./StoryArt";
import { CTA } from "./ui";
import LoyaltyCard from "./LoyaltyCard";
import PhoneWallet from "./PhoneWallet";
import MimoGraphicElements from "./MimoGraphicElements";
import { demoHref } from "./demo-link";

const clamp = (value: number) => Math.max(0, Math.min(1, value));
const range = (value: number, start: number, end: number) => clamp((value - start) / (end - start));
const ease = (value: number) => value * value * (3 - 2 * value);
const mix = (start: number, end: number, value: number) => start + (end - start) * value;
// Rest at complete visual beats; the moving parts still follow scroll progress.
const SCENE_STOPS = [0, .245, .59, .735, .94];

// One-shot heart explosion, fanned upward out of the phone.
const BURST = Array.from({ length: 22 }, (_, i) => {
  const angle = ((-175 + i * (170 / 21)) * Math.PI) / 180;
  const dist = 180 + (i % 5) * 40;
  return {
    x: Math.round(Math.cos(angle) * dist),
    y: Math.round(Math.sin(angle) * dist - 70),
    r: ((i * 53) % 160) - 80,
    d: (i % 6) * 0.07,
    s: 24 + (i % 4) * 7,
    c: ["#e51c2b", "#ff5b68", "#ff8d95", "#c21420", "#ff3b47"][i % 5],
  };
});

export default function IntroScrollStory() {
  const root = useRef<HTMLElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const heroSlot = useRef<HTMLDivElement>(null);
  const phone = useRef<HTMLDivElement>(null);
  const dock = useRef<HTMLDivElement>(null);
  const movingCard = useRef<HTMLDivElement>(null);
  const stand = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [nfc, setNfc] = useState({ stamps: 4, tap: false, done: false, party: false });
  const nfcPrev = useRef({ stamps: 4, tap: false, done: false, party: false });

  useEffect(() => {
    const story = root.current;
    const scene = stage.current;
    const start = heroSlot.current;
    const device = phone.current;
    const destination = dock.current;
    const card = movingCard.current;
    if (!story || !scene || !start || !device || !destination || !card) return;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    let scrollFrame = 0;
    let wheelCooldownUntil = 0;
    let settleTimer: ReturnType<typeof setTimeout> | null = null;
    let anchorTimer: ReturnType<typeof setTimeout> | null = null;
    let anchorNavigation = false;
    let touchStart: { x: number; y: number } | null = null;
    let geometry: { rootY: number; distance: number; fromX: number; fromY: number; fromScale: number; toX: number; toY: number; toScale: number; seedScale: number; coverScale: number; nfcDX: number; nfcDY: number } | null = null;

    const measure = () => {
      const rootBox = story.getBoundingClientRect();
      const stageBox = scene.getBoundingClientRect();
      const startBox = start.getBoundingClientRect();
      // offset positions exclude the phone's animated transform, so the dock is stable.
      const frame = device.querySelector<HTMLElement>(".m-wallet-phone");
      const inset = frame ? frame.clientLeft + parseFloat(getComputedStyle(frame).paddingLeft) : 0;
      const toX = device.offsetLeft + inset + destination.offsetLeft;
      const toY = device.offsetTop + inset + destination.offsetTop;
      const washRadius = Math.max(stageBox.width, stageBox.height);
      // NFC approach vector: from the phone's resting center toward the stand's
      // center, measured in layout px (offset* ignores transforms) so it stays
      // correct on every breakpoint. The phone travels 55% of the way.
      const standEl = stand.current;
      const phoneCX = device.offsetLeft + device.offsetWidth / 2;
      const phoneCY = device.offsetTop + device.offsetHeight / 2;
      const standCX = standEl ? standEl.offsetLeft + standEl.offsetWidth / 2 : phoneCX;
      const standCY = standEl ? standEl.offsetTop + standEl.offsetHeight / 2 : phoneCY;
      geometry = {
        rootY: rootBox.top + window.scrollY,
        distance: Math.max(1, story.offsetHeight - scene.offsetHeight),
        fromX: startBox.left - stageBox.left,
        fromY: startBox.top - stageBox.top,
        fromScale: startBox.width / 400,
        toX, toY, toScale: destination.offsetWidth / 400,
        // The red form starts on the lower tube; it reaches the farthest corner
        // exactly at the end of the wipe, regardless of the viewport's proportions.
        seedScale: 22 / washRadius,
        coverScale: Math.hypot(stageBox.width * .82, stageBox.height * .92) / washRadius + .002,
        nfcDX: (standCX - phoneCX) * .55,
        nfcDY: (standCY - phoneCY) * .55,
      };
      // Rasterize at its final size to keep the expanding curved edge crisp.
      scene.style.setProperty("--wash-radius", `${washRadius}px`);
      schedule();
    };
    // Skip style writes whose value didn't change to avoid recalcs every frame.
    const varCache = new Map<string, string>();
    const setVar = (name: string, value: string) => {
      if (varCache.get(name) === value || !scene) return;
      varCache.set(name, value);
      scene.style.setProperty(name, value);
    };
    let lastCardTransform = "";
    let lastCardOpacity = "";
    const update = () => {
      frame = 0;
      if (!geometry || media.matches) return;
      const p = clamp((window.scrollY - geometry.rootY) / geometry.distance);
      const heroExit = ease(range(p, .010, .188));
      const phoneEnter = ease(range(p, .065, .182));
      const travel = ease(range(p, .026, .182));
      const middleCopy = ease(range(p, .163, .208)) * (1 - ease(range(p, .293, .338)));
      const finalCopy = ease(range(p, .66, .705)) * (1 - ease(range(p, .79, .835)));
      const sceneExit = ease(range(p, .805, .87));
      const wash = ease(range(p, .805, .895));
      const nextCopy = ease(range(p, .85, .895));
      // NFC scene: copy + stand enter, phone approaches, tap, phone returns,
      // then a still beat with the copy fixed before handing off.
      const nfcCopy = ease(range(p, .342, .387)) * (1 - ease(range(p, .615, .66)));
      const standIn = ease(range(p, .35, .415));
      const standOut = ease(range(p, .545, .59));
      const approach = ease(range(p, .43, .505)) * (1 - ease(range(p, .535, .58)));
      const tapZoom = 1 + .045 * Math.sin(Math.PI * range(p, .505, .575));
      const phoneShiftX = (1 - phoneEnter) * 26 + sceneExit * 34;
      const phoneShiftY = (1 - phoneEnter) * 85 + sceneExit * 72;
      const compactFinal = window.innerWidth <= 380 && window.innerHeight <= 720 ? finalCopy : 0;
      const encast = 1 - .03 * Math.sin(Math.PI * range(p, .166, .192));
      const nfcShiftX = geometry.nfcDX * approach;
      const nfcShiftY = geometry.nfcDY * approach;
      const cardTransform = `translate3d(${Math.round(mix(geometry.fromX, geometry.toX + phoneShiftX + nfcShiftX, travel))}px, ${Math.round(mix(geometry.fromY, geometry.toY + phoneShiftY + nfcShiftY, travel))}px, 0) rotate(${mix(-7, 0, travel)}deg) scale(${mix(geometry.fromScale, geometry.toScale, travel) * encast * tapZoom})`;
      if (cardTransform !== lastCardTransform) { card.style.transform = cardTransform; lastCardTransform = cardTransform; }
      const cardOpacity = String((1 - sceneExit) * (1 - compactFinal));
      if (cardOpacity !== lastCardOpacity) { card.style.opacity = cardOpacity; lastCardOpacity = cardOpacity; }
      setVar("--hero-opacity", String(1 - heroExit));
      setVar("--hero-y", `${-42 * heroExit}px`);
      setVar("--phone-opacity", String(phoneEnter * (1 - sceneExit) * (1 - compactFinal)));
      setVar("--phone-y", `${phoneShiftY}px`);
      setVar("--phone-x", `${phoneShiftX}px`);
      setVar("--middle-opacity", String(middleCopy));
      setVar("--final-opacity", String(finalCopy));
      setVar("--nfc-opacity", String(nfcCopy));
      setVar("--stand-opacity", String(standIn * (1 - standOut)));
      setVar("--stand-y", `${(1 - standIn) * 46 + standOut * 36}px`);
      setVar("--nfc-x", `${geometry.nfcDX * approach}px`);
      setVar("--nfc-y", `${geometry.nfcDY * approach}px`);
      setVar("--tap-zoom", String(tapZoom));
      setVar("--graphic-shift", `${-22 * p}px`);
      setVar("--wash-scale", String(mix(geometry.seedScale, geometry.coverScale, wash)));
      setVar("--scene-exit", String(sceneExit));
      setVar("--heart-layer", sceneExit > .05 ? "11" : "1");
      setVar("--next-opacity", String(nextCopy));
      setVar("--next-y", `${24 * (1 - nextCopy)}px`);
      setVar("--cue-opacity", String(1 - ease(range(p, 0, .12))));
      // NFC stamps: 4 while docked, quick fill to 9 as the scene starts,
      // 10/10 with pop right at the tap. Derived from progress so scrubbing
      // back and forth stays consistent; state only flips on change.
      const bucket = p < .43 ? 4 : p < .5 ? 4 + Math.min(5, Math.floor((p - .43) / .014)) : p < .515 ? 9 : 10;
      const next = { stamps: bucket, tap: p >= .5 && p < .575, done: p >= .515, party: p >= .66 && p < .90 };
      const prev = nfcPrev.current;
      if (prev.stamps !== next.stamps || prev.tap !== next.tap || prev.done !== next.done || prev.party !== next.party) {
        nfcPrev.current = next;
        setNfc(next);
      }
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
    const progress = () => geometry ? clamp((window.scrollY - geometry.rootY) / geometry.distance) : 0;
    const scrollToY = (to: number, duration?: number) => {
      if (!geometry) return;
      cancelAnimationFrame(scrollFrame);
      scrollFrame = 0;
      if (settleTimer) clearTimeout(settleTimer);
      const from = window.scrollY;
      if (Math.abs(to - from) < 2) return;
      const started = performance.now();
      const time = duration ?? Math.min(850, Math.max(540, Math.abs(to - from) * .55));
      const animate = (now: number) => {
        const t = ease(clamp((now - started) / time));
        window.scrollTo({ top: mix(from, to, t), behavior: "instant" });
        if (t < 1) scrollFrame = requestAnimationFrame(animate);
        else {
          scrollFrame = 0;
          wheelCooldownUntil = now + 100;
        }
      };
      scrollFrame = requestAnimationFrame(animate);
    };
    const scrollToStop = (stop: number) => {
      if (geometry) scrollToY(geometry.rootY + geometry.distance * stop, stop === .59 ? 1800 : undefined);
    };
    const step = (direction: number) => {
      const p = progress();
      const next = direction > 0
        ? SCENE_STOPS.find(stop => stop > p + .012)
        : [...SCENE_STOPS].reverse().find(stop => stop < p - .012);
      if (next === undefined) return false;
      scrollToStop(next);
      return true;
    };
    const inStory = () => !!geometry && window.scrollY >= geometry.rootY - 2 && window.scrollY <= geometry.rootY + geometry.distance + 2;
    const onWheel = (event: WheelEvent) => {
      if (media.matches || anchorNavigation || event.ctrlKey || !event.deltaY) return;
      if (scrollFrame) {
        event.preventDefault();
        return;
      }
      if (!inStory()) return;
      const direction = Math.sign(event.deltaY);
      if (direction > 0 && progress() >= SCENE_STOPS[SCENE_STOPS.length - 1] - .012) return;
      if ((direction < 0 && progress() <= 0) || (direction > 0 && progress() >= 1)) return;
      event.preventDefault();
      if (performance.now() < wheelCooldownUntil) return;
      step(direction);
    };
    const onTouchStart = (event: TouchEvent) => {
      if (media.matches || !inStory() || event.touches.length !== 1) return;
      touchStart = { x: event.touches[0].clientX, y: event.touches[0].clientY };
    };
    const onTouchMove = (event: TouchEvent) => {
      if (!touchStart || event.touches.length !== 1) return;
      const dx = event.touches[0].clientX - touchStart.x;
      const dy = event.touches[0].clientY - touchStart.y;
      if (Math.abs(dy) <= Math.abs(dx) || Math.abs(dy) < 8) return;
      if (dy < 0 && progress() >= SCENE_STOPS[SCENE_STOPS.length - 1] - .012) return;
      if ((dy > 0 && progress() <= 0) || (dy < 0 && progress() >= 1)) return;
      event.preventDefault();
    };
    const onTouchEnd = (event: TouchEvent) => {
      if (!touchStart) return;
      const touch = event.changedTouches[0];
      const dx = touch.clientX - touchStart.x;
      const dy = touch.clientY - touchStart.y;
      touchStart = null;
      if (Math.abs(dy) > 24 && Math.abs(dy) > Math.abs(dx) && !scrollFrame) step(-Math.sign(dy));
    };
    const onTouchCancel = () => { touchStart = null; };
    const onScroll = () => {
      schedule();
      if (anchorNavigation) return;
      if (!inStory()) {
        if (settleTimer) clearTimeout(settleTimer);
        settleTimer = null;
        return;
      }
      if (progress() >= SCENE_STOPS[SCENE_STOPS.length - 1] - .012) {
        if (settleTimer) clearTimeout(settleTimer);
        settleTimer = null;
        return;
      }
      if (media.matches || scrollFrame || touchStart) return;
      if (settleTimer) clearTimeout(settleTimer);
      settleTimer = setTimeout(() => {
        const p = progress();
        const closest = SCENE_STOPS.reduce((a, b) => Math.abs(a - p) < Math.abs(b - p) ? a : b);
        scrollToStop(closest);
      }, 220);
    };
    const onAnchorClick = (event: MouseEvent) => {
      if (!(event.target instanceof Element) || !event.target.closest('a[href^="#"]')) return;
      anchorNavigation = true;
      cancelAnimationFrame(scrollFrame);
      scrollFrame = 0;
      if (settleTimer) clearTimeout(settleTimer);
      if (anchorTimer) clearTimeout(anchorTimer);
      anchorTimer = setTimeout(() => { anchorNavigation = false; }, 2500);
    };
    // Debounce geometry reads: on mobile the URL bar fires resize/observer
    // continuously mid-scroll and each measure forces layout.
    let measureTimer: ReturnType<typeof setTimeout> | null = null;
    const requestMeasure = () => {
      if (measureTimer) clearTimeout(measureTimer);
      measureTimer = setTimeout(measure, 180);
    };
    const observer = new ResizeObserver(requestMeasure);
    observer.observe(scene);
    observer.observe(start);
    observer.observe(device);
    if (stand.current) observer.observe(stand.current);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    window.addEventListener("touchcancel", onTouchCancel, { passive: true });
    document.addEventListener("click", onAnchorClick, true);
    window.addEventListener("resize", requestMeasure);
    const onMotionChange = () => { setReady(!media.matches); measure(); };
    media.addEventListener("change", onMotionChange);
    measure();
    const initial = requestAnimationFrame(() => { update(); setReady(!media.matches); });
    return () => {
      cancelAnimationFrame(frame);
      cancelAnimationFrame(scrollFrame);
      cancelAnimationFrame(initial);
      if (measureTimer) clearTimeout(measureTimer);
      if (settleTimer) clearTimeout(settleTimer);
      if (anchorTimer) clearTimeout(anchorTimer);
      observer.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("touchcancel", onTouchCancel);
      document.removeEventListener("click", onAnchorClick, true);
      window.removeEventListener("resize", requestMeasure);
      media.removeEventListener("change", onMotionChange);
    };
  }, []);

  return <section ref={root} className={`m-intro-story ${ready ? "is-animated" : ""}`} aria-label="Del soporte NFC a la tarjeta digital mimo">
    <div ref={stage} className="m-story-stage">
      <MimoGraphicElements />
      <div className="m-story-hero"><Hero /></div>
      <div ref={heroSlot} className="m-story-hero-slot"><div className="m-story-fallback"><LoyaltyCard stamps={4} maxStamps={10} /></div></div>
      <div className="m-story-message m-story-message-middle"><span>TARJETA DIGITAL</span><h2>Sus beneficios,<br />en el celular.</h2><p>Consultan sus sellos, beneficios y progreso desde el celular. Guardan la tarjeta una vez y la tienen lista para la próxima visita.</p></div>
      <div className="m-story-message m-story-message-final"><span>SIEMPRE DISPONIBLE</span><h2>Tu programa de fidelización, <em>siempre a mano.</em></h2><p>Sus sellos, recompensas y progreso quedan guardados en un mismo lugar, sin tener que registrarse cada vez que vuelven.</p></div>
      <div className="m-story-message m-story-message-nfc"><span>TOQUE NFC</span><h2>Fácil para ellos.<br /><em>Fácil para vos.</em></h2><p>Cada compra puede sumar un sello, sin apps para descargar ni pasos complicados.</p></div>
      <div ref={phone} className="m-story-phone"><PhoneWallet dockRef={dock} stamps={nfc.stamps}><div className="m-story-dock-placeholder"><LoyaltyCard stamps={4} maxStamps={10} /></div></PhoneWallet><div className={`m-heart-burst ${nfc.party ? "go" : ""}`} aria-hidden="true">{BURST.map((h, i) => <span key={i} style={{ "--tx": `${h.x}px`, "--ty": `${h.y}px`, "--rr": `${h.r}deg`, "--pd": `${h.d}s`, "--ps": `${h.s}px`, color: h.c } as CSSProperties}><Heart size={h.s} fill="currentColor" strokeWidth={1.5} /></span>)}</div></div>
      <div ref={movingCard} className={`m-story-moving-card ${nfc.done ? "is-complete" : ""}`}><LoyaltyCard stamps={nfc.stamps} maxStamps={10} /></div>
      <div ref={stand} className={`m-story-stand ${nfc.tap ? "is-tapping" : ""}`}><NfcStand /><div className="m-nfc-rings" aria-hidden="true"><span /><span /><span /></div></div>
      <div className="m-story-red-wash" aria-hidden="true" />
      <div className="m-story-next-section"><BrandHeart className="m-next-heart" /><span>FIDELIZACIÓN PARA TU COMERCIO</span><h2>Hacé que<br />vuelvan.</h2><p>Un kit con soporte NFC, tarjeta digital y un panel para seguir clientes, visitas, sellos y recompensas.</p><div className="m-next-actions"><CTA href={demoHref}>Agendar una demo</CTA></div><div className="m-next-proof"><span>Sin app para descargar</span><span>Tarjeta digital para tus clientes</span></div></div>
      <div className="m-story-exit-wave" aria-hidden="true"><svg viewBox="0 0 1440 90" preserveAspectRatio="none"><path className="m-wave-back" d="M0,48 C240,88 480,8 720,44 C960,80 1200,18 1440,54 L1440,90 L0,90 Z" /><path className="m-wave-front" d="M0,60 C260,94 520,24 760,54 C1000,84 1220,34 1440,60 L1440,90 L0,90 Z" /></svg></div>
    </div>
    <span id="como-funciona" className="m-story-legacy-anchor" />
    <span id="nfc" className="m-story-legacy-anchor" />
  </section>;
}




