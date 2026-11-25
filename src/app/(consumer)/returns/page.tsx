import { ZogularInfoPage } from "@/components/consumer/ZogularInfoPage";

export default function ReturnsPage() {
  return (
    <ZogularInfoPage
      title="Returns Policy"
      eyebrow="After-purchase support"
      tone="support"
      description="How to request a return, cancel an eligible online purchase, or report a problem with an order."
      sections={[
        {
          title: "Cooling-off period",
          body: "For online goods covered by Zambia's Electronic Communications and Transactions Act, you can cancel without giving a reason within seven days after receiving them. There is no cancellation penalty; the only charge allowed under this rule is the direct cost of returning the goods. If you already paid, the supplier must issue a full refund within 30 days of cancellation.",
        },
        {
          title: "Exceptions and faulty items",
          body: "The cooling-off right has legal exceptions, which can include personalised or quickly perishable goods. Those exceptions do not take away your separate rights if goods are faulty, unsafe, or not as described. Depending on the issue and applicable law, the supplier may need to repair, replace, or refund the item.",
        },
        {
          title: "How to Start",
          body: "Contact support with your order number, the items involved, and whether you are cancelling or reporting a problem. We can help identify the supplier and the next steps. Seller policies do not override your rights under Zambian law.",
        },
      ]}
      steps={[
        {
          title: "Check eligibility",
          body: "Check whether you are cancelling an eligible purchase or reporting an issue with what you received.",
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
          answer: "Not all goods qualify for change-of-mind cancellation. A seller's return restriction does not remove any remedy the law gives you for faulty or misdescribed goods.",
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
