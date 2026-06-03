import Link from "next/link";
import { Bell, Lock, PanelLeftClose, PanelLeftOpen, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SellerOnboardingViewModel } from "../types/seller-onboarding.types";

export function SellerTopBar({
  viewModel,
  sidebarOpen,
  onToggleSidebar,
}: {
  viewModel: SellerOnboardingViewModel;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
}) {
  return (
    <header className="sticky top-0 z-30 hidden h-18 items-center justify-between border-b border-[#E9E1D6] bg-[#F7F4EE]/88 px-8 backdrop-blur lg:flex">
      <div className="flex items-center gap-4">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onToggleSidebar}
          aria-label={sidebarOpen ? "Close menu" : "Open menu"}
          title={sidebarOpen ? "Close menu" : "Open menu"}
          className="h-10 w-10 rounded-2xl border-0 bg-transparent text-[#1F1A14] shadow-none hover:bg-white/60"
        >
          {sidebarOpen ? <PanelLeftClose className="h-4.5 w-4.5" /> : <PanelLeftOpen className="h-4.5 w-4.5" />}
        </Button>
        <div>
          <h1 className="text-xl font-black tracking-tight text-[#1F1A14]">Seller Hub</h1>
          <p className="mt-0.5 text-xs font-bold text-[#6F6A62]">{viewModel.statusMessage}</p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Button
          disabled
          className="h-10 rounded-2xl bg-[#09281C]/20 px-4 font-black text-[#09281C] opacity-100 hover:bg-[#09281C]/20"
        >
          <Lock className="mr-2 h-4 w-4" />
          <Plus className="mr-1 h-4 w-4" />
          Add Product
        </Button>
        <Link href="/seller/notifications" className="relative flex h-10 w-10 items-center justify-center rounded-2xl border border-[#E9E1D6] bg-[#FFFCF8] text-[#1F1A14]">
          <Bell className="h-4 w-4" />
          <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-[#0EA85B]" />
        </Link>
        <Link href="/seller/settings" className="flex items-center gap-3 rounded-2xl border border-[#E9E1D6] bg-[#FFFCF8] p-1.5 pr-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#09281C] text-xs font-black text-white">ZS</div>
          <div>
            <p className="text-sm font-black leading-none text-[#1F1A14]">{viewModel.seller.storeName}</p>
            <p className="mt-1 text-[10px] font-black uppercase tracking-[0.14em] text-[#8F6B34]">Admin</p>
          </div>
        </Link>
      </div>
    </header>
  );
}
