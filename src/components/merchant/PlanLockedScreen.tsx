import { Lock } from "lucide-react";

export default function PlanLockedScreen({ title, message }: { title: string; message: string }) {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center rounded-2xl border border-amber-200 bg-white px-8 py-16 text-center shadow-xs">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-50 text-amber-600">
        <Lock size={26} />
      </span>
      <h2 className="mt-5 text-xl font-bold tracking-tight text-[#1F1F1F]">{title}</h2>
      <p className="mt-2 text-sm text-[#737373]">{message}</p>
      <p className="mt-6 text-xs text-[#737373]">Contactá al administrador para cambiar de plan.</p>
    </div>
  );
}
