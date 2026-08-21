import { ZogularInfoPage } from "@/components/consumer/ZogularInfoPage";
import { BRAND } from "@/config/brand";

export default function CareersPage() {
  const careersEmail = BRAND.careersEmail;
  const sections = [
    {
      title: "How We Work",
      body: "We build carefully, review quality rigorously, and stay close to customer behavior. Strong ownership matters across engineering, design, operations, and support.",
    },
    {
      title: "Future Opportunities",
      body: "Zogular may need product, operations, seller success, and customer support talent as the marketplace grows. Open roles will be shared when hiring is active.",
    },
    careersEmail
      ? {
          title: "General Interest",
          body: `Send your profile and area of interest to ${careersEmail}. Include examples of practical work, customer impact, or marketplace operations experience.`,
        }
      : {
          title: "General Interest",
          body: "We are not listing open roles right now. Check this page later for hiring updates as Zogular grows.",
        },
  ];

  return (
    <ZogularInfoPage
      title="Careers at Zogular"
      eyebrow="Build with us"
      tone="company"
      description="Zogular is building a commerce platform for real shoppers and sellers in Zambia. Hiring updates will appear here when roles are available."
      highlights={["Customer-first execution", "Platform operations", "Product quality", "Local impact"]}
      stats={[
        { value: "1", label: "Mission" },
        { value: "Future", label: "Roles" },
        { value: "Local", label: "Impact" },
      ]}
      sections={sections}
      steps={[
        {
          title: "Check updates",
          body: "Open opportunities will be listed here when Zogular is hiring.",
        },
        {
          title: "Meet the mission",
          body: "We look for people who can connect practical execution with the realities of Zambian commerce.",
        },
        {
          title: "Build responsibly",
          body: "Strong candidates care about clean systems, useful interfaces, and support that feels human.",
        },
      ]}
      faqs={[
        {
          question: "Is Zogular hiring right now?",
          answer: careersEmail
            ? "General interest messages are accepted through the configured careers contact, but specific openings are shared only when available."
            : "There are no public openings listed right now. This page will be updated when hiring is active.",
        },
        {
          question: "Where will open roles appear?",
          answer: "Open roles and application details will be shown on this page when they are available.",
        },
      ]}
      ctaLabel={careersEmail ? "Send General Interest" : undefined}
      ctaHref={careersEmail ? `mailto:${careersEmail}` : undefined}
      secondaryCtaLabel="Seller Hub"
      secondaryCtaHref="/sell"
    />
  );
}
