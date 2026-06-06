import type { VendorApplication } from "@/types/seller";

export function TrustChecksSection({
  application,
}: {
  application: VendorApplication;
}) {
  const emailVerified = application.user?.emailVerified ?? false;
  const phoneVerified = Boolean(application.user?.phoneVerifiedAt);
  const accountActive = application.user?.isActive ?? false;

  return (
    <SectionCard title="Trust checks" description="Verification and account trust status.">
      <div className="grid gap-2 sm:grid-cols-2">
        <TrustRow verified={emailVerified} label={emailVerified ? "Email verified" : "Email not verified"} />
        <TrustRow verified={phoneVerified} label={phoneVerified ? "Phone confirmed" : "Phone not confirmed"} />
        <TrustRow verified={accountActive} label={accountActive ? "Account active" : "Account inactive"} />
        <TrustRow
          verified={application.status === "APPROVED" || application.status === "PROVISIONAL"}
          label={
            application.status === "APPROVED"
              ? "Seller approved"
              : application.status === "PROVISIONAL"
                ? "Provisional access"
                : "Seller not yet approved"
          }
        />
      </div>
    </SectionCard>
  );
}

function TrustRow({ verified, label }: { verified: boolean; label: string }) {
  return (
    <div
      className={`flex items-center gap-2.5 rounded-xl border px-3 py-2 ${
        verified
          ? "border-emerald-200/70 bg-emerald-50/40 text-[#009E49]"
          : "border-stone-200/60 bg-stone-50/40 text-stone-500"
      }`}
    >
      <div
        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold ${
          verified ? "bg-[#009E49] text-white" : "bg-stone-200 text-stone-500"
        }`}
      >
        {verified ? "✓" : "–"}
      </div>
      <span className="text-[11px] font-bold">{label}</span>
    </div>
  );
}

export function SectionCard({
  title,
  description,
  children,
  icon: Icon,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <section className="rounded-2xl border border-stone-200/50 bg-white/90 p-4 shadow-[0_2px_12px_rgba(15,23,42,0.03)] sm:p-5">
      <div className="flex items-center gap-3">
        {Icon ? (
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-stone-900 text-[#009E49] shadow-sm shadow-stone-950/5">
            <Icon className="h-4 w-4" />
          </div>
        ) : null}
        <div>
          <h2 className="text-sm font-black tracking-tight text-stone-900">{title}</h2>
          {description ? (
            <p className="mt-0.5 text-[11px] font-medium text-stone-500">{description}</p>
          ) : null}
        </div>
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}
