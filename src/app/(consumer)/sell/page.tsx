"use client";

import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  ChevronRight,
  FileCheck2,
  PhoneCall,
  ShieldCheck,
  Sparkles,
  Store,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { appendNextPath } from "@/services/auth-intent";

const SELLER_ONBOARDING_PATH = "/seller/onboarding?start=1";
const SELLER_ENTRY_PATH = "/seller";
const SELLER_REGISTER_PATH = appendNextPath(
  "/seller/register",
  SELLER_ONBOARDING_PATH,
);
const SELLER_LOGIN_PATH = appendNextPath(
  "/seller/login",
  SELLER_ENTRY_PATH,
);

const HIGHLIGHTS = [
  {
    title: "Reach Lusaka-first buyers",
    body: "Launch into a marketplace shaped around Zambia, compact mobile UX, and trust-led seller growth from day one.",
    icon: Store,
  },
  {
    title: "Structured seller review",
    body: "Seller approval and product approval stay separate, so platform trust remains strong while you prepare listings safely.",
    icon: ShieldCheck,
  },
  {
    title: "Provisional workspace access",
    body: "Approved later, but productive earlier. Start onboarding, monitor status, and prepare product drafts once provisional access opens.",
    icon: Sparkles,
  },
];

const SELLER_FLOW = [
  {
    mobile: "Create or sign in",
    desktop: "Create or sign in to your ZOGULAR account",
  },
  {
    mobile: "Verify email",
    desktop: "Verify email before seller access continues",
  },
  {
    mobile: "Start application",
    desktop: "Start a draft seller application",
  },
  {
    mobile: "Choose seller type",
    desktop: "Choose individual or registered business",
  },
  {
    mobile: "Add docs and payout",
    desktop: "Add documents and payout destination",
  },
  {
    mobile: "Submit for review",
    desktop: "Submit for admin review",
  },
  {
    mobile: "Track seller status",
    desktop: "Track status from the seller hub",
  },
  {
    mobile: "Create draft products",
    desktop: "Create draft products once provisional access is granted",
  },
];

const REQUIREMENTS = [
  "Verified email account before seller access",
  "Zambian phone contact and store identity details",
  "NRC document links for the seller owner",
  "PACRA details for registered businesses",
  "Payout destination details for future seller settlements",
];

const FAQS = [
  {
    question: "Can I start as an individual seller?",
    answer: "Yes. ZOGULAR supports both informal individual sellers and fully registered businesses in the same trust framework.",
  },
  {
    question: "Does seller approval make products live automatically?",
    answer: "No. Seller approval unlocks seller capabilities. Each product still goes through its own product review flow before it can go live.",
  },
  {
    question: "What happens after I submit the seller application?",
    answer: "You move into seller review. If approved as provisional, you can prepare draft products. Full product review submission opens only after APPROVED seller status.",
  },
];

export default function SellOnZogularPage() {
  const primaryHref = SELLER_REGISTER_PATH;
  const secondaryHref = SELLER_LOGIN_PATH;

  return (
    <main className="bg-[#06110a] text-white selection:bg-[#009E49] selection:text-white">
      <section className="relative overflow-hidden border-b border-white/10 bg-[radial-gradient(circle_at_top,rgba(0,158,73,0.28),transparent_36%),linear-gradient(135deg,#06110a_0%,#0a1710_46%,#08120c_100%)]">
        <div className="absolute inset-0 bg-[linear-gradient(120deg,rgba(255,255,255,0.08),transparent_28%,transparent_72%,rgba(255,255,255,0.03))]" />
        <div className="absolute left-[14%] top-16 h-44 w-44 rounded-full bg-[#00d663]/10 blur-[110px]" />
        <div className="absolute right-[10%] top-[12%] h-56 w-56 rounded-full bg-emerald-200/8 blur-[140px]" />

        <div className="relative mx-auto grid min-h-[calc(100vh-4rem)] max-w-7xl gap-8 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,1.02fr)_minmax(0,0.98fr)] lg:gap-10 lg:px-8 lg:py-10">
          <div className="relative z-10 flex min-h-[22rem] flex-col justify-between">
            <div>
              <div className="inline-flex items-center gap-2.5 rounded-full border border-white/12 bg-white/7 px-3.5 py-1.5 text-[10px] font-black uppercase tracking-[0.22em] text-[#8ee5b1] backdrop-blur-xl sm:px-4 sm:py-2 sm:text-[11px]">
                <BrandLogo mode="icon" imageClassName="h-5 w-5 rounded-full sm:h-6 sm:w-6" />
                Sell on ZOGULAR
              </div>

              <div className="relative mt-5 max-w-3xl">
                <div className="absolute -left-4 top-3 hidden h-20 w-20 rounded-full border border-white/10 bg-white/5 blur-[2px] lg:block" />
                <h1 className="relative text-[2.35rem] font-black leading-[0.9] tracking-[-0.055em] text-white sm:text-[3.35rem] lg:text-[4.35rem]">
                  Start selling with an auth-first trust flow built for Zambia.
                </h1>
              </div>

              <p className="mt-4 max-w-2xl text-[13px] font-medium leading-6 text-zinc-300 sm:text-[15px] sm:leading-7 lg:text-base">
                Join ZOGULAR through a proper seller onboarding path: create your account, verify identity, submit your seller application, then unlock the right seller capabilities as review moves forward.
              </p>
            </div>

            <div className="mt-7 flex flex-col gap-3 sm:max-w-xl sm:flex-row">
              <Link href={primaryHref} className="sm:flex-1">
                <Button className="group h-12 w-full rounded-[1.35rem] border border-emerald-300/20 bg-[linear-gradient(135deg,#00aa4d_0%,#08bb56_55%,#13d261_100%)] px-5 text-[12px] font-black uppercase tracking-[0.2em] text-white shadow-[0_18px_42px_rgba(0,158,73,0.3)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_24px_54px_rgba(0,158,73,0.38)] sm:h-13 sm:text-[13px]">
                  <span className="mr-2 h-2 w-2 rounded-full bg-white/85 shadow-[0_0_16px_rgba(255,255,255,0.8)] transition-transform duration-300 group-hover:scale-125" />
                  Create seller account
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                </Button>
              </Link>
              <Link href={secondaryHref} className="sm:flex-1">
                <Button className="group h-12 w-full rounded-[1.35rem] border border-white/12 bg-[linear-gradient(180deg,rgba(255,255,255,0.09),rgba(255,255,255,0.04))] px-5 text-[12px] font-black uppercase tracking-[0.2em] text-white backdrop-blur-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] transition-all duration-300 hover:-translate-y-0.5 hover:border-white/18 hover:bg-[linear-gradient(180deg,rgba(255,255,255,0.12),rgba(255,255,255,0.05))] sm:h-13 sm:text-[13px]">
                  <span className="mr-2 h-2 w-2 rounded-full border border-white/45 bg-white/15 transition-colors duration-300 group-hover:bg-white/8" />
                  Sign in to continue
                </Button>
              </Link>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3">
              <MetricCard value="Auth-first" label="Seller account creation flow" />
              <MetricCard value="2 tracks" label="Individual and business paths" />
              <MetricCard
                value="Status-led"
                label="Permissions after onboarding"
                className="col-span-2 sm:col-span-1"
              />
            </div>
          </div>

          <div className="relative isolate z-0">
            <div className="pointer-events-none absolute -inset-3 -z-10 rounded-[2.4rem] bg-[radial-gradient(circle_at_top,rgba(0,158,73,0.25),transparent_60%)] blur-2xl" />
            <div
              className="sell-tilt-shell relative isolate overflow-hidden rounded-[1.8rem] border border-white/12 bg-[linear-gradient(180deg,rgba(255,255,255,0.15),rgba(255,255,255,0.08))] p-4 shadow-[0_32px_90px_rgba(0,0,0,0.34)] backdrop-blur-2xl sm:p-5 lg:rotate-[0.65deg] lg:transition-transform lg:duration-300 lg:hover:rotate-0 lg:hover:-translate-y-1"
              style={{ transformStyle: "preserve-3d", perspective: "1800px" }}
            >
              <div className="pointer-events-none absolute inset-x-10 top-0 h-16 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.2),transparent_70%)] blur-2xl" />
              <div className="pointer-events-none absolute inset-x-0 top-0 h-36 overflow-hidden rounded-[1.6rem]">
                <div className="sell-aurora absolute left-5 top-4 h-24 w-24 rounded-full bg-[#00d663]/18 blur-3xl" />
                <div className="sell-aurora absolute right-6 top-6 h-20 w-20 rounded-full bg-white/12 blur-3xl [animation-delay:-2.6s]" />
                <div className="sell-aurora absolute left-1/2 top-2 h-16 w-28 -translate-x-1/2 rounded-full bg-emerald-200/14 blur-3xl [animation-delay:-4.2s]" />
              </div>
              <div className="relative mb-4 overflow-hidden rounded-[1.4rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.1),rgba(255,255,255,0.03))] px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] sm:px-4">
                <div
                  className="relative grid grid-cols-[1.08fr_0.92fr] gap-2"
                  style={{ transformStyle: "preserve-3d" }}
                >
                  <div className="sell-float-panel relative rounded-[1.15rem] border border-white/10 bg-[linear-gradient(160deg,rgba(255,255,255,0.16),rgba(255,255,255,0.05))] p-3 shadow-[0_18px_36px_rgba(0,0,0,0.2)]">
                    <div className="text-[9px] font-black uppercase tracking-[0.22em] text-[#97efba]">
                      Seller access
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <p className="text-[13px] font-black tracking-[-0.03em] text-white sm:text-[14px]">
                        Provisional opens draft workflow.
                      </p>
                      <div className="ml-3 h-9 w-9 rounded-2xl border border-white/10 bg-white/10" />
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <div className="sell-float-panel rounded-[1rem] border border-emerald-300/16 bg-[linear-gradient(180deg,rgba(0,158,73,0.2),rgba(0,158,73,0.06))] px-3 py-2.5 shadow-[0_16px_30px_rgba(0,0,0,0.16)] [animation-delay:-1.8s]">
                      <div className="text-[8px] font-black uppercase tracking-[0.2em] text-emerald-100/80">
                        Product drafts
                      </div>
                      <div className="mt-1 text-[11px] font-semibold text-white">
                        Enabled at provisional
                      </div>
                    </div>
                    <div className="sell-float-panel rounded-[1rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.15),rgba(255,255,255,0.05))] px-3 py-2.5 shadow-[0_16px_30px_rgba(0,0,0,0.16)] [animation-delay:-3.1s]">
                      <div className="text-[8px] font-black uppercase tracking-[0.2em] text-zinc-300">
                        Approved only
                      </div>
                      <div className="mt-1 text-[11px] font-semibold text-white">
                        Review submit, orders, payouts
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#8ee5b1] sm:text-[11px]">
                How it works
              </p>
              <div className="mt-4 grid gap-2.5 min-[360px]:grid-cols-2">
                {SELLER_FLOW.map((step, index) => (
                  <div
                    key={step.desktop}
                    className="group relative flex min-h-[5.3rem] items-start gap-2.5 overflow-hidden rounded-[1.15rem] border border-white/8 bg-[linear-gradient(180deg,rgba(0,0,0,0.12),rgba(255,255,255,0.03))] px-2.5 py-2.5 transition-all duration-300 hover:border-emerald-300/18 hover:bg-white/8 lg:hover:-translate-y-0.5 sm:min-h-24 sm:gap-3 sm:rounded-[1.25rem] sm:px-3.5 sm:py-3.5"
                  >
                    <div className="absolute right-0 top-0 h-16 w-16 rounded-full bg-white/5 blur-2xl transition-opacity duration-300 group-hover:opacity-80" />
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[1rem] border border-white/10 bg-white/11 text-[11px] font-black text-white shadow-inner sm:h-10 sm:w-10 sm:rounded-2xl sm:text-[13px]">
                      {(index + 1).toString().padStart(2, "0")}
                    </div>
                    <p className="pr-1 text-[10.5px] font-semibold leading-4.5 text-zinc-200 sm:text-[13px] sm:leading-5.5">
                      <span className="sm:hidden">{step.mobile}</span>
                      <span className="hidden sm:inline">{step.desktop}</span>
                    </p>
                  </div>
                ))}
              </div>
              <div className="mt-4 rounded-[1.2rem] border border-amber-300/16 bg-[linear-gradient(135deg,rgba(255,179,0,0.1),rgba(255,193,7,0.04))] px-3.5 py-2.5 text-[11px] font-medium leading-5 text-amber-100 sm:rounded-[1.35rem] sm:px-4 sm:py-3 sm:text-[13px] sm:leading-5.5">
                Seller approval and product approval are separate. Approved sellers still need product review before anything goes live.
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-12 lg:px-8">
        <div className="grid gap-3 lg:grid-cols-3">
          {HIGHLIGHTS.map((item) => {
            const Icon = item.icon;
            return (
              <article
                key={item.title}
                className="group rounded-[1.55rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.04))] p-5 shadow-[0_18px_40px_rgba(0,0,0,0.16)] backdrop-blur-xl transition-all duration-300 lg:hover:-translate-y-1 lg:hover:rotate-[0.35deg] lg:hover:border-emerald-300/18"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-[#009E49]/16 text-[#9cf2bf] transition-transform duration-300 group-hover:scale-105">
                  <Icon className="h-4.5 w-4.5" />
                </div>
                <h2 className="mt-4 text-lg font-black tracking-tight text-white sm:text-[1.2rem]">
                  {item.title}
                </h2>
                <p className="mt-2.5 text-[13px] font-medium leading-6 text-zinc-300">
                  {item.body}
                </p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="border-y border-white/10 bg-white/4">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 py-10 sm:px-6 sm:py-12 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:px-8">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#8ee5b1] sm:text-[11px]">
              Seller requirements
            </p>
            <h2 className="mt-3 max-w-xl text-[2.1rem] font-black leading-[0.95] tracking-[-0.045em] text-white sm:text-[2.7rem]">
              What you need before approval.
            </h2>
            <div className="mt-5 grid gap-2.5 min-[360px]:grid-cols-2">
              {REQUIREMENTS.map((item, index) => (
                <div
                  key={item}
                  className={`flex min-h-20 items-start gap-3 rounded-[1.25rem] border border-white/10 bg-black/14 px-3.5 py-3 ${
                    index === REQUIREMENTS.length - 1 ? "min-[360px]:col-span-2" : ""
                  }`}
                >
                  <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#8ee5b1] sm:h-4.5 sm:w-4.5" />
                  <p className="text-[11.5px] font-semibold leading-5 text-zinc-200 sm:text-[13px] sm:leading-5.5">
                    {item}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-2">
            <div className="sm:col-span-2 rounded-[1.6rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.14),rgba(255,255,255,0.07))] p-5 backdrop-blur-xl lg:hover:-translate-y-0.5 lg:hover:border-emerald-300/16 lg:transition-all">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/12 bg-white/10 text-[#8ee5b1]">
                <FileCheck2 className="h-4.5 w-4.5" />
              </div>
              <h3 className="mt-4 text-lg font-black tracking-tight text-white sm:text-[1.15rem]">
                Trust and safety by default
              </h3>
              <p className="mt-2.5 text-[13px] font-medium leading-6 text-zinc-300">
                ZOGULAR does not treat the `VENDOR` role as automatic selling permission. Seller capability opens only through application status, keeping the marketplace safer for buyers and more predictable for legitimate sellers.
              </p>
            </div>

            <TrustCard
              icon={PhoneCall}
              title="Identity checks"
              body="Email verification already sits in the flow, with room for stronger phone verification in later phases."
            />
            <TrustCard
              icon={Wallet}
              title="Payout readiness"
              body="Payout details are collected early so the trust review covers operational readiness too."
            />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-12 lg:px-8">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.12fr)_340px]">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#8ee5b1] sm:text-[11px]">
              FAQ
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-2">
              {FAQS.map((faq, index) => (
                <article
                  key={faq.question}
                  className={`rounded-[1.35rem] border border-white/10 bg-white/6 p-4 backdrop-blur-xl ${
                    index === 2 ? "sm:col-span-2" : ""
                  }`}
                >
                  <h3 className="text-[15px] font-black tracking-tight text-white sm:text-base">
                    {faq.question}
                  </h3>
                  <p className="mt-2.5 text-[12px] font-medium leading-5.5 text-zinc-300 sm:text-[13px]">
                    {faq.answer}
                  </p>
                </article>
              ))}
            </div>
          </div>

          <div className="relative overflow-hidden rounded-[1.9rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.14),rgba(255,255,255,0.08))] p-5 shadow-[0_24px_60px_rgba(0,0,0,0.22)] backdrop-blur-xl lg:translate-y-2 lg:transition-transform lg:hover:-translate-y-0.5">
            <div className="absolute right-0 top-0 h-28 w-28 rounded-full bg-[#00d663]/12 blur-3xl" />
            <p className="relative text-[10px] font-black uppercase tracking-[0.22em] text-[#8ee5b1] sm:text-[11px]">
              Ready to begin?
            </p>
            <h2 className="relative mt-3 text-[2rem] font-black leading-[0.95] tracking-[-0.045em] text-white sm:text-[2.2rem] lg:text-[2.4rem]">
              Start the seller flow the right way.
            </h2>
            <p className="relative mt-3 text-[13px] font-medium leading-6 text-zinc-300">
              Create your seller-ready account, complete the application, and move through review with the correct permissions at each stage.
            </p>

            <div className="relative mt-5 grid gap-3">
              <Link href={primaryHref}>
                <Button className="group h-12 w-full rounded-[1.25rem] border border-emerald-300/18 bg-[linear-gradient(135deg,#00aa4d_0%,#08bb56_55%,#13d261_100%)] px-5 text-[12px] font-black uppercase tracking-[0.22em] text-white shadow-[0_20px_46px_rgba(0,158,73,0.3)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_24px_54px_rgba(0,158,73,0.38)] sm:text-[13px]">
                  <span className="mr-2 h-2 w-2 rounded-full bg-white/90 shadow-[0_0_16px_rgba(255,255,255,0.72)] transition-transform duration-300 group-hover:scale-125" />
                  Create seller account
                  <ChevronRight className="ml-2 h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                </Button>
              </Link>
              <Link href={secondaryHref}>
                <Button className="group h-12 w-full rounded-[1.25rem] border border-white/14 bg-[linear-gradient(180deg,rgba(255,255,255,0.09),rgba(255,255,255,0.04))] text-[12px] font-black uppercase tracking-[0.22em] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] transition-all duration-300 hover:-translate-y-0.5 hover:bg-[linear-gradient(180deg,rgba(255,255,255,0.12),rgba(255,255,255,0.05))] sm:text-[13px]">
                  <span className="mr-2 h-2 w-2 rounded-full border border-white/40 bg-white/12" />
                  Sign in to seller access
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <style jsx>{`
        .sell-tilt-shell::after {
          content: "";
          position: absolute;
          inset: 1px;
          border-radius: 1.7rem;
          background: linear-gradient(135deg, rgba(255, 255, 255, 0.08), transparent 28%, transparent 72%, rgba(255, 255, 255, 0.05));
          opacity: 0.6;
          pointer-events: none;
        }

        .sell-float-panel {
          transform: translateZ(24px);
          animation: sell-float 8s ease-in-out infinite;
          will-change: transform;
        }

        .sell-aurora {
          animation: sell-aurora 10s ease-in-out infinite;
          will-change: transform, opacity;
        }

        @keyframes sell-float {
          0%,
          100% {
            transform: translate3d(0, 0, 24px) rotateX(0deg) rotateY(0deg);
          }
          50% {
            transform: translate3d(0, -6px, 36px) rotateX(2deg) rotateY(-2deg);
          }
        }

        @keyframes sell-aurora {
          0%,
          100% {
            transform: translate3d(0, 0, 0) scale(1);
            opacity: 0.75;
          }
          50% {
            transform: translate3d(0, 10px, 0) scale(1.08);
            opacity: 1;
          }
        }

        @media (hover: hover) {
          .sell-tilt-shell:hover .sell-float-panel {
            animation-duration: 5.8s;
          }
        }
      `}</style>
    </main>
  );
}

function MetricCard({
  value,
  label,
  className = "",
}: {
  value: string;
  label: string;
  className?: string;
}) {
  return (
    <div
      className={`relative isolate rounded-[1.1rem] border border-white/10 bg-white/6 px-3.5 py-3 backdrop-blur-xl sm:rounded-[1.25rem] sm:px-4 sm:py-3.5 ${className}`}
    >
      <p className="text-[15px] font-black tracking-[-0.03em] text-white sm:text-[17px]">
        {value}
      </p>
      <p className="mt-1 text-[9px] font-medium uppercase tracking-[0.15em] text-zinc-400 sm:text-[11px]">
        {label}
      </p>
    </div>
  );
}

function TrustCard({
  icon: Icon,
  title,
  body,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
}) {
  return (
    <article className="rounded-[1.35rem] border border-white/10 bg-white/6 p-4 backdrop-blur-xl lg:hover:-translate-y-0.5 lg:hover:border-emerald-300/16 lg:transition-all">
      <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/8 text-[#8ee5b1]">
        <Icon className="h-4.5 w-4.5" />
      </div>
      <h3 className="mt-3 text-[15px] font-black tracking-tight text-white sm:text-base">
        {title}
      </h3>
      <p className="mt-2 text-[12px] font-medium leading-5.5 text-zinc-300 sm:text-[13px]">
        {body}
      </p>
    </article>
  );
}
