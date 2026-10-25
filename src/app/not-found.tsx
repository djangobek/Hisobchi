import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#050816] px-6 text-center text-white">
      <p className="text-sm font-semibold uppercase tracking-[0.3em] text-emerald-400">
        Hisobchi
      </p>
      <h1 className="mt-4 text-7xl font-bold">404</h1>
      <p className="mt-4 max-w-md text-white/70">
        Siz izlayotgan sahifa topilmadi yoki manzil o‘zgargan.
      </p>
      <Link
        href="/"
        className="mt-8 rounded-xl bg-emerald-400 px-6 py-3 font-semibold text-[#050816] transition hover:bg-emerald-300"
      >
        Bosh sahifaga qaytish
      </Link>
    </main>
  );
}
