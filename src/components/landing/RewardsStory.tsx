"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowUpRight, Heart } from "lucide-react";
import { BrandHeart } from "./StoryArt";

const REWARDS = ["Un café gratis.", "Una cena para dos.", "Un postre.", "20% de descuento.", "Una cerveza artesanal.", "Una merienda.", "1kg de helado.", "Una porción de torta.", "Una pizza."];

export default function RewardsStory() {
  const [progress, setProgress] = useState(0);
  const [rewardIndex, setRewardIndex] = useState(0);
  const reduced = useReducedMotion();
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const unlocked = !!reduced || progress >= 10;
  useEffect(() => () => { if (timer.current) clearInterval(timer.current); }, []);
  useEffect(() => {
    if (!unlocked || reduced) return;
    const id = setInterval(() => setRewardIndex(index => (index + 1) % REWARDS.length), 1000);
    return () => clearInterval(id);
  }, [unlocked, reduced]);
  function start() {
    if (timer.current) clearInterval(timer.current);
    setRewardIndex(0);
    if (reduced) { setProgress(10); return; }
    setProgress(0);
    let step = 0;
    timer.current = setInterval(() => {
      step += 1;
      setProgress(step);
      if (step >= 10 && timer.current) clearInterval(timer.current);
    }, 240);
  }

  return <section id="beneficios" className="m-rewards-story m-story-section">
    <BrandHeart className="m-rewards-backdrop" />
    <div className="m-container"><div className="m-rewards-heading"><h2>Cada visita<br />tiene algo lindo.</h2><div><h3>Vos elegís la recompensa.</h3><p>Cada compra puede sumar un sello. Vos decidís cuántos necesitan y qué reciben al completarlos.</p></div></div>
      <motion.div className={`m-reward-progress ${unlocked ? "is-complete" : ""}`} onViewportEnter={start} viewport={{once:true,amount:.6}}>
        <div className="m-large-stamps" aria-label={`${unlocked ? 10 : progress} de 10 sellos`}>{Array.from({length:10},(_,i)=><motion.span key={i} className={i === 9 ? "m-final-stamp" : ""} animate={i === 9 && unlocked && !reduced ? {scale:[.94,1.08,1]} : {scale:1}} transition={{duration:.45,ease:"easeOut"}}><Heart fill={i < progress || unlocked ? "currentColor" : "none"} strokeWidth={1.4} /></motion.span>)}</div>
        <div className="m-reward-result"><div><span>{unlocked ? "RECOMPENSA DESBLOQUEADA" : "SUMANDO TUS SELLOS"}</span>{unlocked && !reduced ? <motion.strong key={rewardIndex} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .3, ease: "easeOut" }}>{REWARDS[rewardIndex]}</motion.strong> : <strong>{unlocked ? REWARDS[rewardIndex] : "Tu próximo mimo."}</strong>}</div></div>
      </motion.div>
      <div className="m-reward-examples"><span>10 cafés <ArrowUpRight /> <strong>1 gratis</strong></span><span>5 visitas <ArrowUpRight /> <strong>20% OFF</strong></span><span>8 compras <ArrowUpRight /> <strong>una merienda</strong></span></div>
      <p className="m-reward-rule">Las reglas y las recompensas las elegís vos.</p>
    </div>
  </section>;
}
