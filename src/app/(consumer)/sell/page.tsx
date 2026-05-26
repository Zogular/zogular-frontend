"use client";

import { useState } from "react";
import Link from "next/link";
import {
  UploadCloud, ArrowLeft, TrendingUp, ShieldCheck, Truck,
  Zap, Mail, ChevronDown, Loader2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { submitSellerApplication } from "@/services/auth";
import { toast } from "sonner";

export default function SellOnZogularLanding() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    mobileMoneyNumber: "",
    shopName: "",
    businessType: "individual" as const,
    shopAddress: "",
    nationalId: "",
    idDocumentName: "",
  });

  const handleNext = async (event: React.FormEvent) => {
    event.preventDefault();

    if (step < 3) {
      setStep(step + 1);
      return;
    }

    try {
      setIsSubmitting(true);
      const result = await submitSellerApplication(form);
      router.push(result.nextPath);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to submit seller application.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };

  const updateField = (key: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <main className="relative w-full overflow-hidden bg-zinc-950 selection:bg-[#009E49] selection:text-white">
      <section
        className="relative min-h-screen w-full bg-cover bg-center bg-no-repeat bg-fixed lg:grid lg:grid-cols-2"
        style={{ backgroundImage: "url('https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?q=80&w=2070&auto=format&fit=crop')" }}
      >
        <div className="absolute inset-0 z-0 bg-black/80 lg:bg-black/60"></div>

        <div className="relative z-10 flex min-h-screen flex-col justify-center border-r border-white/10 bg-black/40 px-6 pb-32 pt-12 shadow-[0_0_50px_rgba(0,0,0,0.5)] backdrop-blur-2xl supports-backdrop-filter:bg-black/20 lg:px-12">
          <Link href="/">
            <Button aria-label="Go back" variant="ghost" size="icon" className="absolute left-6 top-6 z-20 h-10 w-10 rounded-full bg-white/10 text-white transition-colors hover:bg-white/20">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>

          <div className="mx-auto w-full max-w-md pt-12 lg:pt-0">
            <div className="mb-8 space-y-4 text-center lg:text-left">
              <div className="flex items-center justify-center gap-2 lg:justify-start">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/20 bg-[#009E49] text-base font-extrabold text-white shadow-[0_0_15px_rgba(0,158,73,0.5)]">
                  Z
                </div>
                <span className="text-2xl font-black tracking-tight text-white drop-shadow-md">Zogular Seller</span>
              </div>
              <div>
                <h1 className="mb-2 text-3xl font-extrabold tracking-tighter text-white drop-shadow-sm md:text-4xl">
                  Partner with us.
                </h1>
                <p className="text-sm font-medium text-zinc-300">
                  {step === 1 ? "Step 1: Let's get to know you." : step === 2 ? "Step 2: Tell us about your shop." : "Step 3: Verify your identity."}
                </p>
              </div>
            </div>

            <div className="mb-8 flex gap-2">
              {[1, 2, 3].map((index) => (
                <div key={index} className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${step >= index ? "bg-[#009E49] shadow-[0_0_10px_rgba(0,158,73,0.5)]" : "bg-white/10"}`}></div>
              ))}
            </div>

            <form onSubmit={handleNext} className="space-y-4">
              {step === 1 ? (
                <div className="animate-in slide-in-from-right-4 space-y-4 fade-in duration-500">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-semibold uppercase tracking-wider text-zinc-300">First Name</label>
                      <Input value={form.firstName} onChange={(event) => updateField("firstName", event.target.value)} placeholder="John" className="h-11 rounded-xl border-white/10 bg-white/5 text-sm text-white placeholder:text-white/40 backdrop-blur-md transition-all focus-visible:bg-white/10 focus-visible:ring-[#009E49]" required />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-semibold uppercase tracking-wider text-zinc-300">Last Name</label>
                      <Input value={form.lastName} onChange={(event) => updateField("lastName", event.target.value)} placeholder="Banda" className="h-11 rounded-xl border-white/10 bg-white/5 text-sm text-white placeholder:text-white/40 backdrop-blur-md transition-all focus-visible:bg-white/10 focus-visible:ring-[#009E49]" required />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold uppercase tracking-wider text-zinc-300">Email Address</label>
                    <Input type="email" value={form.email} onChange={(event) => updateField("email", event.target.value)} placeholder="john@example.com" className="h-11 rounded-xl border-white/10 bg-white/5 text-sm text-white placeholder:text-white/40 backdrop-blur-md transition-all focus-visible:bg-white/10 focus-visible:ring-[#009E49]" required />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold uppercase tracking-wider text-zinc-300">Mobile Money Number</label>
                    <Input type="tel" value={form.mobileMoneyNumber} onChange={(event) => updateField("mobileMoneyNumber", event.target.value)} placeholder="+260 97 123 4567" className="h-11 rounded-xl border-white/10 bg-white/5 text-sm text-white placeholder:text-white/40 backdrop-blur-md transition-all focus-visible:bg-white/10 focus-visible:ring-[#009E49]" required />
                  </div>
                </div>
              ) : null}

              {step === 2 ? (
                <div className="animate-in slide-in-from-right-4 space-y-4 fade-in duration-500">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold uppercase tracking-wider text-zinc-300">Shop Name</label>
                    <Input value={form.shopName} onChange={(event) => updateField("shopName", event.target.value)} placeholder="Lusaka Electronics" className="h-11 rounded-xl border-white/10 bg-white/5 text-sm text-white placeholder:text-white/40 backdrop-blur-md transition-all focus-visible:bg-white/10 focus-visible:ring-[#009E49]" required />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold uppercase tracking-wider text-zinc-300">Business Type</label>
                    <select aria-label="Business type" value={form.businessType} onChange={(event) => updateField("businessType", event.target.value)} className="h-11 w-full appearance-none rounded-xl border border-white/10 bg-white/5 px-4 text-sm font-medium text-white outline-none backdrop-blur-md focus-visible:ring-[#009E49]">
                      <option value="individual" className="bg-zinc-900 text-white">Individual Seller</option>
                      <option value="registered" className="bg-zinc-900 text-white">Registered Business</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold uppercase tracking-wider text-zinc-300">Shop Address</label>
                    <Input value={form.shopAddress} onChange={(event) => updateField("shopAddress", event.target.value)} placeholder="E.g. Cairo Road, Shop #12" className="h-11 rounded-xl border-white/10 bg-white/5 text-sm text-white placeholder:text-white/40 backdrop-blur-md transition-all focus-visible:bg-white/10 focus-visible:ring-[#009E49]" required />
                  </div>
                </div>
              ) : null}

              {step === 3 ? (
                <div className="animate-in slide-in-from-right-4 space-y-4 fade-in duration-500">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold uppercase tracking-wider text-zinc-300">National ID (NRC)</label>
                    <Input value={form.nationalId} onChange={(event) => updateField("nationalId", event.target.value)} placeholder="000000/00/1" className="h-11 rounded-xl border-white/10 bg-white/5 text-sm text-white placeholder:text-white/40 backdrop-blur-md transition-all focus-visible:bg-white/10 focus-visible:ring-[#009E49]" required />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold uppercase tracking-wider text-zinc-300">Upload ID Image</label>
                    <label className="group block cursor-pointer rounded-2xl border-2 border-dashed border-white/20 bg-white/5 p-6 text-center backdrop-blur-md transition-colors hover:bg-white/10">
                      <UploadCloud className="mx-auto mb-2 h-6 w-6 text-[#009E49] transition-transform group-hover:scale-110" />
                      <p className="text-xs font-bold text-white">
                        {form.idDocumentName || "Tap to upload document"}
                      </p>
                      <input
                        type="file"
                        accept="image/*,.pdf"
                        className="hidden"
                        onChange={(event) => updateField("idDocumentName", event.target.files?.[0]?.name ?? "")}
                      />
                    </label>
                  </div>
                </div>
              ) : null}

              <div className="flex items-center gap-3 pt-4">
                {step > 1 ? (
                  <Button type="button" variant="outline" onClick={handleBack} className="h-12 rounded-xl border-white/10 bg-white/5 px-5 font-semibold text-white backdrop-blur-md transition-all hover:bg-white/10">
                    Back
                  </Button>
                ) : null}

                <Button type="submit" disabled={isSubmitting} className="h-12 flex-1 rounded-xl border border-[#009E49]/50 bg-[#009E49]/90 font-extrabold text-white shadow-[0_0_15px_rgba(0,158,73,0.3)] backdrop-blur-md transition-all hover:scale-[1.02] hover:bg-[#009E49]">
                  {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {step < 3 ? "Continue" : isSubmitting ? "Submitting..." : "Submit Application"}
                </Button>
              </div>
            </form>

            <p className="mt-8 text-center text-xs font-medium text-zinc-400">
              Already a verified seller? <Link href="/auth/login" className="font-extrabold text-[#009E49] hover:underline">Sign in here</Link>
            </p>
          </div>

          <div
            className="group absolute bottom-2 left-1/2 z-30 flex -translate-x-1/2 cursor-pointer flex-col items-center"
            onClick={() => window.scrollTo({ top: window.innerHeight, behavior: "smooth" })}
          >
            <span className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-white/50 transition-colors group-hover:text-white">
              Discover More
            </span>
            <div className="flex h-12 w-7 items-start justify-center rounded-full border-2 border-white/20 bg-black/20 p-1.5 shadow-[0_0_15px_rgba(0,0,0,0.5)] backdrop-blur-sm transition-colors group-hover:border-white/40">
              <div className="mt-1 h-2 w-2 animate-bounce rounded-full bg-[#009E49] shadow-[0_0_8px_rgba(0,158,73,0.8)]"></div>
            </div>
            <ChevronDown className="mt-1 h-4 w-4 animate-pulse text-white/30 transition-colors group-hover:text-[#009E49]" />
          </div>
        </div>

        <div className="relative z-10 hidden flex-col items-start justify-center p-16 lg:flex xl:p-24">
          <div className="animate-in slide-in-from-bottom-8 fade-in duration-1000 delay-300">
            <h2 className="mb-6 text-5xl font-black leading-[1.1] tracking-tighter text-white drop-shadow-2xl xl:text-7xl">
              Turn your local <br />
              shop into a <br />
              <span className="bg-linear-to-r from-[#009E49] to-[#00d663] bg-clip-text text-transparent filter drop-shadow-[0_0_20px_rgba(0,158,73,0.4)]">
                national brand.
              </span>
            </h2>
            <p className="max-w-lg border-l-2 border-[#009E49] pl-4 text-lg font-medium text-zinc-300 drop-shadow-md xl:text-xl">
              Access thousands of buyers across Lusaka daily. We handle the platform, the marketing, and the payments. You just pack the orders.
            </p>
          </div>
        </div>
      </section>

      <section className="relative border-t border-white/5 bg-zinc-950 px-6 py-20 md:px-12">
        <div className="pointer-events-none absolute left-1/2 top-0 h-100 w-full max-w-3xl -translate-x-1/2 rounded-full bg-[#009E49]/10 blur-[120px]"></div>
        <div className="relative z-10 mx-auto max-w-7xl">
          <div className="mb-16 text-center">
            <h2 className="mb-4 text-3xl font-black tracking-tight text-white md:text-5xl">Why sell on Zogular?</h2>
            <p className="mx-auto max-w-2xl text-lg font-medium text-zinc-400">We built this platform specifically for Zambian businesses to scale without the technical headaches.</p>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <div className="group rounded-3xl border border-white/10 bg-white/5 p-8 backdrop-blur-sm transition-all duration-300 hover:-translate-y-2 hover:border-[#009E49]/50 hover:bg-white/10 hover:shadow-[0_20px_40px_rgba(0,158,73,0.1)]">
              <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl border border-[#009E49]/30 bg-[#009E49]/20 transition-transform group-hover:scale-110">
                <TrendingUp className="h-7 w-7 text-[#00d663]" />
              </div>
              <h3 className="mb-3 text-xl font-bold text-white">Lowest Commission</h3>
              <p className="text-sm leading-relaxed text-zinc-400">Keep more of your profit. Our fees are strictly capped, ensuring you take home exactly what you deserve from every sale.</p>
            </div>

            <div className="group rounded-3xl border border-white/10 bg-white/5 p-8 backdrop-blur-sm transition-all duration-300 hover:-translate-y-2 hover:border-[#009E49]/50 hover:bg-white/10 hover:shadow-[0_20px_40px_rgba(0,158,73,0.1)]">
              <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl border border-[#009E49]/30 bg-[#009E49]/20 transition-transform group-hover:scale-110">
                <ShieldCheck className="h-7 w-7 text-[#00d663]" />
              </div>
              <h3 className="mb-3 text-xl font-bold text-white">Guaranteed Payouts</h3>
              <p className="text-sm leading-relaxed text-zinc-400">No waiting weeks for your cash. Get secure, automated payouts directly to your registered Mobile Money or Bank Account.</p>
            </div>

            <div className="group rounded-3xl border border-white/10 bg-white/5 p-8 backdrop-blur-sm transition-all duration-300 hover:-translate-y-2 hover:border-[#009E49]/50 hover:bg-white/10 hover:shadow-[0_20px_40px_rgba(0,158,73,0.1)]">
              <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl border border-[#009E49]/30 bg-[#009E49]/20 transition-transform group-hover:scale-110">
                <Truck className="h-7 w-7 text-[#00d663]" />
              </div>
              <h3 className="mb-3 text-xl font-bold text-white">Managed Logistics</h3>
              <p className="text-sm leading-relaxed text-zinc-400">You pack the order, we handle the rest. Our integrated delivery partners will pick up from your shop and deliver to the buyer.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="relative border-t border-white/5 bg-black px-6 py-24 md:px-12">
        <div className="mx-auto max-w-5xl">
          <h2 className="mb-16 text-center text-3xl font-black tracking-tight text-white md:text-5xl">How the partnership works.</h2>

          <div className="relative space-y-12 before:absolute before:inset-0 before:ml-5 before:h-full before:w-0.5 before:-translate-x-px before:bg-linear-to-b before:from-transparent before:via-white/10 before:to-transparent md:before:mx-auto md:before:translate-x-0">
            <div className="group relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse">
              <div className="z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-4 border-black bg-[#009E49] text-white shadow-[0_0_20px_rgba(0,158,73,0.6)] md:order-1 md:group-even:translate-x-1/2 md:group-odd:-translate-x-1/2">
                1
              </div>
              <div className="w-[calc(100%-4rem)] rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm transition-colors group-hover:border-[#009E49]/50 md:w-[calc(50%-3rem)]">
                <h3 className="mb-2 text-xl font-bold text-white">Submit Application</h3>
                <p className="text-sm text-zinc-400">Fill out the quick 3-step form at the top of this page with your basic shop and payout details.</p>
              </div>
            </div>

            <div className="group relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse">
              <div className="z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-4 border-black bg-zinc-800 text-zinc-400 transition-colors group-hover:bg-[#009E49] group-hover:text-white md:order-1 md:group-even:translate-x-1/2 md:group-odd:-translate-x-1/2">
                2
              </div>
              <div className="w-[calc(100%-4rem)] rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm transition-colors group-hover:border-[#009E49]/50 md:w-[calc(50%-3rem)]">
                <h3 className="mb-2 text-xl font-bold text-white">Get Verified</h3>
                <p className="text-sm text-zinc-400">Our team reviews your ID and shop details within 24 hours to ensure a safe platform.</p>
              </div>
            </div>

            <div className="group relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse">
              <div className="z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-4 border-black bg-zinc-800 text-zinc-400 transition-colors group-hover:bg-[#009E49] group-hover:text-white md:order-1 md:group-even:translate-x-1/2 md:group-odd:-translate-x-1/2">
                <Zap className="h-4 w-4" />
              </div>
              <div className="w-[calc(100%-4rem)] rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm transition-colors group-hover:border-[#009E49]/50 md:w-[calc(50%-3rem)]">
                <h3 className="mb-2 text-xl font-bold text-white">Upload & Sell</h3>
                <p className="text-sm text-zinc-400">Access your Seller Dashboard, upload your products, and immediately start reaching buyers across Lusaka.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="relative flex justify-center border-t border-white/5 bg-zinc-950 px-6 py-24 text-center md:px-12">
        <div className="relative w-full max-w-2xl overflow-hidden rounded-[3rem] border border-white/10 bg-linear-to-b from-white/10 to-white/5 p-8 shadow-2xl backdrop-blur-xl md:p-16">
          <div className="pointer-events-none absolute left-1/2 top-0 h-32 w-full -translate-x-1/2 rounded-full bg-[#009E49]/20 blur-[60px]"></div>
          <Mail className="relative z-10 mx-auto mb-6 h-10 w-10 text-[#009E49]" />
          <h2 className="relative z-10 mb-4 text-3xl font-black tracking-tight text-white">Not ready to sell yet?</h2>
          <p className="relative z-10 mb-8 font-medium text-zinc-400">Subscribe to our seller newsletter. Get tips on scaling your physical shop, local e-commerce trends, and updates on Zogular.</p>
          <div className="relative z-10 mx-auto flex max-w-md flex-col gap-3 sm:flex-row">
            <Input type="email" placeholder="Enter your email" className="h-12 rounded-xl border-white/10 bg-black/50 text-white placeholder:text-white/40 transition-all focus-visible:ring-[#009E49]" />
            <Button className="h-12 w-full rounded-xl bg-[#009E49] px-6 font-bold text-white transition-all hover:bg-[#00d663] sm:w-auto">
              Subscribe
            </Button>
          </div>
        </div>
      </section>
    </main>
  );
}
