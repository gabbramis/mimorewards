"use client";

import type { ReactNode, RefObject } from "react";
import { Check, Gift, Wallet } from "lucide-react";
import LoyaltyCard from "./LoyaltyCard";

export type JourneyStep = "wallet" | "progress" | "reward";

type JourneyPhoneProps = {
  step?: JourneyStep;
  stamps?: number;
  children?: ReactNode;
  docked?: boolean;
  screenRef?: RefObject<HTMLDivElement | null>;
  dockRef?: RefObject<HTMLDivElement | null>;
};

export default function JourneyPhone({ step = "wallet", stamps = 4, children, docked = true, screenRef, dockRef }: JourneyPhoneProps) {
  return <div className={`m-journey-phone ${step === "reward" ? "is-reward" : ""}`}>
    <div ref={screenRef} className="m-journey-screen" style={{ overflow: docked ? "hidden" : "visible" }}>
      <div className="m-journey-chrome" />
      <div className="m-journey-status"><span>9:41</span><span className="m-journey-island" /><span>•••</span></div>
      <div className="m-journey-app-heading"><span>CAFÉ DE LA ESQUINA</span><strong>Tu tarjeta<br />de beneficios.</strong></div>
      <div ref={dockRef} className="m-journey-card-dock">{!children && <LoyaltyCard stamps={stamps} maxStamps={10} rewardUnlocked={step === "reward"} />}</div>
      {children}
      <div className="m-journey-result">
        <div className={`m-journey-result-panel ${step === "wallet" ? "is-active" : ""}`} aria-hidden={step !== "wallet"}>
          <span className="m-journey-result-icon"><Check size={23} /></span><strong>Guardada en tu Wallet.</strong><p>Siempre a mano para tu próxima visita.</p><div className="m-journey-wallet-labels"><span><Wallet size={14} /> Apple Wallet</span><span>Google Wallet</span></div>
        </div>
        <div className={`m-journey-result-panel ${step === "progress" ? "is-active" : ""}`} aria-hidden={step !== "progress"}>
          <span className="m-journey-balance">{stamps}<small>/10 sellos</small></span><div className="m-journey-meter"><span style={{ width: `${stamps * 10}%` }} /></div><p>Cada visita te acerca a tu próximo mimo.</p>
        </div>
        <div className={`m-journey-result-panel ${step === "reward" ? "is-active" : ""}`} aria-hidden={step !== "reward"}>
          <span className="m-journey-result-icon"><Gift size={25} /></span><strong>Recompensa desbloqueada</strong><p>Tu próximo mimo:<br /><b>un café gratis</b></p>
        </div>
      </div>
      <span className="m-journey-home" />
    </div>
  </div>;
}
