import { ShieldAlert } from "lucide-react";

export default function AdminNotFound() {
  return (
    <section
      aria-labelledby="admin-page-unavailable-title"
      className="w-full max-w-xl rounded-3xl border border-zinc-200/80 bg-white/85 p-5 shadow-sm backdrop-blur-sm sm:p-6"
    >
      <div className="flex items-start gap-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-amber-200 bg-amber-50 text-amber-700">
          <ShieldAlert className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-amber-700">
            Admin access
          </p>
          <h1
            id="admin-page-unavailable-title"
            className="mt-1 text-xl font-black tracking-tight text-zinc-950"
          >
            Page unavailable
          </h1>
          <p className="mt-2 text-sm font-medium leading-6 text-zinc-600">
            This admin account cannot access this area, or the page is unavailable.
          </p>
          <p className="mt-2 text-sm font-semibold leading-6 text-zinc-800">
            Choose an available section from the admin menu.
          </p>
        </div>
      </div>
    </section>
  );
}
