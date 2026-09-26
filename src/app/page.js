import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-8 sm:p-20 bg-gray-50">
      <main className="flex flex-col gap-8 items-center text-center max-w-2xl">
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-gray-900">
          Mimo Rewards
        </h1>
        <p className="text-lg text-gray-600">
          SaaS de Fidelización de Clientes para Comercios Gastronómicos
        </p>
        <div className="flex gap-4 flex-wrap justify-center mt-4">
          <Link
            href="/caja"
            className="rounded-full border border-transparent flex items-center justify-center bg-blue-600 text-white gap-2 hover:bg-blue-700 text-sm sm:text-base h-10 sm:h-12 px-6 sm:px-8 transition-colors shadow-sm"
          >
            Terminal Web de Caja
          </Link>
          <Link
            href="/admin"
            className="rounded-full border border-gray-300 flex items-center justify-center bg-white text-gray-700 hover:bg-gray-100 text-sm sm:text-base h-10 sm:h-12 px-6 sm:px-8 transition-colors shadow-sm"
          >
            Panel de Admin (CRM)
          </Link>
        </div>
      </main>
    </div>
  );
}
