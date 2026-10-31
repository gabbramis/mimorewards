import { Inter, Poppins } from "next/font/google";
import Landing from "@/components/landing/landing";
import { launchPlans } from "@/components/landing/plans";
import "./landing.css";
import "./intro-story.css";
import "./landing-story.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-landing-body", display: "swap" });
const poppins = Poppins({ subsets: ["latin"], weight: ["500", "600", "700", "800"], variable: "--font-landing-heading", display: "swap" });

export const metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_MIMO_SITE_URL || "https://mimorewards.com"),
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
  title: "mimo rewards | Sellos y recompensas para que vuelvan",
  description: `Tarjeta digital, sellos y recompensas para tu local. Inicial gratis, Pro ${launchPlans[1].price}/mes y Premium ${launchPlans[2].price}/mes. Precios en UYU, kits aparte.`,
  openGraph: {
    title: "mimo rewards | Dales un motivo para volver",
    description: `Sellos y recompensas con la marca de tu local. Inicial gratis con QR. Pro ${launchPlans[1].price}/mes y Premium ${launchPlans[2].price}/mes, kits aparte. Precios en UYU.`,
    locale: "es_UY", type: "website",
    images: [{ url: "/images/mimo-identity-kit.webp", width: 1672, height: 941, alt: "Kit NFC mimo rewards en el mostrador de una cafetería" }],
  },
};

export default function Home() {
  return <div className={`${inter.variable} ${poppins.variable}`}><Landing /></div>;
}
