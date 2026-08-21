import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { Address } from "@/types/address";
import type { CheckoutStage } from "@/features/checkout/types/checkout.types";

interface AddressSectionProps {
  stage: CheckoutStage;
  addresses: Address[];
  selectedAddressId: string | null;
  isLoading: boolean;
  hasLoadError: boolean;
  detailsComplete: boolean;
  onSelect: (addressId: string) => void;
  onRetry: () => void;
  onContinue: () => void;
}

const sectionClass = "rounded-3xl border border-zinc-200/60 bg-white p-6 shadow-[0_8px_30px_rgba(15,23,42,0.04)] md:block md:p-8";

export function AddressSection({
  stage,
  addresses,
  selectedAddressId,
  isLoading,
  hasLoadError,
  detailsComplete,
  onSelect,
  onRetry,
  onContinue,
}: AddressSectionProps) {
  const className = `${stage === "details" ? "block" : "hidden"} ${sectionClass}`;

  if (isLoading) {
    return (
      <section className={className}>
        <div className="flex h-32 items-center justify-center">
          <p className="text-sm font-medium text-zinc-500">Loading delivery addresses...</p>
        </div>
      </section>
    );
  }

  if (hasLoadError) {
    return (
      <section className={className}>
        <div className="flex h-32 flex-col items-center justify-center gap-3">
          <p className="text-sm font-medium text-red-600">Delivery addresses could not load.</p>
          <Button type="button" onClick={onRetry} variant="outline" className="h-11">
            Try again
          </Button>
        </div>
      </section>
    );
  }

  return (
    <section className={className}>
      <h2 className="mb-1 flex items-center gap-2 text-lg font-bold text-zinc-900">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-900 text-xs text-white">1</span>
        Delivery Address
      </h2>
      <p className="mb-5 pl-8 text-xs font-medium text-zinc-500">Choose an available Lusaka delivery area.</p>
      {addresses.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 py-10 text-center">
          <p className="mb-4 text-sm font-semibold text-zinc-900">Add a delivery address before checkout.</p>
          <Button asChild className="h-11 rounded-xl bg-zinc-900 px-6 font-bold text-white hover:bg-zinc-800">
            <Link href="/account/addresses">Manage addresses</Link>
          </Button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {addresses.map((address) => (
              <label
                key={address.id}
                className={`relative flex cursor-pointer flex-col gap-2 rounded-2xl border-2 p-5 text-left transition-all hover:shadow-md ${
                  selectedAddressId === address.id
                    ? "border-[#009E49] bg-[#009E49]/5"
                    : "border-zinc-200 bg-white hover:border-zinc-300"
                }`}
              >
                <input
                  type="radio"
                  name="saved-address"
                  className="sr-only"
                  checked={selectedAddressId === address.id}
                  onChange={() => onSelect(address.id)}
                />
                <div className="flex items-center justify-between">
                  <span className="font-bold text-zinc-900">{address.name}</span>
                  {address.isDefault ? (
                    <span className="rounded bg-zinc-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-zinc-600">
                      Default
                    </span>
                  ) : null}
                </div>
                <div className="text-xs text-zinc-500">
                  <p>{address.street}</p>
                  <p>{address.area}, {address.city}</p>
                  <p className="mt-1 font-medium">{address.phone}</p>
                </div>
              </label>
            ))}
          </div>
          <div className="mt-4 text-right">
            <Link href="/account/addresses" className="text-xs font-bold text-[#009E49] hover:underline">
              Manage Addresses
            </Link>
          </div>
        </>
      )}
      <Button
        type="button"
        disabled={!detailsComplete}
        onClick={onContinue}
        className="mt-6 h-12 w-full rounded-xl bg-[#009E49] font-black text-white hover:bg-[#00853d] disabled:opacity-50 md:hidden"
      >
        Continue to order review
      </Button>
    </section>
  );
}
