import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "mimo rewards | Fidelización para tu comercio",
  description: "Sumate al programa de beneficios de tu comercio favorito.",
};

export const viewport = {
  themeColor: "#f9efe5",
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="es-UY"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
