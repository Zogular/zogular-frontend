"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  MapPin,
  Package,
  Search,
  ShieldCheck,
  Truck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

const TRACKING_STEPS = [
  {
    title: "Order Placed",
    body: "We have received your order.",
    time: "Apr 08, 2026 - 09:45 AM",
    complete: true,
  },
  {
    title: "Order Processed",
    body: "Your items have been packed and handed over to our delivery partner.",
    time: "Apr 09, 2026 - 02:15 PM",
    complete: true,
  },
  {
    title: "In Transit",
    body: "Package is at the Lusaka Main Sorting Hub and is out for delivery today.",
    time: "Today - 08:30 AM",
    current: true,
  },
  {
    title: "Delivered",
    body: "Package handed to resident.",
    pending: true,
  },
];

export default function TrackOrderPage() {
  const [isTracking, setIsTracking] = useState(false);
  const [orderId, setOrderId] = useState("");

  const handleTrack = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (orderId.trim()) setIsTracking(true);
  };

  return (
    <main className="min-h-screen overflow-hidden bg-[#f4fbf6] px-4 pb-24 pt-10 md:pb-32">
      <div className="container relative mx-auto max-w-5xl">
        <section className="relative overflow-hidden rounded-[32px] border border-white/75 bg-[linear-gradient(135deg,rgba(0,158,73,0.14),rgba(255,255,255,0.86),rgba(255,107,0,0.12))] p-5 shadow-[0_24px_70px_rgba(15,23,42,0.08)] backdrop-blur-2xl md:p-8">
          <div className="absolute right-6 top-6 hidden h-28 w-28 rounded-full border border-white/60 bg-white/24 blur-2xl md:block" />

          <div className="relative grid gap-8 lg:grid-cols-[minmax(0,1fr)_21rem] lg:items-end">
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/75 bg-white/66 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.18em] text-[#009E49] shadow-sm backdrop-blur-xl">
                <Package className="h-3.5 w-3.5" />
                Delivery tracking
              </div>
              <h1 className="mt-5 max-w-2xl text-4xl font-black leading-none text-zinc-950 md:text-6xl">
                Track Your Order
              </h1>
              <p className="mt-5 max-w-2xl text-sm font-medium leading-7 text-zinc-600 md:text-base">
                Enter your Zogular order ID and email address to see the current delivery status and support next steps.
              </p>
            </div>

            <aside className="rounded-[26px] border border-white/70 bg-zinc-950 p-5 text-white shadow-[0_18px_46px_rgba(15,23,42,0.14)]">
              <ShieldCheck className="h-6 w-6 text-[#00c95d]" />
              <p className="mt-4 text-lg font-black leading-tight">Delivery support shaped for Lusaka shoppers.</p>
              <p className="mt-2 text-sm leading-6 text-zinc-300">
                Track movement, confirm delivery expectations, and jump into support if something feels off.
              </p>
            </aside>
          </div>
        </section>

        <section className="mt-6 rounded-[28px] border border-white/75 bg-white/80 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.06)] backdrop-blur-xl md:p-6">
          <form onSubmit={handleTrack} className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] md:items-end">
            <div className="space-y-1.5">
              <label className="pl-1 text-[10px] font-bold uppercase tracking-wider text-zinc-500">Order ID</label>
              <Input
                value={orderId}
                onChange={(event) => setOrderId(event.target.value)}
                placeholder="e.g. ZM-10928"
                className="h-12 rounded-xl border-zinc-200 bg-zinc-50 text-base font-medium shadow-inner focus-visible:ring-[#009E49]"
                required
              />
            </div>
            <div className="space-y-1.5">
              <label className="pl-1 text-[10px] font-bold uppercase tracking-wider text-zinc-500">Email Address</label>
              <Input
                type="email"
                placeholder="Email used for purchase"
                className="h-12 rounded-xl border-zinc-200 bg-zinc-50 text-base shadow-inner focus-visible:ring-[#009E49]"
                required
              />
            </div>
            <Button type="submit" className="h-12 rounded-xl bg-zinc-900 px-8 font-bold text-white shadow-md shadow-zinc-900/20 hover:bg-zinc-800">
              <Search className="mr-2 h-4 w-4" />
              Track
            </Button>
          </form>
        </section>

        {isTracking ? (
          <section className="mt-6 overflow-hidden rounded-[30px] border border-white/75 bg-white/80 shadow-[0_24px_70px_rgba(15,23,42,0.08)] backdrop-blur-xl animate-in fade-in zoom-in-95 duration-400">
            <div className="flex flex-col gap-4 border-b border-zinc-100 p-5 md:flex-row md:items-center md:justify-between md:p-7">
              <div>
                <h2 className="flex flex-wrap items-center gap-2 text-xl font-black text-zinc-900">
                  Order {orderId}
                  <Badge className="border-none bg-blue-100 px-2 py-0.5 font-bold text-blue-700 shadow-none hover:bg-blue-100">
                    In Transit
                  </Badge>
                </h2>
                <p className="mt-1 text-sm font-medium text-zinc-500">
                  Estimated delivery: <span className="font-bold text-zinc-900">April 11, 2026</span>
                </p>
              </div>
              <div className="rounded-2xl border border-zinc-100 bg-zinc-50 px-4 py-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Carrier</p>
                <p className="mt-1 flex items-center gap-1.5 text-sm font-bold text-zinc-900">
                  <Truck className="h-4 w-4 text-[#FF6B00]" />
                  Zogular Express
                </p>
              </div>
            </div>

            <div className="grid gap-6 p-5 md:grid-cols-[minmax(0,1fr)_18rem] md:p-7">
              <div className="relative space-y-7 pl-7">
                <div className="absolute bottom-4 left-3 top-2 w-0.5 rounded-full bg-zinc-100">
                  <div className="h-[63%] w-full rounded-full bg-[#009E49]" />
                </div>

                {TRACKING_STEPS.map((step) => (
                  <div key={step.title} className={cn("relative", step.pending && "opacity-45")}>
                    <div
                      className={cn(
                        "absolute -left-7 top-1 flex h-6 w-6 items-center justify-center rounded-full ring-4 ring-white",
                        step.complete && "bg-[#009E49] shadow-sm",
                        step.current && "border-2 border-[#009E49] bg-white shadow-sm",
                        step.pending && "border border-zinc-200 bg-zinc-100",
                      )}
                    >
                      {step.complete ? <CheckCircle2 className="h-3.5 w-3.5 text-white" /> : null}
                      {step.current ? <span className="h-2 w-2 animate-pulse rounded-full bg-[#009E49]" /> : null}
                    </div>
                    <h3 className={cn("text-sm font-bold", step.current ? "text-[#009E49]" : "text-zinc-900")}>{step.title}</h3>
                    <p className="mt-0.5 text-xs font-medium leading-5 text-zinc-600">{step.body}</p>
                    {step.time ? (
                      <p className="mt-1.5 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-zinc-400">
                        <Clock3 className="h-3 w-3" />
                        {step.time}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>

              <aside className="rounded-[24px] border border-zinc-100 bg-zinc-50 p-4">
                <MapPin className="h-5 w-5 text-[#009E49]" />
                <p className="mt-3 text-sm font-black text-zinc-900">Destination</p>
                <p className="mt-1 text-sm leading-6 text-zinc-500">Woodlands Area, Lusaka</p>
                <Separator className="my-4 bg-zinc-200" />
                <Link
                  href="/help"
                  className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#009E49] px-4 py-3 text-sm font-bold text-white shadow-[0_14px_28px_rgba(0,158,73,0.16)] transition-all hover:-translate-y-0.5 hover:bg-[#00853d] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#009E49] focus-visible:ring-offset-2 active:translate-y-0.5"
                >
                  Report an issue
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </aside>
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}
