import { ZogularInfoPage } from "@/components/consumer/ZogularInfoPage";
import { BRAND } from "@/config/brand";

export default function TermsPage() {
  return (
    <ZogularInfoPage
      title="Terms and Conditions"
      eyebrow="Platform rules"
      tone="policy"
      description={`These terms explain how buyers and sellers use Zogular, the marketplace by ${BRAND.businessName}.`}
      highlights={["Account responsibility", "Transparent checkout", "Fair platform conduct", "Seller and buyer safeguards"]}
      sections={[
        {
          title: "Account Responsibility",
          body: "Users are responsible for accurate account information and for securing their login credentials. Suspicious or abusive activity may result in account restrictions.",
        },
        {
          title: "Orders and Payments",
          body: "Review the items, seller, total price, delivery fees, and payment instructions before placing an order. You can correct mistakes or leave checkout before placing it. Contact support if the price, payment, or delivery details do not match what you agreed to.",
        },
        {
          title: "Consumer rights",
          body: "These terms and any seller conditions do not limit rights you have under Zambian law, including applicable rights to cancel an online transaction or obtain a remedy for faulty or misdescribed goods. The Returns Policy explains how to get help.",
        },
        {
          title: "Platform Conduct",
          body: "Fraud, counterfeit listings, abusive behavior, and attempts to bypass platform safeguards are prohibited and may lead to removal from Zogular.",
        },
      ]}
      steps={[
        {
          title: "Use accurate details",
          body: "Account, delivery, and seller information should be kept truthful and current.",
        },
        {
          title: "Respect checkout rules",
          body: "Orders, fees, delivery expectations, and return eligibility should be reviewed before confirmation.",
        },
        {
          title: "Keep conduct fair",
          body: "Buyers and sellers should avoid abuse, fraud, counterfeit activity, and attempts to bypass safeguards.",
        },
      ]}
      faqs={[
        {
          question: "Can Zogular restrict an account?",
          answer: "Yes. Accounts may be restricted when activity creates risk for shoppers, sellers, or the platform.",
        },
        {
          question: "Do seller policies still apply?",
          answer: "Seller terms can apply where they are consistent with your rights under Zambian law.",
        },
      ]}
      ctaLabel="Read Privacy Policy"
      ctaHref="/privacy"
      secondaryCtaLabel="Help Center"
      secondaryCtaHref="/help"
    />
  );
}
