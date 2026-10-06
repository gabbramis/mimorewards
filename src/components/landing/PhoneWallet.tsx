import type { ReactNode, RefObject } from "react";
import { Wallet } from "lucide-react";
import LoyaltyCard from "./LoyaltyCard";

type PhoneWalletProps = {
  children?: ReactNode;
  dockRef?: RefObject<HTMLDivElement | null>;
};

export default function PhoneWallet({ children, dockRef }: PhoneWalletProps) {
  return <div className="m-wallet-phone" aria-label="Tarjeta mimo guardada en Wallet">
    <div className="m-wallet-screen">
      <div className="m-wallet-status"><span>9:41</span><span className="m-wallet-island" /><span>•••</span></div>
      <div className="m-wallet-heading"><Wallet size={16} strokeWidth={1.8} /><span>Wallet</span></div>
      <div ref={dockRef} className="m-wallet-dock">{children ?? <LoyaltyCard stamps={4} maxStamps={10} />}</div>
      <div className="m-wallet-under-card"><span>mimo rewards</span><strong>Un mimo más cerca.</strong><span>4 de 10 sellos</span></div>
      <span className="m-wallet-home" />
    </div>
  </div>;
}
