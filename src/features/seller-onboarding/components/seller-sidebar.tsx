import Link from "next/link";
import { useRouter } from "next/navigation";
import { ExternalLink, LogOut } from "lucide-react";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { sellerSidebarItems } from "../data/seller-onboarding.mock";
import type { SellerOnboardingViewModel } from "../types/seller-onboarding.types";
import { cn } from "@/lib/utils";
import { logout } from "@/services/auth";

export function SellerSidebar({
  viewModel,
  className,
}: {
  viewModel: SellerOnboardingViewModel;
  className?: string;
}) {
  const router = useRouter();
  return (
    <aside className={cn("bg-[#09281C] px-4 py-5 text-white", className)}>
      <div className="flex h-full min-h-0 flex-col">
        <Link href="/seller" className="flex items-center gap-3 rounded-2xl px-2 py-2">
          <BrandLogo mode="icon" variant="dark" imageClassName="h-10 w-10 rounded-2xl" />
          <div>
            <p className="text-lg font-black tracking-tight">Zogular</p>
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#70C99A]">Seller Hub</p>
          </div>
        </Link>

        <nav className="mt-8 min-h-0 flex-1 space-y-1 overflow-y-auto pr-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {sellerSidebarItems.map((item) => {
            const Icon = item.icon;
            const active = item.href === "/seller";
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex h-11 items-center gap-3 rounded-2xl px-3 text-sm font-bold transition-colors",
                  active ? "bg-[#E9F8EF]/12 text-white" : "text-[#A4C9B4] hover:bg-white/7 hover:text-white",
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="space-y-3 border-t border-white/10 pt-4">
          <Link href="/" className="flex h-10 items-center gap-2 rounded-2xl bg-white/7 px-3 text-sm font-black text-[#DDEDE3] hover:bg-white/10">
            <ExternalLink className="h-4 w-4" />
            View public store
          </Link>
          <div className="rounded-2xl bg-white/7 p-3">
            <p className="text-sm font-black">{viewModel.seller.storeName}</p>
            <p className="mt-1 text-xs font-semibold text-[#A4C9B4]">{viewModel.seller.ownerName}</p>
          </div>
          <button 
            onClick={async () => {
              await logout();
              router.push("/seller/login");
            }}
            className="flex h-10 w-full items-center gap-2 rounded-2xl px-3 text-sm font-black text-[#F4B8A9] hover:bg-white/7"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      </div>
    </aside>
  );
}
