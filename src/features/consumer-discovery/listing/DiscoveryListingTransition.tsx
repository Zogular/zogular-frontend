"use client";

import { createContext, type ReactNode, useContext, useTransition } from "react";
import { useRouter } from "next/navigation";
import { DiscoveryProductSkeleton } from "@/features/consumer-discovery/components/DiscoveryProductSkeleton";

type ListingTransitionContextValue = {
  isPending: boolean;
  navigate: (href: string) => boolean;
};

const ListingTransitionContext = createContext<ListingTransitionContextValue | null>(null);

export function DiscoveryListingTransitionProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function navigate(href: string) {
    const currentHref = `${window.location.pathname}${window.location.search}`;
    if (href === currentHref || isPending) return false;
    startTransition(() => router.push(href));
    return true;
  }

  return (
    <ListingTransitionContext.Provider value={{ isPending, navigate }}>
      {children}
    </ListingTransitionContext.Provider>
  );
}

export function useDiscoveryListingTransition() {
  const context = useContext(ListingTransitionContext);
  if (!context) throw new Error("Listing transitions must be used inside DiscoveryListingTransitionProvider.");
  return context;
}

export function DiscoveryListingResultBoundary({ children }: { children: ReactNode }) {
  const { isPending } = useDiscoveryListingTransition();
  if (!isPending) return children;

  return (
    <section aria-label="Updating product results" data-testid="listing-pending-state" className="space-y-3">
      <DiscoveryProductSkeleton
        count={8}
        label="Updating products"
        className="[&_ul]:xl:grid-cols-[repeat(4,minmax(0,220px))] [&_ul]:xl:justify-between"
      />
    </section>
  );
}
