import { ZogularInfoPage } from "@/components/consumer/ZogularInfoPage";
import { BRAND } from "@/config/brand";

export default function HelpPage() {
  return (
    <ZogularInfoPage
      title="Help Center"
      eyebrow="Customer support"
      tone="support"
      description="Get help with an order, delivery, cancellation, account access, or a privacy request."
      highlights={["Order tracking help", "Returns guidance", "Account access support", "Seller issue escalation"]}
      sections={[
        {
          title: "Order Updates",
          body: "Sign in and open Your Orders for the most reliable order status and support options.",
        },
        {
          title: "Returns and Refunds",
          body: "Contact support with your order number if you want to cancel an eligible purchase or report damaged, missing, or incorrect goods. See the Returns Policy for applicable rights and timelines.",
        },
        {
          title: "Account and Security",
          body: "For login problems, start with password reset. If you still need help or want to make a privacy request, contact support. Never share your password, one-time codes, or payment PIN.",
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
          question: "How do I pay for my order?",
          answer: "Check the breakdown at checkout. For Cash on Delivery orders, the product balance is paid at handoff. If a delivery fee is due before dispatch, checkout shows it separately.",
        },
        {
          question: "Where does Zogular deliver?",
          answer: "Delivery currently focuses on Lusaka. Enter your address at checkout to see whether delivery is available and what it costs before placing your order.",
        },
        {
          question: "What is the fastest way to check an order?",
          answer: "Sign in and open Your Orders. Support can review the order from there if you need help.",
        },
        {
          question: "Where do returns start?",
          answer: "Start from your order history when possible. The returns policy explains eligibility and review expectations.",
        },
        {
          question: "What if my order is late, missing, or incorrect?",
          answer: "Check Your Orders for the latest status. If the issue continues, contact support with your order number and explain what happened.",
        },
        {
          question: "How can I correct or request a copy of my information?",
          answer: "You can update some details from your account. For an access, correction, or deletion request, contact support and explain what you need. See the Privacy Policy for more about your rights.",
        },
      ]}
      ctaLabel={BRAND.supportEmail ? "Email Support" : "Open Your Orders"}
      ctaHref={BRAND.supportEmail ? `mailto:${BRAND.supportEmail}` : "/account/orders"}
      secondaryCtaLabel="Returns Policy"
      secondaryCtaHref="/returns"
    />
  );
}
