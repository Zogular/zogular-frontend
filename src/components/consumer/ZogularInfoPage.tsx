import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  CircleHelp,
  Compass,
  FileCheck2,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

type InfoSection = {
  title: string;
  body: string;
};

type InfoStep = {
  title: string;
  body: string;
};

type InfoFaq = {
  question: string;
  answer: string;
};

type InfoStat = {
  label: string;
  value: string;
};

type InfoPageTone = "marketplace" | "support" | "policy" | "company";

type ZogularInfoPageProps = {
  title: string;
  description: string;
  sections: InfoSection[];
  eyebrow?: string;
  tone?: InfoPageTone;
  highlights?: string[];
  stats?: InfoStat[];
  steps?: InfoStep[];
  faqs?: InfoFaq[];
  ctaLabel?: string;
  ctaHref?: string;
  secondaryCtaLabel?: string;
  secondaryCtaHref?: string;
};

const toneStyles: Record<InfoPageTone, string> = {
  marketplace: "from-[#009E49]/18 via-white/78 to-[#FF6B00]/14",
  support: "from-[#009E49]/14 via-white/80 to-sky-500/12",
  policy: "from-zinc-950/10 via-white/80 to-[#009E49]/14",
  company: "from-[#FF6B00]/14 via-white/80 to-[#009E49]/16",
};

const toneAccent: Record<InfoPageTone, string> = {
  marketplace: "text-[#009E49] bg-[#009E49]/10",
  support: "text-sky-700 bg-sky-500/10",
  policy: "text-zinc-800 bg-zinc-900/10",
  company: "text-[#FF6B00] bg-[#FF6B00]/10",
};

export function ZogularInfoPage({
  title,
  description,
  sections,
  eyebrow = "Zogular guide",
  tone = "marketplace",
  highlights = [],
  stats = [],
  steps = [],
  faqs = [],
  ctaLabel,
  ctaHref,
  secondaryCtaLabel,
  secondaryCtaHref,
}: ZogularInfoPageProps) {
  const featureList = highlights.length > 0 ? highlights : sections.map((section) => section.title);

  return (
    <main className="min-h-screen overflow-hidden bg-[#f4fbf6] pb-24 text-zinc-950">
      <section className={cn("relative border-b border-white/70 bg-linear-to-br", toneStyles[tone])}>
        <div className="absolute inset-x-0 top-0 h-24 bg-white/58 backdrop-blur-3xl" />
        <div className="absolute right-0 top-16 hidden h-72 w-72 rounded-full border border-white/60 bg-white/22 blur-3xl lg:block" />
        <div className="container relative mx-auto max-w-7xl px-4 py-10 md:px-6 md:py-16">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1.12fr)_25rem] lg:items-end">
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/75 bg-white/66 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.18em] text-[#009E49] shadow-sm backdrop-blur-xl">
                <Sparkles className="h-3.5 w-3.5" />
                {eyebrow}
              </div>
              <h1 className="mt-5 max-w-4xl text-4xl font-black leading-[0.98] text-zinc-950 md:text-6xl">
                {title}
              </h1>
              <p className="mt-5 max-w-3xl text-sm font-medium leading-7 text-zinc-600 md:text-base">
                {description}
              </p>

              {ctaHref && ctaLabel ? (
                <div className="mt-7 flex flex-wrap gap-3">
                  <Link
                    href={ctaHref}
                    className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-xl bg-zinc-950 px-5 text-sm font-bold text-white shadow-[0_14px_30px_rgba(15,23,42,0.16)] transition-all hover:-translate-y-0.5 hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#009E49] focus-visible:ring-offset-2 active:translate-y-0.5"
                  >
                    {ctaLabel}
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                  {secondaryCtaHref && secondaryCtaLabel ? (
                    <Link
                      href={secondaryCtaHref}
                      className="inline-flex h-11 cursor-pointer items-center rounded-xl border border-white/75 bg-white/66 px-5 text-sm font-bold text-zinc-800 backdrop-blur-xl transition-all hover:-translate-y-0.5 hover:bg-white/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6B00] focus-visible:ring-offset-2 active:translate-y-0.5"
                    >
                      {secondaryCtaLabel}
                    </Link>
                  ) : null}
                </div>
              ) : null}
            </div>

            <aside className="animate-in fade-in slide-in-from-bottom-3 rounded-[28px] border border-white/75 bg-white/60 p-4 shadow-[0_24px_58px_rgba(15,23,42,0.1)] backdrop-blur-2xl duration-700">
              <div className="overflow-hidden rounded-2xl border border-white/70 bg-zinc-950 p-5 text-white shadow-inner">
                <div className="flex items-start justify-between gap-4">
                  <ShieldCheck className="h-6 w-6 shrink-0 text-[#00c95d]" />
                  <span className="rounded-full border border-white/10 bg-white/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-zinc-300">
                    Verified
                  </span>
                </div>
                <p className="mt-4 text-lg font-black leading-tight">Built for trust, speed, and local context.</p>
                <p className="mt-2 text-sm leading-6 text-zinc-300">
                  Clear policies, practical support, and a platform experience shaped around Zambian shoppers and sellers.
                </p>
                <div className="mt-5 grid grid-cols-3 gap-2">
                  {["Trust", "Speed", "Local"].map((item) => (
                    <div key={item} className="rounded-xl border border-white/10 bg-white/10 px-2 py-2 text-center">
                      <p className="text-[10px] font-black uppercase tracking-[0.12em] text-zinc-300">{item}</p>
                    </div>
                  ))}
                </div>
              </div>
              {stats.length > 0 ? (
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {stats.map((stat) => (
                    <div key={stat.label} className="rounded-2xl border border-white/70 bg-white/66 p-3 text-center backdrop-blur-xl transition-all hover:-translate-y-0.5 hover:bg-white/85">
                      <p className="text-lg font-black text-zinc-950">{stat.value}</p>
                      <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-500">{stat.label}</p>
                    </div>
                  ))}
                </div>
              ) : null}
            </aside>
          </div>
        </div>
      </section>

      <section className="container mx-auto max-w-7xl px-4 py-10 md:px-6 md:py-14">
        <div className="grid gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
          <aside className="space-y-3 lg:sticky lg:top-28 lg:self-start">
            <div className="rounded-[26px] border border-white/75 bg-white/72 p-4 shadow-[0_16px_42px_rgba(15,23,42,0.06)] backdrop-blur-xl">
              <div className={cn("mb-4 flex h-11 w-11 items-center justify-center rounded-2xl", toneAccent[tone])}>
                <Compass className="h-5 w-5" />
              </div>
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-zinc-500">At a glance</p>
              <p className="mt-2 text-sm font-semibold leading-6 text-zinc-800">
                The key points before you get into the details.
              </p>
            </div>

            {featureList.slice(0, 5).map((item) => (
              <div key={item} className="flex items-start gap-3 rounded-2xl border border-white/70 bg-white/72 p-4 shadow-[0_10px_28px_rgba(15,23,42,0.05)] backdrop-blur-xl transition-all hover:-translate-y-0.5 hover:bg-white/90">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#009E49]" />
                <p className="text-sm font-bold leading-5 text-zinc-800">{item}</p>
              </div>
            ))}
          </aside>

          <div className="grid gap-4 md:grid-cols-2">
            {sections.map((section, index) => (
              <section
                key={section.title}
                className={cn(
                  "group rounded-[26px] border border-white/75 bg-white/80 p-5 shadow-[0_16px_44px_rgba(15,23,42,0.06)] backdrop-blur-xl transition-all hover:-translate-y-0.5 hover:bg-white/95 hover:shadow-[0_22px_56px_rgba(15,23,42,0.09)]",
                  index === 0 && "md:col-span-2",
                )}
              >
                <div className={cn("mb-4 flex h-11 w-11 items-center justify-center rounded-2xl transition-colors group-hover:bg-[#009E49] group-hover:text-white", toneAccent[tone])}>
                  <span className="text-sm font-black">{String(index + 1).padStart(2, "0")}</span>
                </div>
                <h2 className="text-lg font-black text-zinc-950">{section.title}</h2>
                <p className="mt-3 text-sm leading-7 text-zinc-600">{section.body}</p>
              </section>
            ))}

            {steps.length > 0 ? (
              <section className="rounded-[26px] border border-white/75 bg-zinc-950 p-5 text-white shadow-[0_22px_56px_rgba(15,23,42,0.12)] md:col-span-2">
                <div className="mb-5 flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 text-[#00c95d]">
                    <FileCheck2 className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#00c95d]">Next steps</p>
                    <h2 className="text-xl font-black">How this usually works</h2>
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  {steps.map((step, index) => (
                    <div key={step.title} className="rounded-2xl border border-white/10 bg-white/10 p-4">
                      <span className="text-xs font-black text-[#00c95d]">{String(index + 1).padStart(2, "0")}</span>
                      <h3 className="mt-3 text-sm font-black">{step.title}</h3>
                      <p className="mt-2 text-xs leading-6 text-zinc-300">{step.body}</p>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            {faqs.length > 0 ? (
              <section className="grid gap-3 md:col-span-2 md:grid-cols-2">
                {faqs.map((faq) => (
                  <div key={faq.question} className="rounded-[22px] border border-white/75 bg-white/78 p-5 shadow-[0_14px_34px_rgba(15,23,42,0.05)] backdrop-blur-xl">
                    <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-[#FF6B00]/10 text-[#FF6B00]">
                      <CircleHelp className="h-4 w-4" />
                    </div>
                    <h3 className="text-sm font-black text-zinc-950">{faq.question}</h3>
                    <p className="mt-2 text-sm leading-6 text-zinc-600">{faq.answer}</p>
                  </div>
                ))}
              </section>
            ) : null}

            <div className="rounded-[26px] border border-[#009E49]/12 bg-[linear-gradient(135deg,rgba(0,158,73,0.1),rgba(255,255,255,0.82),rgba(255,107,0,0.1))] p-5 shadow-[0_18px_48px_rgba(15,23,42,0.07)] backdrop-blur-xl md:col-span-2">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#009E49]">Need a hand?</p>
                  <p className="mt-2 text-xl font-black text-zinc-950">Zogular support keeps the next step clear.</p>
                </div>
                <Link
                  href="/help"
                  className="inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#009E49] px-5 text-sm font-bold text-white shadow-[0_14px_28px_rgba(0,158,73,0.18)] transition-all hover:-translate-y-0.5 hover:bg-[#00853d] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#009E49] focus-visible:ring-offset-2 active:translate-y-0.5"
                >
                  Open Help Center
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
