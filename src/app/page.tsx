import { Inter, Poppins } from "next/font/google";
import Landing from "@/components/landing/landing";
import "./landing.css";
import "./intro-story.css";
import "./landing-story.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-landing-body", display: "swap" });
const poppins = Poppins({ subsets: ["latin"], weight: ["500", "600", "700", "800"], variable: "--font-landing-heading", display: "swap" });

export const metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_MIMO_SITE_URL || "http://localhost:3000"),
  icons: { icon: "/images/mimo-icon.svg" },
  title: "mimo rewards | Kit de fidelización con NFC para gastronomía",
  description: "Recibí el kit mimo configurado para tu local: soportes NFC, tarjeta digital con tu logo y colores y un panel para seguir visitas, sellos y canjes. Plan $1.290 /mes, kit aparte.",
  openGraph: {
    title: "mimo rewards | Tu programa de sellos con NFC, listo para usar",
    description: "Kit mimo con soportes NFC, tarjeta digital con tu marca y panel para tu negocio. Agendá una demo para ver el recorrido completo.",
    locale: "es_UY", type: "website",
    images: [{ url: "/images/mimo-identity-kit.webp", width: 1672, height: 941, alt: "Kit NFC mimo rewards en el mostrador de una cafetería" }],
  },
};

export default function Home() {
  return <div className={`${inter.variable} ${poppins.variable}`}><Landing /></div>;
}
