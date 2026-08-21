import { ZogularInfoPage } from "@/components/consumer/ZogularInfoPage";

export default function HelpPage() {
  return (
    <ZogularInfoPage
      title="Help Center"
      eyebrow="Customer support"
      tone="support"
      description="Need support with an order, payment, delivery, or seller issue? Zogular support is designed to keep resolution fast and straightforward."
      highlights={["Order tracking help", "Returns guidance", "Account access support", "Seller issue escalation"]}
      stats={[
        { value: "Fast", label: "Triage" },
        { value: "Clear", label: "Steps" },
        { value: "Local", label: "Context" },
      ]}
      sections={[
        {
          title: "Order Updates",
          body: "Sign in and open Your Orders for the most reliable order status and support options.",
        },
        {
          title: "Returns and Refunds",
          body: "If an item is damaged, incorrect, or not delivered as promised, start a return request quickly so we can review and assist.",
        },
        {
          title: "Account and Security",
          body: "For login and account access issues, use the password reset flow first. If access problems continue, contact support with your registered email.",
        },
      ]}
      steps={[
        {
          title: "Find the order",
          body: "Use your account order history so support can confirm the order belongs to you before reviewing the issue.",
        },
        {
          title: "Share the problem",
          body: "Describe whether it is about delivery, payment, returns, account access, or seller communication.",
        },
        {
          title: "Follow the next step",
          body: "Support will direct you to tracking, return review, account recovery, or seller escalation.",
        },
      ]}
      faqs={[
        {
          question: "What is the fastest way to check an order?",
          answer: "Sign in and open Your Orders. Support can review the order from there if you need help.",
        },
        {
          question: "Where do returns start?",
          answer: "Start from your order history when possible. The returns policy explains eligibility and review expectations.",
        },
      ]}
      ctaLabel="Open Your Orders"
      ctaHref="/account/orders"
      secondaryCtaLabel="Returns Policy"
      secondaryCtaHref="/returns"
    />
  );
}
