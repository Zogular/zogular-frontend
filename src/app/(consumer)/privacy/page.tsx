import { ZogularInfoPage } from "@/components/consumer/ZogularInfoPage";
import { BRAND } from "@/config/brand";

import { publicMetadata, type SearchProps } from "@/lib/seo/public-search";

export async function generateMetadata({ searchParams }: SearchProps) {
  return publicMetadata("/privacy", "Privacy Policy", "Read how Zogular handles buyer and seller information and how to raise a privacy concern.", await searchParams);
}

export default function PrivacyPage() {
  return (
    <ZogularInfoPage
      title="Privacy Policy"
      eyebrow="Data and trust"
      tone="policy"
      description={`This notice explains how Zogular, the marketplace by ${BRAND.businessName}, handles buyer and seller information and how you can raise a privacy concern.`}
      sections={[
        {
          title: "What We Collect",
          body: "This includes account and contact details, orders and delivery addresses, information you share with support, and seller application information where you apply to sell.",
        },
        {
          title: "How We Use Data",
          body: "We use this information to manage accounts, review seller applications, fulfill orders, provide support, and protect against fraud and misuse. The site uses cookies and browser storage for sign-in and shopping features.",
        },
        {
          title: "Your privacy rights",
          body: "You can contact support to request access to your personal information or ask us to correct or erase it. These rights are subject to applicable legal limits. You can also lodge a privacy complaint with Zambia's Data Protection Commissioner.",
        },
      ]}
      steps={[
        {
          title: "Collect what is needed",
          body: "Core account, order, and delivery information supports the platform experience.",
        },
        {
          title: "Use it with purpose",
          body: "Data helps process orders, protect accounts, improve discovery, and support seller operations.",
        },
        {
          title: "Keep support reachable",
          body: "Customers can contact support when profile details or account data need review.",
        },
      ]}
      faqs={[
        {
          question: "How do I make a privacy request?",
          answer: "Use the Help Center to contact support and explain your request. Do not send your password, verification codes, or bank PIN.",
        },
        {
          question: "Can account details be updated?",
          answer: "Yes. Shoppers can use account settings or support channels when information needs to be corrected.",
        },
      ]}
      ctaLabel="Contact Support"
      ctaHref="/help"
      secondaryCtaLabel="Terms"
      secondaryCtaHref="/terms"
    />
  );
}
