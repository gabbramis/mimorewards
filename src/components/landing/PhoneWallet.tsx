import type { ReactNode, RefObject } from "react";
import { Wallet } from "lucide-react";
import LoyaltyCard from "./LoyaltyCard";

type PhoneWalletProps = {
  children?: ReactNode;
  dockRef?: RefObject<HTMLDivElement | null>;
  stamps?: number;
};

export default function PhoneWallet({ children, dockRef, stamps = 4 }: PhoneWalletProps) {
  const done = stamps >= 10;
  return <div className="m-wallet-phone" aria-label="Tarjeta mimo guardada en Wallet">
    <div className="m-wallet-screen">
      <div className="m-wallet-status"><span>9:41</span><span className="m-wallet-island" /><span>•••</span></div>
      <div className="m-wallet-heading"><Wallet size={16} strokeWidth={1.8} /><span>Wallet</span></div>
      <div ref={dockRef} className="m-wallet-dock">{children ?? <LoyaltyCard stamps={stamps} maxStamps={10} />}</div>
      <div className="m-wallet-under-card"><span>mimo rewards</span><strong>{done ? "¡Tu mimo está listo!" : "Un mimo más cerca."}</strong><span>{stamps} de 10 sellos</span></div>
      <span className="m-wallet-home" />
    </div>
  </div>;
}
