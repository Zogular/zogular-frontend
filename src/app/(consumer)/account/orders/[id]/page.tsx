"use client";

import * as React from "react";
import { use } from "react";
import Link from "next/link";
import { AlertCircle, ArrowLeft, MapPin, Printer, CheckCircle2, Clock, Truck, XCircle, MessageCircle, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { FeedbackState } from "@/components/states/FeedbackState";
import { getInvoiceById } from "@/services/orders";
import type { Invoice } from "@/types/order";
import { SUPPORT_WHATSAPP_NUMBER, SUPPORT_CALL_NUMBER } from "@/config/support";
import { useCart } from "@/hooks/use-cart";

const STATUS_CONFIG = {
  processing: {
    label: "Processing",
    icon: Clock,
    className: "bg-amber-100 text-amber-700",
  },
  shipped: {
    label: "In Transit",
    icon: Truck,
    className: "bg-blue-100 text-blue-700",
  },
  delivered: {
    label: "Delivered",
    icon: CheckCircle2,
    className: "bg-[#009E49]/10 text-[#009E49]",
  },
  cancelled: {
    label: "Cancelled",
    icon: XCircle,
    className: "bg-red-100 text-red-700",
  },
} as const;

function formatCurrency(value: number) {
  return `K${value.toLocaleString()}`;
}

export default function InvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const [invoice, setInvoice] = React.useState<Invoice | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const loadInvoice = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getInvoiceById(id);
      setInvoice(data);
    } catch (err) {
      if (err && typeof err === "object" && "status" in err && err.status === 401) {
        setError("Your session expired. Please sign in again.");
      } else {
        setError(err instanceof Error ? err.message : "An unknown error occurred");
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  React.useEffect(() => {
    loadInvoice();
  }, [loadInvoice]);

  if (loading) {
    return <div className="py-16 text-center text-sm font-medium text-zinc-500">Loading invoice details...</div>;
  }

  if (error) {
    return (
      <FeedbackState
        icon={AlertCircle}
        tone="danger"
        title="Failed to load invoice"
        description={error}
        action={
          error === "Your session expired. Please sign in again." ? (
            <Link href={`/auth/login?next=/account/orders/${id}`}>
              <Button className="bg-zinc-900 text-white hover:bg-zinc-800">
                Sign In
              </Button>
            </Link>
          ) : (
            <div className="flex flex-col justify-center gap-3 md:flex-row">
              <Button onClick={loadInvoice} variant="outline" className="h-11 w-full rounded-xl border-red-200 text-red-700 hover:bg-red-100 md:w-auto">
                Try Again
              </Button>
              <Link href="/account/orders" className="w-full md:w-auto">
                <Button variant="outline" className="h-11 w-full rounded-xl border-zinc-200 text-zinc-700 hover:bg-zinc-50">
                  Back to Orders
                </Button>
              </Link>
            </div>
          )
        }
      />
    );
  }

  if (!invoice) return null;

  const whatsappLink = SUPPORT_WHATSAPP_NUMBER
    ? `https://wa.me/${SUPPORT_WHATSAPP_NUMBER.replace(/\D/g, "")}?text=${encodeURIComponent(`Hi Zogular, I need help with Order #${invoice.orderNumber || invoice.id}`)}`
    : null;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between print:hidden">
        <Link href="/account/orders">
          <Button variant="ghost" className="text-zinc-600 hover:text-zinc-900">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Orders
          </Button>
        </Link>

        <Button onClick={() => window.print()} className="bg-zinc-900 text-white hover:bg-zinc-800">
          <Printer className="mr-2 h-4 w-4" /> View / Print Receipt
        </Button>
      </div>

      <div className="rounded-3xl border border-zinc-200/60 bg-white p-6 shadow-sm sm:p-10 print:border-none print:shadow-none print:p-0">
        <div className="mb-8 flex flex-col justify-between gap-6 sm:flex-row">
          <div>
            <h2 className="text-2xl font-black text-[#009E49]">Zogular</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Plot 45, Cairo Road
              <br />
              Lusaka, Zambia
            </p>
          </div>

          <div className="sm:text-right">
            <h1 className="text-2xl font-black text-zinc-900">RECEIPT</h1>
            <p className="mt-1 text-sm font-bold text-zinc-700">#{invoice.orderNumber || invoice.id}</p>
            <p className="text-sm text-zinc-500">Issued: {invoice.date}</p>
            
            {(() => {
              const config = STATUS_CONFIG[invoice.status];
              const Icon = config.icon;
              return (
                <div className="mt-3 sm:flex sm:justify-end">
                  <Badge className={`flex w-fit items-center gap-1.5 border-none px-3 py-1 text-xs shadow-none ${config.className}`}>
                    <Icon className="h-3.5 w-3.5" />
                    {config.label}
                  </Badge>
                </div>
              );
            })()}
          </div>
        </div>

        {invoice.status !== "cancelled" ? (
          <div className="mb-8 rounded-2xl bg-zinc-50 p-4 sm:p-6 print:hidden">
            <h3 className="mb-4 text-xs font-bold uppercase tracking-wider text-zinc-400">Order Tracker</h3>
            <div className="flex items-center justify-between">
              {["processing", "shipped", "delivered"].map((step, index, arr) => {
                const isActive = invoice.status === step || (invoice.status === "delivered" && index < 2) || (invoice.status === "shipped" && step === "processing");
                const config = STATUS_CONFIG[step as keyof typeof STATUS_CONFIG];
                const StepIcon = config.icon;
                
                return (
                  <div key={step} className="flex flex-1 flex-col items-center gap-2 relative">
                    <div className={`z-10 flex h-10 w-10 items-center justify-center rounded-full border-4 border-zinc-50 transition-colors ${isActive ? config.className : "bg-zinc-200 text-zinc-400"}`}>
                      <StepIcon className="h-4 w-4" />
                    </div>
                    <p className={`text-xs font-bold ${isActive ? "text-zinc-900" : "text-zinc-400"}`}>
                      {config.label}
                    </p>
                    {index < arr.length - 1 && (
                      <div className={`absolute left-[50%] top-5 -z-0 h-1 w-full -translate-y-1/2 transition-colors ${
                        (invoice.status === "delivered") || (invoice.status === "shipped" && step === "processing") ? "bg-[#009E49]" : "bg-zinc-200"
                      }`} />
                    )}
                  </div>
                );
              })}
            </div>
            {invoice.status === "shipped" && (
              <p className="mt-4 text-center text-sm font-medium text-blue-700">
                Rider contact will appear here once assigned.
              </p>
            )}
          </div>
        ) : (
          <div className="mb-8 rounded-2xl bg-red-50 p-4 sm:p-6 print:hidden">
            <div className="flex items-start gap-3">
              <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
              <div>
                <h3 className="text-sm font-bold text-red-900">Order Cancelled</h3>
                <p className="mt-1 text-sm text-red-700">
                  Refund status will appear here when a cancelled order has a recorded refund.
                </p>
              </div>
            </div>
          </div>
        )}

        <Separator className="bg-zinc-100" />

        <div className="mt-8 grid gap-8 sm:grid-cols-2">
          <div>
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-zinc-400">Billed To</h3>
            <p className="font-bold text-zinc-900">{invoice.customer.name}</p>
            <p className="text-sm text-zinc-600">{invoice.customer.email}</p>
            <p className="text-sm text-zinc-600">{invoice.customer.phone}</p>
          </div>

          <div>
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-zinc-400">Shipping Details</h3>
            <div className="flex items-start gap-2 text-sm text-zinc-600">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-zinc-400" />
              <span>
                {invoice.shipping.address}
                <br />
                {invoice.shipping.area}, {invoice.shipping.city}
              </span>
            </div>
            <div className="mt-3 rounded-lg border border-zinc-200 p-3 bg-zinc-50">
              <p className="text-sm text-zinc-600">
                <span className="font-bold text-zinc-700">Payment:</span> {invoice.paymentMethod}
              </p>
              <p className="mt-1 text-xs text-zinc-500">
                Payment confirmation is handled during order processing.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-10">
          <div className="hidden grid-cols-[1fr_80px_100px] border-b border-zinc-200 pb-3 sm:grid">
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">Item</span>
            <span className="text-right text-xs font-bold uppercase tracking-wider text-zinc-400">Qty</span>
            <span className="text-right text-xs font-bold uppercase tracking-wider text-zinc-400">Price</span>
          </div>

          <div className="divide-y divide-zinc-100">
            {invoice.items.map((item, index) => (
              <div key={`${item.name}-${index}`} className="flex flex-col py-4 sm:grid sm:grid-cols-[1fr_80px_100px] sm:items-center">
                <span className="font-bold text-zinc-900">{item.name}</span>
                <span className="mt-1 text-sm text-zinc-500 sm:mt-0 sm:text-right">{item.qty}</span>
                <span className="mt-1 font-medium text-zinc-900 sm:mt-0 sm:text-right">
                  {formatCurrency(item.price)}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-8 flex flex-col justify-between border-t border-zinc-200 pt-6 sm:flex-row">
          <div className="mb-6 space-y-4 sm:mb-0 print:hidden">
            <div className="flex flex-col gap-3 sm:flex-row">
              {whatsappLink && (
                <a href={whatsappLink} target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" className="h-11 w-full rounded-xl border-[#25D366]/20 bg-[#25D366]/5 text-[#128C7E] hover:bg-[#25D366]/10 sm:w-auto">
                    <MessageCircle className="mr-2 h-4 w-4" />
                    WhatsApp Support
                  </Button>
                </a>
              )}
              {SUPPORT_CALL_NUMBER && (
                <a href={`tel:${SUPPORT_CALL_NUMBER}`}>
                  <Button variant="outline" className="h-11 w-full rounded-xl border-zinc-200 text-zinc-700 hover:bg-zinc-50 sm:w-auto">
                    <Phone className="mr-2 h-4 w-4" />
                    Call Support
                  </Button>
                </a>
              )}
            </div>
            <div className="space-y-2">
              <Link href="/categories">
                <Button 
                  className="h-11 w-full rounded-xl bg-zinc-900 font-bold text-white hover:bg-zinc-800 sm:w-auto"
                >
                  Browse Products
                </Button>
              </Link>
              {(() => {
                const canReorderAll = invoice.items.every(
                  (item) =>
                    Boolean(item.productId) &&
                    Boolean(item.slug) &&
                    Boolean(item.image) &&
                    Boolean(item.name) &&
                    typeof item.price === "number" &&
                    typeof item.qty === "number" &&
                    item.qty > 0
                );

                return (
                  <div className="flex flex-col gap-2">
                    <Button
                      variant="outline"
                      className="h-11 w-full rounded-xl border-zinc-200 font-bold text-zinc-900 hover:bg-zinc-50 sm:w-auto"
                      disabled={!canReorderAll}
                      onClick={() => {
                        if (!canReorderAll) return;
                        const cart = useCart.getState();
                        invoice.items.forEach((item) => {
                          cart.addItem({
                            id: item.productId as string,
                            slug: item.slug as string,
                            image: item.image as string,
                            name: item.name as string,
                            price: item.price,
                            quantity: item.qty,
                          });
                        });
                      }}
                    >
                      Order Again
                    </Button>
                    {!canReorderAll && (
                      <p className="text-xs font-medium text-red-600 sm:max-w-[200px]">
                        Some items are missing product details. Please browse products instead.
                      </p>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>

          <div className="w-full space-y-3 sm:w-72">
            <div className="flex justify-between text-sm">
              <span className="text-zinc-500">Subtotal</span>
              <span className="font-medium text-zinc-900">{formatCurrency(invoice.subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-zinc-500">Shipping Fee</span>
              <span className="font-medium text-zinc-900">{formatCurrency(invoice.shippingFee)}</span>
            </div>

            {invoice.discount > 0 ? (
              <div className="flex justify-between text-sm text-[#009E49]">
                <span>Discount</span>
                <span className="font-medium">-{formatCurrency(invoice.discount)}</span>
              </div>
            ) : null}

            <Separator className="bg-zinc-100" />

            <div className="flex items-center justify-between pt-1">
              <span className="font-bold text-zinc-900">Total</span>
              <span className="text-2xl font-black text-[#009E49]">
                {formatCurrency(invoice.total)}
              </span>
            </div>

            {typeof invoice.commitmentFeeAmount === "number" && typeof invoice.cashDueOnDelivery === "number" && (
              <div className="mt-3 space-y-2 rounded-xl bg-orange-50 p-3 text-sm print:bg-transparent print:p-0 print:border print:border-zinc-200">
                <div className="flex justify-between font-bold text-orange-900 print:text-zinc-900">
                  <span>Commitment Fee (Pending)</span>
                  <span>{formatCurrency(invoice.commitmentFeeAmount)}</span>
                </div>
                <div className="flex justify-between font-bold text-zinc-900">
                  <span>Cash Due on Delivery</span>
                  <span>{formatCurrency(invoice.cashDueOnDelivery)}</span>
                </div>
                <p className="text-[10px] font-medium leading-tight text-orange-700 print:hidden">
                  * Estimated MVP breakdown. Official payment status is pending.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
