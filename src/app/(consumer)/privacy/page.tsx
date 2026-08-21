import { ZogularInfoPage } from "@/components/consumer/ZogularInfoPage";

export default function PrivacyPage() {
  return (
    <ZogularInfoPage
      title="Privacy Policy"
      eyebrow="Data and trust"
      tone="policy"
      description="Zogular handles customer and seller data to operate the platform safely, process transactions, and improve platform reliability."
      highlights={["Purposeful data use", "Order and delivery support", "Fraud prevention", "Account update control"]}
      stats={[
        { value: "Less", label: "Noise" },
        { value: "More", label: "Control" },
        { value: "Safe", label: "Data" },
      ]}
      sections={[
        {
          title: "What We Collect",
          body: "We collect account details, order history, and fulfillment data needed to provide platform services, delivery support, and customer communication.",
        },
        {
          title: "How We Use Data",
          body: "Your data helps us process orders, prevent fraud, improve product discovery, and support sellers with operational insights.",
        },
        {
          title: "Your Control",
          body: "You can request account data updates through account settings or support channels. Payment and delivery records are used only to support platform operations.",
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
          question: "Does Zogular process payments directly?",
          answer: "Zogular uses payment-related data only to support orders, account help, and platform operations.",
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
