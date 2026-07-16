"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CircleHelp, Mail, Package, ReceiptText, ShieldCheck, Store, Truck } from "lucide-react";
import { BrandLogo } from "@/components/brand/BrandLogo";

// --- DATA ARRAYS ---
const COMPANY_LINKS = [
  { label: "About Zogular", href: "/about" },
  { label: "Careers", href: "/careers" },
  { label: "Become a Seller", href: "/sell" }, // Fixed route
  { label: "Terms & Conditions", href: "/terms" },
];

const SUPPORT_LINKS = [
  { label: "Help Center", href: "/help" },
  { label: "Track Order", href: "/track-order" },
  { label: "Returns Policy", href: "/returns" },
  { label: "Privacy Policy", href: "/privacy" },
];

const CATEGORY_LINKS = [
  { label: "Phones & Tablets", href: "/category/phones-and-tablets" },
  { label: "Computing", href: "/category/computing" },
  { label: "Fashion", href: "/category/fashion" },
  { label: "Supermarket", href: "/category/supermarket" },
];

const FOOTER_ACTION_LINKS = [
  { label: "Seller", href: "/sell", icon: Store },
  { label: "Track", href: "/track-order", icon: Package },
  { label: "Help", href: "/help", icon: CircleHelp },
];

// --- MAIN EXPORT ---
export function Footer() {
  const pathname = usePathname();

  const hiddenRoutes = ["/auth", "/seller"];
  if (hiddenRoutes.some((route) => pathname?.startsWith(route))) {
    return null;
  }

  return (
    <footer className="relative border-t border-zinc-900 bg-zinc-900 pt-10 pb-6 text-zinc-300">

      <div className="container mx-auto max-w-7xl px-4 md:px-6">
        
        {/* Main Footer Grid - Tightened gaps and margins */}
        <div className="mb-10 grid grid-cols-1 gap-8 md:grid-cols-2 md:gap-8 lg:grid-cols-5">
          
          {/* Brand & App Download */}
          <div className="space-y-4 lg:col-span-2">
            <BrandLogo href="/" variant="dark" imageClassName="h-10 w-auto md:h-12" className="focus-visible:ring-offset-zinc-900" />
            <p className="text-xs md:text-sm text-zinc-400 max-w-sm leading-relaxed">
              Zambia&apos;s online marketplace for buyer-visible listings during the Lusaka pilot.
            </p>
            
            <div className="flex flex-wrap gap-2 pt-1">
              {FOOTER_ACTION_LINKS.map(({ label, href, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 text-xs font-bold text-zinc-300 transition-all hover:-translate-y-0.5 hover:border-[#009E49]/40 hover:bg-[#009E49]/12 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#009E49] focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900 active:translate-y-0"
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </Link>
              ))}
            </div>
          </div>

          {/* Links Wrapped in a 2-column grid for mobile */}
          <div className="grid grid-cols-2 gap-6 lg:col-span-2 lg:flex lg:gap-16">
            {/* Quick Links */}
            <div className="space-y-3">
              <h4 className="text-white font-bold tracking-wide text-sm">Company</h4>
              <ul className="space-y-2 text-xs md:text-sm">
                {COMPANY_LINKS.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className="rounded-sm transition-colors hover:text-[#FF6B00] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6B00] focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div className="space-y-4">
              <h4 className="text-zinc-100 font-bold tracking-wide text-[13px] uppercase">Support</h4>
              <ul className="space-y-2.5 text-sm">
                {SUPPORT_LINKS.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className="rounded-sm transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#009E49] focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900">{link.label}</Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Categories */}
            <div className="space-y-3">
              <h4 className="text-white font-bold tracking-wide text-sm">Categories</h4>
              <ul className="space-y-2 text-xs md:text-sm">
                {CATEGORY_LINKS.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className="rounded-sm transition-colors hover:text-[#FF6B00] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6B00] focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Contact fallback */}
          <div className="space-y-3 lg:col-span-1">
            <h4 className="text-sm font-bold tracking-wide text-white">Need Help?</h4>
            <p className="text-[11px] leading-5 text-zinc-400 md:text-xs">Newsletter signup is not live yet. Contact support for marketplace help.</p>
            <a href="mailto:support@zogular.com" className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900 px-4 text-xs font-bold text-white hover:border-zinc-700 hover:bg-zinc-800">
              <Mail className="h-3.5 w-3.5" /> Email support
            </a>
          </div>
          
        </div>

        {/* Bottom Bar: Copyright & Payments */}
        <div className="flex flex-col md:flex-row items-center justify-between pt-6 border-t border-zinc-900 gap-4">
          <p className="text-[10px] md:text-xs text-zinc-500">
            &copy; {new Date().getFullYear()} Zogular. All rights reserved.
          </p>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 text-[10px] md:text-xs font-semibold text-zinc-400 bg-zinc-900 px-2 py-1 md:px-3 md:py-1.5 rounded-lg">
              <ShieldCheck className="h-3.5 w-3.5 text-[#009E49]" /> Backend-quoted COD
            </div>
            
            <div className="flex items-center gap-2 text-zinc-500">
              <span title="Cash on Delivery">
                <ReceiptText className="h-4 w-4 md:h-5 md:w-5 hover:text-white transition-colors" />
              </span>
              <span title="Manual delivery dispatch">
                <Truck className="h-4 w-4 md:h-5 md:w-5 hover:text-white transition-colors" />
              </span>
            </div>
          </div>
        </div>

      </div>
    </footer>
  );
}
