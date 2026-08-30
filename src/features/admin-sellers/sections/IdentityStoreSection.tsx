import { Building2, Mail, MapPin, Phone, Store, Tag, UserRound } from "lucide-react";
import { getSellerTypeLabel } from "@/components/admin/sellers/VendorApplicationReviewUI";
import type { SellerReviewApplication } from "../types/seller-review.types";
import { SectionCard } from "./TrustChecksSection";

export function IdentityStoreSection({ application }: { application: SellerReviewApplication }) {
  return (
    <SectionCard title="Identity and store" description="The account and store information supplied for review." icon={UserRound}>
      <dl className="overflow-hidden rounded-xl border border-[color:rgba(184,135,70,0.24)] bg-[var(--admin-surface-mist)]">
        <DetailRow icon={UserRound} label="Owner" value={application.ownerFullName || "Not provided"} />
        <DetailRow icon={Store} label="Store" value={application.storeName || "Not provided"} />
        <DetailRow icon={Building2} label="Registered name" value={application.legalBusinessName || "Not provided"} />
        <DetailRow icon={Tag} label="Seller type" value={getSellerTypeLabel(application.sellerType)} />
        <DetailRow icon={Mail} label="Business email" value={application.businessEmail || application.account.email || "Not provided"} />
        <DetailRow icon={Phone} label="Business phone" value={application.businessPhone || application.account.telephone || "Not provided"} />
        <DetailRow icon={MapPin} label="District" value={application.district || "Not provided"} />
        <DetailRow icon={MapPin} label="Address" value={application.businessAddress || "Not provided"} />
      </dl>

      <div className="mt-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--admin-ink-soft)]">Product categories</p>
        {application.productCategories.length ? (
          <div className="mt-2 flex flex-wrap gap-2">
            {application.productCategories.map((category) => (
              <span key={category} className="rounded-full border border-[color:rgba(7,91,54,0.22)] bg-[color:rgba(7,91,54,0.07)] px-3 py-1 text-xs font-semibold text-[var(--admin-canopy)]">
                {category}
              </span>
            ))}
          </div>
        ) : <p className="mt-2 text-sm text-[var(--admin-ink-soft)]">No categories provided.</p>}
      </div>
    </SectionCard>
  );
}

function DetailRow({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="grid grid-cols-[minmax(7rem,0.4fr)_minmax(0,0.6fr)] gap-3 border-b border-[color:rgba(184,135,70,0.18)] px-3 py-3 last:border-b-0 sm:px-4">
      <dt className="flex items-start gap-2 text-xs font-medium text-[var(--admin-ink-soft)]"><Icon className="mt-0.5 size-3.5 shrink-0" />{label}</dt>
      <dd className="min-w-0 break-words text-right text-sm font-semibold text-[var(--admin-ink)]">{value}</dd>
    </div>
  );
}
