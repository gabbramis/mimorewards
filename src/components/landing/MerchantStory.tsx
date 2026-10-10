import { Cake, Gift, Heart, Users } from "lucide-react";
import { DashboardMetric, CustomerGrowthChart } from "./demos";
import { Eyebrow, Reveal } from "./ui";
import { BrandHeart } from "./StoryArt";

export default function MerchantStory() {
  return <section id="para-comercios" className="m-merchant-story m-story-section"><div className="m-container">
    <div className="m-merchant-editorial"><div className="m-merchant-copy"><Eyebrow>DEL LADO DE TU COMERCIO</Eyebrow><h2>Visitas, sellos y canjes. <em>Todo en tu panel.</em></h2><p>Cada toque NFC deja un registro. Desde el panel podés seguir el programa sin cambiar tu sistema de caja.</p><ul className="m-merchant-actions"><li><strong>Visitas</strong><span>Ves quién se registró y cuándo volvió.</span></li><li><strong>Sellos</strong><span>Sabés a quién le falta poco para completar la tarjeta.</span></li><li><strong>Canjes</strong><span>Tu equipo confirma el premio y vos ves cuáles se usaron.</span></li></ul></div>
      <div className="m-product-composition" aria-label="Ejemplo del panel de mimo con datos ilustrativos"><BrandHeart className="m-product-heart" />
        <Reveal className="m-product-main"><DashboardMetric icon={Users} label="Clientes registrados" value="1.248" trend="+12,8%" /><CustomerGrowthChart /></Reveal>
        <Reveal className="m-product-customer"><span className="m-avatar">SL</span><div><strong>Sofía López</strong><small>Cliente frecuente</small><span><Heart size={13} fill="currentColor" /> 8/10 sellos</span></div></Reveal>
        <Reveal className="m-product-birthdays"><DashboardMetric icon={Cake} label="Cumpleaños" value="12" trend="este mes" /></Reveal>
        <Reveal className="m-product-rewards"><DashboardMetric icon={Gift} label="Recompensas canjeadas" value="320" trend="+8,2%" /></Reveal>
        <span className="m-product-caption">UN VISTAZO A TU PANEL · DATOS DE EJEMPLO</span>
      </div>
    </div>
    <p className="m-merchant-closing">Ves cuántos vuelven y cuántos canjean.<br /><strong>Así podés ajustar sellos y recompensas.</strong><Heart fill="currentColor" /></p>
  </div></section>;
}
