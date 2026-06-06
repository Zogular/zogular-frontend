import {
  Building2,
  FileBadge2,
  Mail,
  MapPin,
  Phone,
  Store,
  Tag,
  UserRound,
} from "lucide-react";
import { getSellerTypeLabel } from "@/components/admin/sellers/VendorApplicationReviewUI";
import type { VendorApplication } from "@/types/seller";
import { SectionCard } from "./TrustChecksSection";

export function IdentityStoreSection({
  application,
}: {
  application: VendorApplication;
}) {
  return (
    <SectionCard
      title="Identity and store details"
      description="Owner identity, store profile, contact, and location."
      icon={UserRound}
    >
      <div className="overflow-hidden rounded-2xl border border-stone-200/60 bg-white/50">
        <dl className="divide-y divide-stone-200/50">
          <DetailRow icon={UserRound} label="Owner full name" value={application.ownerFullName || "Not provided"} />
          <DetailRow icon={Store} label="Store name" value={application.storeName || "Not provided"} />
          <DetailRow icon={Building2} label="Business name" value={application.legalBusinessName || application.businessName || "Not provided"} />
          <DetailRow icon={FileBadge2} label="Seller type" value={getSellerTypeLabel(application.sellerType)} />
          <DetailRow icon={Mail} label="Business email" value={application.businessEmail || application.user?.email || "Not provided"} />
          <DetailRow icon={Phone} label="Business phone" value={application.businessPhone || application.user?.telephone || "Not provided"} />
          <DetailRow icon={MapPin} label="District" value={application.district || "Not provided"} />
          <DetailRow icon={MapPin} label="Address" value={application.businessAddress || "Not provided"} />
        </dl>
      </div>

      {application.productCategories.length > 0 ? (
        <div className="mt-5">
          <p className="mb-2.5 text-[10px] font-black uppercase tracking-[0.18em] text-stone-400">
            Product categories
          </p>
          <div className="flex flex-wrap gap-1.5">
            {application.productCategories.map((category) => (
              <span
                key={category}
                className="inline-flex items-center gap-1.5 rounded-full border border-[#009E49]/20 bg-emerald-50/80 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-[#009E49]"
              >
                <Tag className="h-3 w-3" />
                {category}
              </span>
            ))}
          </div>
        </div>
      ) : (
        <div className="mt-5">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-stone-400">
            Product categories
          </p>
          <p className="mt-1 text-xs font-bold text-stone-400">No categories declared.</p>
        </div>
      )}
    </SectionCard>
  );
}

function DetailRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 px-4 py-3 transition-colors hover:bg-stone-50/50 sm:items-center">
      <div className="flex shrink-0 items-center gap-2.5 pt-0.5 sm:pt-0">
        <Icon className="h-4 w-4 shrink-0 text-stone-400" />
        <dt className="text-xs font-bold text-stone-600">{label}</dt>
      </div>
      <dd className="break-words text-right text-sm font-black text-stone-950">{value}</dd>
    </div>
  );
}
