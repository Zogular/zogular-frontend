import { ZogularInfoPage } from "@/components/consumer/ZogularInfoPage";

export default function ReturnsPage() {
  return (
    <ZogularInfoPage
      title="Returns Policy"
      eyebrow="After-purchase support"
      tone="support"
      description="Zogular reviews after-purchase issues fairly while keeping expectations clear for shoppers and sellers."
      highlights={["Issue-based review", "Original condition checks", "Clear review process", "Support-led resolution"]}
      stats={[
        { value: "Case", label: "Review" },
        { value: "Fair", label: "Review" },
        { value: "Clear", label: "Steps" },
      ]}
      sections={[
        {
          title: "Return Eligibility",
          body: "Returns are reviewed by issue type, item condition, and seller terms. Change-of-mind returns are not automatic.",
        },
        {
          title: "Non-Eligible Returns",
          body: "Products damaged by misuse, opened personal-care items, and explicitly non-returnable items may not qualify for return or refund.",
        },
        {
          title: "How to Start",
          body: "Open your order history when available, then contact support with clear details. Our team reviews each case and responds with next steps.",
        },
      ]}
      steps={[
        {
          title: "Check eligibility",
          body: "Review whether the issue, item condition, and seller terms support a return, replacement, or refund review.",
        },
        {
          title: "Submit details",
          body: "Use order history or support to explain the issue and include clear product information.",
        },
        {
          title: "Follow resolution",
          body: "Support reviews the case and shares the next action for return, replacement, or refund review.",
        },
      ]}
      faqs={[
        {
          question: "Are all products returnable?",
          answer: "No. Some products, issue types, used items, or explicitly non-returnable items may not qualify.",
        },
        {
          question: "Where should a shopper start?",
          answer: "The fastest path is order history. If that is not available, the Help Center can guide the request.",
        },
      ]}
      ctaLabel="Open Your Orders"
      ctaHref="/account/orders"
      secondaryCtaLabel="Help Center"
      secondaryCtaHref="/help"
    />
  );
}
