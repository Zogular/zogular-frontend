import { ZogularInfoPage } from "@/components/consumer/ZogularInfoPage";

export default function CareersPage() {
  return (
    <ZogularInfoPage
      title="Careers at Zogular"
      eyebrow="Build with us"
      tone="company"
      description="We are growing a commerce platform that serves real shoppers and sellers in Zambia. If you care about quality product execution and local impact, we would love to hear from you."
      highlights={["Customer-first execution", "Platform operations", "Product quality", "Local impact"]}
      stats={[
        { value: "1", label: "Mission" },
        { value: "Fast", label: "Teams" },
        { value: "Local", label: "Impact" },
      ]}
      sections={[
        {
          title: "How We Work",
          body: "We ship fast, review quality rigorously, and stay close to customer behavior. Cross-functional collaboration and ownership are expected across engineering, design, operations, and support.",
        },
        {
          title: "Who We Need",
          body: "We are actively interested in product engineers, platform operations specialists, seller success managers, and logistics-focused customer support professionals.",
        },
        {
          title: "How to Apply",
          body: "Send your profile and role interest to careers@zogular.com with examples of impactful work. We prioritize candidates who are practical, customer-centric, and execution focused.",
        },
      ]}
      steps={[
        {
          title: "Show your work",
          body: "Send a short profile with examples that show product judgment, operational ownership, or customer impact.",
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
          question: "Are roles remote or local?",
          answer: "Role format depends on the team, but platform operations and support roles may require strong local context.",
        },
        {
          question: "What should applicants include?",
          answer: "Include the role you want, examples of work, and the kind of commerce problem you are excited to solve.",
        },
      ]}
      ctaLabel="Shop Zogular"
      ctaHref="/"
      secondaryCtaLabel="Seller Hub"
      secondaryCtaHref="/sell"
    />
  );
}
