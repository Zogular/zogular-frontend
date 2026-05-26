import { ZogularInfoPage } from "@/components/consumer/ZogularInfoPage";

export default function ReturnsPage() {
  return (
    <ZogularInfoPage
      title="Returns Policy"
      eyebrow="After-purchase support"
      tone="support"
      description="Zogular supports fair returns so shoppers can buy with confidence while keeping expectations clear for sellers."
      highlights={["7-day eligible return window", "Original condition checks", "Clear review process", "Support-led resolution"]}
      stats={[
        { value: "7d", label: "Window" },
        { value: "Fair", label: "Review" },
        { value: "Clear", label: "Steps" },
      ]}
      sections={[
        {
          title: "Return Window",
          body: "Most eligible items can be returned within 7 days from delivery, provided they are in original condition and include all accessories.",
        },
        {
          title: "Non-Eligible Returns",
          body: "Products damaged by misuse, opened personal-care items, and explicitly non-returnable items may not qualify for return or refund.",
        },
        {
          title: "How to Start",
          body: "Open your order history, select the order, and submit a return request with clear details. Our team reviews each case and responds with next steps.",
        },
      ]}
      steps={[
        {
          title: "Check eligibility",
          body: "Review whether the item is within the return window and still in return-ready condition.",
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
          answer: "No. Some personal-care, damaged, used, or explicitly non-returnable items may not qualify.",
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
