"use client";

import * as React from "react";
import Link from "next/link";
import {
  CheckCircle2,
  ChevronRight,
  Clock,
  Heart,
  MapPin,
  Package,
  ShoppingBag,
  Truck,
  User,
  HeadphonesIcon,
  MessageCircle,
  Phone,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { AccountLoadErrorState } from "@/components/account/AccountLoadErrorState";
import { useWishlist } from "@/hooks/use-wishlist";
import { useCart } from "@/hooks/use-cart";
import { useHydratedValue } from "@/hooks/use-hydrated-value";
import { getAccountOverview } from "@/services/account";
import type { AccountOverview } from "@/types/account";
import { SUPPORT_WHATSAPP_NUMBER, SUPPORT_CALL_NUMBER } from "@/config/support";

export default function AccountOverviewPage() {
  const [data, setData] = React.useState<AccountOverview | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<unknown>(null);

  const { itemCount: savedItemsCount, hasHydrated: wishlistHydrated } = useWishlist();
  const { itemCount: cartItemsCount, totalAmount: cartTotal, hasHydrated: cartHydrated } = useCart();

  const safeSavedItemsCount = useHydratedValue(savedItemsCount, 0);
  const safeCartItemsCount = useHydratedValue(cartItemsCount, 0);
  const safeCartTotal = useHydratedValue(cartTotal, 0);

  const loadData = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await getAccountOverview();
      setData(result);
    } catch (loadError) {
      setError(loadError);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading) {
    return <div className="py-20 text-center text-sm font-medium text-zinc-500">Loading your account dashboard...</div>;
  }

  if (error || !data) {
    return (
      <AccountLoadErrorState error={error} resource="account" onRetry={loadData} />
    );
  }



  return (
    <div className="space-y-8 pb-8">
      <div className="flex flex-col justify-between gap-4 rounded-3xl border border-zinc-200/60 bg-white p-6 shadow-[0_8px_30px_rgba(15,23,42,0.04)] animate-in fade-in slide-in-from-bottom-4 duration-500 md:flex-row md:items-center md:p-8">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-zinc-900 md:text-3xl">
            Welcome back, {data.user.firstName}!
          </h1>
          <p className="mt-1 text-sm font-medium text-zinc-500">
            Manage your orders, track deliveries, and secure your account.
          </p>
        </div>
        <Link href="/account/settings">
          <Button variant="outline" className="flex h-11 w-full items-center gap-2 rounded-xl border-zinc-200 px-5 text-zinc-700 shadow-sm transition-colors hover:bg-zinc-50 hover:text-zinc-900 md:w-auto">
            <User className="h-4 w-4" /> Edit Profile
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-3 animate-in fade-in slide-in-from-bottom-4 fill-mode-both duration-500 md:grid-cols-3 md:gap-4" style={{ animationDelay: "100ms" }}>
        <div className="group relative overflow-hidden rounded-[20px] border border-zinc-200/60 bg-white p-5 shadow-[0_4px_20px_rgba(0,0,0,0.03)] transition-shadow hover:shadow-md md:rounded-3xl md:p-6">
          <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-blue-50 transition-transform group-hover:scale-110" />
          <div className="relative z-10 flex items-center justify-between md:flex-col md:items-start">
            <div className="flex items-center gap-3 md:block">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100 text-blue-600 md:mb-4">
                <Package className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-xl font-black leading-none text-zinc-900 md:text-2xl md:leading-normal">{data.activeOrdersCount}</h3>
                <p className="mt-1 text-xs font-bold text-zinc-500 md:mt-0.5 md:text-sm">
                  Active Order{data.activeOrdersCount !== 1 ? "s" : ""}
                </p>
              </div>
            </div>
            <Link href="/account/orders" className="flex items-center gap-1 rounded-lg bg-blue-50/50 px-3 py-2 text-[10px] font-bold text-blue-600 hover:underline md:mt-3 md:rounded-none md:bg-transparent md:px-0 md:py-0 md:text-xs">
              Track <span className="hidden md:inline">Order</span> <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
        </div>

        <div className="group relative overflow-hidden rounded-[20px] border border-zinc-200/60 bg-white p-5 shadow-[0_4px_20px_rgba(0,0,0,0.03)] transition-shadow hover:shadow-md md:rounded-3xl md:p-6">
          <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-red-50 transition-transform group-hover:scale-110" />
          <div className="relative z-10 flex items-center justify-between md:flex-col md:items-start">
            <div className="flex items-center gap-3 md:block">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-100 text-red-500 md:mb-4">
                <Heart className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-xl font-black leading-none text-zinc-900 md:text-2xl md:leading-normal">
                  {wishlistHydrated ? safeSavedItemsCount : "—"}
                </h3>
                <p className="mt-1 text-xs font-bold text-zinc-500 md:mt-0.5 md:text-sm">Saved Items</p>
              </div>
            </div>
            <Link href="/account/saved" className="flex items-center gap-1 rounded-lg bg-red-50/50 px-3 py-2 text-[10px] font-bold text-red-500 hover:underline md:mt-3 md:rounded-none md:bg-transparent md:px-0 md:py-0 md:text-xs">
              View <span className="hidden md:inline">Wishlist</span> <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
        </div>

        <div className="group relative overflow-hidden rounded-[20px] border border-[#009E49]/20 bg-[linear-gradient(145deg,rgba(0,158,73,0.92),rgba(0,126,58,0.82))] p-5 shadow-lg shadow-[#009E49]/20 transition-shadow hover:shadow-[#009E49]/30 md:rounded-3xl md:p-6">
          <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-white/10 transition-transform group-hover:scale-110" />
          <div className="relative z-10 flex items-center justify-between md:flex-col md:items-start">
            <div className="flex items-center gap-3 md:block">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/20 text-white backdrop-blur-md md:mb-4">
                <ShoppingBag className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-xl font-black leading-none text-white md:text-2xl md:leading-normal">
                  {cartHydrated ? `K${safeCartTotal.toLocaleString()}` : "—"}
                </h3>
                <p className="mt-1 text-xs font-bold text-white/80 md:mt-0.5 md:text-sm">
                  Cart Subtotal ({cartHydrated ? safeCartItemsCount : 0} item{safeCartItemsCount === 1 ? "" : "s"})
                </p>
              </div>
            </div>
            <Link href="/checkout" className="flex items-center gap-1 rounded-lg bg-black/10 px-3 py-2 text-[10px] font-bold text-white hover:underline backdrop-blur-sm md:mt-3 md:rounded-none md:bg-transparent md:px-0 md:py-0 md:text-xs md:backdrop-blur-none">
              Checkout <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 animate-in fade-in slide-in-from-bottom-4 fill-mode-both duration-500 xl:grid-cols-[2fr_1fr]" style={{ animationDelay: "200ms" }}>
        <div className="flex h-full flex-col rounded-3xl border border-zinc-200/60 bg-white p-6 shadow-[0_8px_30px_rgba(15,23,42,0.04)] md:p-8">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-lg font-black text-zinc-900">Recent Orders</h2>
            <Link href="/account/orders" className="text-sm font-bold text-[#009E49] hover:underline">
              View All
            </Link>
          </div>

          <div className="flex flex-col gap-4">
            {data.recentOrders.length === 0 ? (
              <p className="text-sm text-zinc-500">No recent orders found.</p>
            ) : (
              data.recentOrders.map((order) => (
                <div key={order.id} className="rounded-2xl border border-zinc-100 bg-zinc-50/50 p-4 transition-colors hover:border-zinc-300 md:p-5">
                  <div className="mb-4 flex flex-col justify-between gap-4 md:flex-row md:items-center">
                    <div>
                      <h3 className="font-bold text-zinc-900">{order.id}</h3>
                      <p className="mt-0.5 text-xs font-medium text-zinc-500">
                        {order.date} • {order.items.reduce((sum, item) => sum + item.qty, 0)} Item{order.items.length === 1 ? "" : "s"}
                      </p>
                    </div>
                    <div className="flex flex-col md:items-end">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">{order.isLegacyIncomplete ? "Item subtotal" : "Total"}</span>
                      <span className="font-black text-zinc-900">{order.isLegacyIncomplete ? `K${order.itemSubtotal.toLocaleString()}` : `K${order.total?.toLocaleString()}`}</span>
                      {order.isLegacyIncomplete && <span className="text-[10px] text-orange-600 font-bold mt-0.5">Payment breakdown unavailable</span>}
                      {order.status === "processing" ? (
                        <Badge className="mt-1 gap-1 border-none bg-amber-100 px-2 shadow-none text-amber-700 hover:bg-amber-100">
                          <Clock className="h-3 w-3" /> Processing
                        </Badge>
                      ) : (
                        <Badge className="mt-1 gap-1 border-none bg-emerald-100 px-2 shadow-none text-emerald-700 hover:bg-emerald-100">
                          <CheckCircle2 className="h-3 w-3" /> Delivered
                        </Badge>
                      )}
                    </div>
                  </div>

                  <Separator className="mb-4 bg-zinc-200/60" />

                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-1.5 font-medium text-zinc-600">
                      <Truck className="h-4 w-4 text-zinc-400" /> {order.estDelivery}
                    </span>
                    <Link href={`/account/orders/${order.id}`}>
                      <Button variant="ghost" size="sm" className="h-8 font-bold text-[#009E49] hover:bg-[#009E49]/10 hover:text-[#009E49]">
                        Track
                      </Button>
                    </Link>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="flex flex-col gap-6">


          <div className="rounded-3xl border border-zinc-200/60 bg-white p-6 shadow-[0_8px_30px_rgba(15,23,42,0.04)]">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-lg font-black text-zinc-900">
                <MapPin className="h-5 w-5 text-zinc-400" /> Default Address
              </h2>
              <Link href="/account/addresses" className="text-xs font-bold text-[#009E49] hover:underline">
                Manage
              </Link>
            </div>
            {data.defaultAddress ? (
              <div className="rounded-2xl border border-zinc-100 bg-zinc-50/80 p-4">
                <p className="mb-1 text-sm font-bold text-zinc-900">{data.defaultAddress.name}</p>
                <p className="text-xs leading-relaxed text-zinc-600">
                  {data.defaultAddress.street}
                  <br />
                  {data.defaultAddress.area}
                  <br />
                  {data.defaultAddress.city}
                </p>
                <p className="mt-2 text-xs font-medium text-zinc-500">{data.defaultAddress.phone}</p>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50/80 p-6 text-center">
                <p className="text-sm font-bold text-zinc-900">No default address</p>
                <p className="mt-1 text-xs leading-relaxed text-zinc-500">Add your first delivery address.</p>
                <Link href="/account/addresses">
                  <Button variant="outline" className="mt-3 h-8 text-xs font-bold text-[#009E49] hover:bg-[#009E49]/10">
                    Add Address
                  </Button>
                </Link>
              </div>
            )}
          </div>

          <div className="rounded-3xl border border-zinc-200/60 bg-white p-6 shadow-[0_8px_30px_rgba(15,23,42,0.04)]">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-black text-zinc-900">
              <HeadphonesIcon className="h-5 w-5 text-zinc-400" /> Support
            </h2>
            <div className="rounded-2xl border border-zinc-100 bg-zinc-50/80 p-4">
              {(!SUPPORT_WHATSAPP_NUMBER && !SUPPORT_CALL_NUMBER) ? (
                <p className="text-sm font-medium text-zinc-600">
                  Support contact will be available before launch.
                </p>
              ) : (
                <div className="flex flex-col gap-3">
                  {SUPPORT_WHATSAPP_NUMBER && (
                    <a href={`https://wa.me/${SUPPORT_WHATSAPP_NUMBER.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer">
                      <Button variant="outline" className="h-10 w-full justify-start rounded-xl border-[#25D366]/20 bg-[#25D366]/5 text-[#128C7E] hover:bg-[#25D366]/10">
                        <MessageCircle className="mr-2 h-4 w-4" />
                        WhatsApp Support
                      </Button>
                    </a>
                  )}
                  {SUPPORT_CALL_NUMBER && (
                    <a href={`tel:${SUPPORT_CALL_NUMBER}`}>
                      <Button variant="outline" className="h-10 w-full justify-start rounded-xl border-zinc-200 text-zinc-700 hover:bg-zinc-50">
                        <Phone className="mr-2 h-4 w-4" />
                        Call Support
                      </Button>
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>


    </div>
  );
}
