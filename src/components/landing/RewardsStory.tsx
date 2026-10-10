"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Gift, Heart } from "lucide-react";
import { BrandHeart } from "./StoryArt";

const REWARDS = ["Un café gratis.", "Una cena para dos.", "Un postre.", "20% de descuento.", "Una cerveza artesanal.", "Una merienda.", "1kg de helado.", "Una porción de torta.", "Una pizza."];
const STAMP_COUNT = 5;

export default function RewardsStory() {
  const [progress, setProgress] = useState(0);
  const [rewardIndex, setRewardIndex] = useState(0);
  const reduced = useReducedMotion();
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const unlocked = !!reduced || progress >= STAMP_COUNT;
  useEffect(() => () => { if (timer.current) clearInterval(timer.current); }, []);
  useEffect(() => {
    if (!unlocked || reduced) return;
    const id = setInterval(() => setRewardIndex(index => (index + 1) % REWARDS.length), 1600);
    return () => clearInterval(id);
  }, [unlocked, reduced]);
  function start() {
    if (timer.current) clearInterval(timer.current);
    setRewardIndex(0);
    if (reduced) { setProgress(STAMP_COUNT); return; }
    setProgress(0);
    let step = 0;
    timer.current = setInterval(() => {
      step += 1;
      setProgress(step);
      if (step >= STAMP_COUNT && timer.current) clearInterval(timer.current);
    }, 180);
  }

  return <section id="beneficios" className="m-rewards-story m-story-section">
    <BrandHeart className="m-rewards-backdrop" />
    <div className="m-container"><div className="m-rewards-heading"><h2>Cada visita<br />tiene algo lindo.</h2><div><h3>Vos elegís la recompensa.</h3><p>Definís qué compra suma un sello, cuántos se necesitan para canjear y cuál es el premio.</p></div></div>
      <motion.div className={`m-reward-progress ${unlocked ? "is-complete" : ""}`} onViewportEnter={start} viewport={{once:true,amount:.35}}>
        <span className="m-reward-demo-label">EJEMPLO DE PROGRAMA · 5 SELLOS</span>
        <div className="m-large-stamps" aria-label={`${unlocked ? STAMP_COUNT : progress} de ${STAMP_COUNT} sellos`}>{Array.from({length:STAMP_COUNT},(_,i)=><motion.span key={i} className={i === STAMP_COUNT - 1 ? "m-final-stamp" : ""} animate={i === STAMP_COUNT - 1 && unlocked && !reduced ? {scale:[.88,1.13,1],rotate:[-8,5,0]} : {scale:1,rotate:0}} transition={{duration:.55,ease:"easeOut"}}>{i === STAMP_COUNT - 1 && unlocked ? <Gift aria-label="Premio alcanzado" strokeWidth={1.7} /> : <Heart fill={i < progress ? "currentColor" : "none"} strokeWidth={1.4} />}</motion.span>)}</div>
        <div className="m-reward-result" aria-live="polite"><div><span>{unlocked ? "RECOMPENSA DESBLOQUEADA" : "SUMANDO TUS SELLOS"}</span>{unlocked && !reduced ? <motion.strong key={rewardIndex} aria-live="off" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .3, ease: "easeOut" }}>{REWARDS[rewardIndex]}</motion.strong> : <strong>{unlocked ? REWARDS[rewardIndex] : "Tu próximo mimo."}</strong>}</div></div>
      </motion.div>
    </div>
  </section>;
}
