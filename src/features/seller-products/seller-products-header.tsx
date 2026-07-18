import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SellerProductsHeaderProps {
  addProductHref: string;
  showDraftOnlyNotice: boolean;
}

export function SellerProductsHeader({ addProductHref, showDraftOnlyNotice }: SellerProductsHeaderProps) {
  return (
    <>
      <header className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div className="min-w-0">
          <h1 className="text-2xl font-black tracking-tight text-zinc-950 md:text-3xl">Products</h1>
          <p className="mt-1 text-sm font-medium text-zinc-500">Manage drafts, review states, stock, and buyer visibility.</p>
        </div>
        <Button asChild className="h-10 w-full shrink-0 rounded-lg bg-[#009E49] px-4 text-sm font-bold text-white shadow-sm hover:bg-[#00853d] sm:w-auto md:hidden">
          <Link href={addProductHref}>
            <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" /> Add Product
          </Link>
        </Button>
      </header>
      {showDraftOnlyNotice ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
          Your seller account can create drafts. Product review submission becomes available after full seller approval.
        </div>
      ) : null}
    </>
  );
}
