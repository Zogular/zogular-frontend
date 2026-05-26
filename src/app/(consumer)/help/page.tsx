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
          title: "Order Tracking",
          body: "Use your order ID and purchase email to check your delivery timeline, movement updates, and estimated arrival date.",
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
          body: "Use your order ID, account order history, or purchase email so support can locate the issue quickly.",
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
          question: "What is the fastest way to track delivery?",
          answer: "Use the order ID and purchase email on the tracking page, or open the order from your account history.",
        },
        {
          question: "Where do returns start?",
          answer: "Start from your order history when possible. The returns policy explains eligibility and review expectations.",
        },
      ]}
      ctaLabel="Track an Order"
      ctaHref="/track"
      secondaryCtaLabel="Returns Policy"
      secondaryCtaHref="/returns"
    />
  );
}
