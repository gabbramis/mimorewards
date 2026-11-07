import { notFound } from "next/navigation";
import CustomerExperience from "@/components/customer/CustomerExperience";

export default async function ResponsiveCardAudit({ searchParams }: {
  searchParams: Promise<{ stage?: string; target?: string; long?: string }>;
}) {
  if (process.env.NODE_ENV !== "development") notFound();
  const query = await searchParams;
  const target = Math.max(1, Math.min(Number(query.target) || 10, 15));
  const context = {
    nfcId: "", businessId: "", active: true,
    businessName: query.long ? "CafeteríaDelCentroConUnNombreExtraordinariamenteLargo" : "Café de prueba",
    businessLogo: "/images/mimo-wordmark.png", rewardTarget: target,
    rewardDescription: query.long ? "Un desayuno completo para compartir con café de especialidad y dos medialunas a elección" : "Un café de regalo",
    primaryColor: "#FF1F2D", textColor: "#FFFFFF", accentColor: "#FFFFFF",
    stampCompletedUrl: "", stampPendingUrl: "",
  };
  const customer = {
    id: "", firstName: query.long ? "MaríaDelCarmenConUnNombreMuyLargo" : "María",
    lastName: query.long ? "ApellidoTambiénMuyExtenso" : "Pérez", phone: "", birthdate: "",
    uniqueCode: "CLI-DEMO123", currentStamps: query.stage === "reward" ? target : Math.min(3, target - 1),
    targetStamps: target, businessName: context.businessName, businessLogo: context.businessLogo,
    rewardDescription: context.rewardDescription,
  };
  return <CustomerExperience initialContext={context}
    initialCustomer={query.stage === "register" ? null : customer}
    stampStatus={query.stage === "stamp" ? "success" : query.stage === "cooldown" ? "cooldown" : query.stage === "error" ? "error" : query.stage === "reward" ? "reward_pending" : null} />;
}
