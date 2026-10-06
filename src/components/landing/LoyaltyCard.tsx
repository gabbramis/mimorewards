import Image from "next/image";
import { Gift, Heart } from "lucide-react";

type LoyaltyCardProps = {
  stamps?: number;
  maxStamps?: number;
  label?: string;
  reward?: string;
  rewardUnlocked?: boolean;
  className?: string;
};

export default function LoyaltyCard({
  stamps = 3,
  maxStamps = 8,
  label = "Café de la esquina",
  reward = "Un café gratis",
  rewardUnlocked = false,
  className = "",
}: LoyaltyCardProps) {
  const total = Math.max(1, Math.floor(maxStamps));
  const filled = Math.min(total, Math.max(0, Math.floor(stamps)));
  const unlocked = rewardUnlocked || filled === total;

  return (
    <div className={`m-story-card ${className}`} role="img" aria-label={`Tarjeta de fidelización mimo de ${label}. ${filled} de ${total} sellos. ${unlocked ? "Recompensa disponible" : `Próxima recompensa: ${reward}`}.`}>
      <div className="m-story-card-top">
        <Image src="/images/mimo-wordmark.png" width={1220} height={469} alt="" aria-hidden="true" />
        <span>TARJETA DE BENEFICIOS</span>
      </div>
      <div className="m-story-card-main">
        <span className="m-story-card-label">{label}</span>
        <strong>Volver tiene<br />su recompensa.</strong>
      </div>
      <div className="m-story-card-stamps" aria-hidden="true" style={{ gridTemplateColumns: `repeat(${total}, minmax(0, 1fr))` }}>
        {Array.from({ length: total }, (_, index) => (
          <span className={index < filled ? "is-filled" : ""} key={index}>
            {index < filled ? <Heart size={19} fill="currentColor" strokeWidth={1.6} /> : <span />}
          </span>
        ))}
      </div>
      <div className="m-story-card-bottom">
        <span><Gift size={17} strokeWidth={1.8} /> {unlocked ? "Tu mimo está listo" : reward}</span>
        <span>{filled}/{total} sellos</span>
      </div>
    </div>
  );
}
