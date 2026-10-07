"use client";

import { useEffect, useRef, useState } from "react";
import Hero from "./Hero";
import { BrandHeart } from "./StoryArt";
import { CTA } from "./ui";
import LoyaltyCard from "./LoyaltyCard";
import PhoneWallet from "./PhoneWallet";
import MimoGraphicElements from "./MimoGraphicElements";

const clamp = (value: number) => Math.max(0, Math.min(1, value));
const range = (value: number, start: number, end: number) => clamp((value - start) / (end - start));
const ease = (value: number) => value * value * (3 - 2 * value);
const mix = (start: number, end: number, value: number) => start + (end - start) * value;

export default function IntroScrollStory() {
  const root = useRef<HTMLElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const heroSlot = useRef<HTMLDivElement>(null);
  const phone = useRef<HTMLDivElement>(null);
  const dock = useRef<HTMLDivElement>(null);
  const movingCard = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

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
    let geometry: { rootY: number; distance: number; fromX: number; fromY: number; fromScale: number; toX: number; toY: number; toScale: number; seedScale: number; coverScale: number } | null = null;

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
      const heroExit = ease(range(p, .015, .29));
      const phoneEnter = ease(range(p, .10, .28));
      const travel = ease(range(p, .04, .28));
      const middleCopy = ease(range(p, .25, .33)) * (1 - ease(range(p, .50, .58)));
      const finalCopy = ease(range(p, .60, .68)) * (1 - ease(range(p, .80, .87)));
      const sceneExit = ease(range(p, .82, .92));
      const wash = ease(range(p, .82, .98));
      const nextCopy = ease(range(p, .90, .96));
      const phoneShiftX = (1 - phoneEnter) * 26 + sceneExit * 34;
      const phoneShiftY = (1 - phoneEnter) * 85 + sceneExit * 72;
      const encast = 1 - .03 * Math.sin(Math.PI * range(p, .255, .295));
      const cardTransform = `translate3d(${Math.round(mix(geometry.fromX, geometry.toX + phoneShiftX, travel))}px, ${Math.round(mix(geometry.fromY, geometry.toY + phoneShiftY, travel))}px, 0) rotate(${mix(-7, 0, travel)}deg) scale(${mix(geometry.fromScale, geometry.toScale, travel) * encast})`;
      if (cardTransform !== lastCardTransform) { card.style.transform = cardTransform; lastCardTransform = cardTransform; }
      const cardOpacity = String(1 - sceneExit);
      if (cardOpacity !== lastCardOpacity) { card.style.opacity = cardOpacity; lastCardOpacity = cardOpacity; }
      setVar("--hero-opacity", String(1 - heroExit));
      setVar("--hero-y", `${-42 * heroExit}px`);
      setVar("--phone-opacity", String(phoneEnter * (1 - sceneExit)));
      setVar("--phone-y", `${phoneShiftY}px`);
      setVar("--phone-x", `${phoneShiftX}px`);
      setVar("--middle-opacity", String(middleCopy));
      setVar("--final-opacity", String(finalCopy));
      setVar("--graphic-shift", `${-22 * p}px`);
      setVar("--wash-scale", String(mix(geometry.seedScale, geometry.coverScale, wash)));
      setVar("--scene-exit", String(sceneExit));
      setVar("--heart-layer", sceneExit > .05 ? "11" : "1");
      setVar("--next-opacity", String(nextCopy));
      setVar("--next-y", `${24 * (1 - nextCopy)}px`);
      setVar("--cue-opacity", String(1 - ease(range(p, 0, .12))));
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
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
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", requestMeasure);
    const onMotionChange = () => { setReady(!media.matches); measure(); };
    media.addEventListener("change", onMotionChange);
    measure();
    const initial = requestAnimationFrame(() => { update(); setReady(!media.matches); });
    return () => {
      cancelAnimationFrame(frame);
      cancelAnimationFrame(initial);
      if (measureTimer) clearTimeout(measureTimer);
      observer.disconnect();
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", requestMeasure);
      media.removeEventListener("change", onMotionChange);
    };
  }, []);

  return <section ref={root} className={`m-intro-story ${ready ? "is-animated" : ""}`} aria-label="De la tarjeta mimo a Wallet">
    <div ref={stage} className="m-story-stage">
      <MimoGraphicElements />
      <div className="m-story-hero"><Hero /></div>
      <div ref={heroSlot} className="m-story-hero-slot"><div className="m-story-fallback"><LoyaltyCard stamps={4} maxStamps={10} /></div></div>
      <div className="m-story-message m-story-message-middle"><span>EN SU WALLET</span><h2>Siempre<br />con ellos.</h2><p>Una tarjeta digital que tus clientes llevan directo en su celular.</p></div>
      <div className="m-story-message m-story-message-final"><span>UN GESTO QUE PERMANECE</span><h2>Tu programa de fidelización, <em>siempre a mano.</em></h2><p>Guardan su tarjeta una vez. La próxima visita ya tiene un motivo.</p></div>
      <div ref={phone} className="m-story-phone"><PhoneWallet dockRef={dock}><div className="m-story-dock-placeholder"><LoyaltyCard stamps={4} maxStamps={10} /></div></PhoneWallet></div>
      <div ref={movingCard} className="m-story-moving-card"><LoyaltyCard stamps={4} maxStamps={10} /></div>
      <div className="m-story-red-wash" aria-hidden="true" />
      <div className="m-story-next-section"><BrandHeart className="m-next-heart" /><span>EL PRÓXIMO MIMO EMPIEZA ACÁ</span><h2>Hacé que<br />vuelvan.</h2><p>Conocé a tus clientes. Dales un motivo para elegirte otra vez.</p><div className="m-next-actions"><CTA>Quiero mimo en mi negocio</CTA></div><div className="m-next-proof"><span>Sin app para descargar</span><span>Apple Wallet y Google Wallet</span></div></div>
      <div className="m-story-exit-wave" aria-hidden="true"><svg viewBox="0 0 1440 90" preserveAspectRatio="none"><path className="m-wave-back" d="M0,48 C240,88 480,8 720,44 C960,80 1200,18 1440,54 L1440,90 L0,90 Z" /><path className="m-wave-front" d="M0,60 C260,94 520,24 760,54 C1000,84 1220,34 1440,60 L1440,90 L0,90 Z" /></svg></div>
    </div>
    <span id="como-funciona" className="m-story-legacy-anchor" />
    <span id="nfc" className="m-story-legacy-anchor" />
  </section>;
}




