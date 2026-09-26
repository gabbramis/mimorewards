import { Inter, Poppins } from "next/font/google";
import Landing from "@/components/landing/landing";
import "./landing.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-landing-body", display: "swap" });
const poppins = Poppins({ subsets: ["latin"], weight: ["500", "600", "700", "800"], variable: "--font-landing-heading", display: "swap" });

export const metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_MIMO_SITE_URL || "http://localhost:3000"),
  icons: { icon: "/images/mimo-icon.svg" },
  title: "mimo rewards | Fidelización para tu comercio",
  description: "Hacé que tus clientes vuelvan. Soportes NFC, tarjetas digitales y un panel simple para conocer a tus clientes y premiar cada visita. Sumate al acceso anticipado.",
  openGraph: {
    title: "mimo rewards | Hacé que tus clientes vuelvan",
    description: "Del mostrador al celular. Conocé el programa de fidelización pensado para tu comercio.",
    locale: "es_UY", type: "website",
    images: [{ url: "/images/mimo-identity-kit.webp", width: 1672, height: 941, alt: "Kit NFC mimo rewards en el mostrador de una cafetería" }],
  },
};

export default function Home() {
  return <div className={`${inter.variable} ${poppins.variable}`}><Landing /></div>;
}
