// Public launch offer. Product entitlements are configured separately.
export const launchPlans = [
  {
    id: "inicial", name: "Inicial", label: "TU PRIMER MIMO", price: "$0", kitPrice: null,
    description: "Probá la fidelización en tu local. Empezá simple y crecé a tu ritmo.",
    capacity: "Hasta 50 clientes activos",
    hardware: "QR en PDF listo para imprimir o mostrar en tu caja. Sin tótem físico.",
    features: ["Tarjeta en Apple Wallet y Google Wallet", "Diseño básico con tu logo y color", "Sellos estándar y recompensa a elección", "Panel de clientes, sellos y canjes"],
    cta: "Quiero empezar gratis", featured: false,
  },
  {
    id: "profesional", name: "Profesional", label: "EL FAVORITO DEL MOSTRADOR", price: "$1.290", kitPrice: "$1.290",
    description: "Tu marca en cada visita. Una experiencia propia, del mostrador al celular.",
    capacity: "Hasta 500 clientes activos",
    hardware: "Tótem de acrílico con QR y chip NFC NTAG protegido. Listo para tu mostrador.",
    features: ["Todo lo de Inicial", "Tarjeta Wallet con diseño 100% personalizado", "Colores y sellos propios, sin marca de mimo", "Métricas de visitas, frecuencia y canjes"],
    cta: "Quiero el Profesional", featured: true,
  },
  {
    id: "premium", name: "Premium", label: "MÁS MOTIVOS PARA VOLVER", price: "$2.490", kitPrice: "$1.490",
    description: "Convertí el historial de tus clientes en nuevas oportunidades para tu local.",
    capacity: "Clientes activos ilimitados",
    hardware: "Tótem personalizado con QR y NFC NTAG + llaveros NTAG para tu equipo.",
    features: ["Todo lo de Profesional", "Campañas y notificaciones push en Wallet", "Automatizaciones para recuperar clientes", "CRM con inactividad y clientes en riesgo"],
    cta: "Conocer Premium", featured: false,
  },
] as const;

export const plansSummary = `Inicial: ${launchPlans[0].price}/mes, hasta 50 clientes activos y QR en PDF sin costo. Profesional: ${launchPlans[1].price}/mes, hasta 500 clientes activos y kit de ${launchPlans[1].kitPrice} por única vez. Premium: ${launchPlans[2].price}/mes, clientes activos ilimitados y kit de ${launchPlans[2].kitPrice} por única vez. Precios en pesos uruguayos (UYU).`;
