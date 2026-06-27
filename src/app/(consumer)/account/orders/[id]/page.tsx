"use client";

import * as React from "react";
import { use } from "react";
import Link from "next/link";
import { AlertCircle, ArrowLeft, MapPin, Printer, CheckCircle2, Clock, Truck, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { FeedbackState } from "@/components/states/FeedbackState";
import { getInvoiceById } from "@/services/orders";
import type { Invoice } from "@/types/order";

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

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between print:hidden">
        <Link href="/account/orders">
          <Button variant="ghost" className="text-zinc-600 hover:text-zinc-900">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Orders
          </Button>
        </Link>

        <Button onClick={() => window.print()} className="bg-zinc-900 text-white hover:bg-zinc-800">
          <Printer className="mr-2 h-4 w-4" /> Print Invoice
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
            <h1 className="text-2xl font-black text-zinc-900">INVOICE</h1>
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
            <p className="mt-2 text-sm text-zinc-600">
              <span className="font-medium text-zinc-500">Payment:</span> {invoice.paymentMethod}
            </p>
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

        <div className="mt-8 flex justify-end border-t border-zinc-200 pt-6">
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
          </div>
        </div>
      </div>
    </div>
  );
}
