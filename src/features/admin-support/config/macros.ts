/**
 * @file macros.ts
 * @module features/admin-support/config/macros
 * @description
 * Curated operational canned responses tailored specifically for the Zambian
 * marketplace context (MoMo settlements, Lusaka 3PL courier handoffs, PACRA/NRC KYC,
 * product quality guidelines, and catalog restitution).
 */

import type { AdminTicketCategory, AdminTicketStatus } from "../types";

export interface SupportMacro {
  id: string;
  title: string;
  category: AdminTicketCategory;
  suggestedStatus?: AdminTicketStatus;
  templateText: string;
}

export const SUPPORT_MACROS: SupportMacro[] = [
  {
    id: "payout-cycle-settlement",
    title: "Payout Cycle: Tuesday/Friday Settlement & MoMo Verification",
    category: "payout",
    suggestedStatus: "waiting-seller",
    templateText: `Hello {{seller_name}},

Automated merchant settlements on Zogular are executed bi-weekly on Tuesday and Friday mornings at 10:00 CAT via Mobile Money (Airtel Money, MTN MoMo) and Zynle/Bank transfers.

Please keep in mind:
1. Orders qualify for payout exactly 24 hours after confirmed customer delivery to accommodate any initial inspection claims.
2. Ensure your registered mobile money account is fully KYC-verified with your telecommunications provider and that the registered name matches your Zogular seller account.
3. If your settlement does not reflect in your mobile wallet within 2 hours of the scheduled payout run, please reply with your registered phone number, network provider, and recent delivery IDs so our finance desk can manually expedite reconciliation.

Warm regards,
Zogular Merchant Operations Desk`,
  },
  {
    id: "lusaka-delivery-handoff",
    title: "Lusaka Delivery: 3PL Courier Handoff, Manifest & COD",
    category: "order",
    suggestedStatus: "waiting-seller",
    templateText: `Hello {{seller_name}},

Thank you for reaching out regarding fulfillment and courier dispatch in Lusaka.

Here is the operational checklist for seamless delivery dispatch:
1. Dispatch Manifest: Download and print the courier packing slip from your Seller Studio. Fasten it securely to the outside of the parcel.
2. Rider Arrival Window: Authorized 3PL couriers arrive for pickup within 24 hours of you moving the order status to "Processing / Ready for Dispatch".
3. Cash on Delivery (COD) Collection: For COD orders, the courier collects the exact Zambian Kwacha amount upon physical handoff to the customer. All collected funds are systematically reconciled to your Zogular escrow balance within 6 hours of successful delivery.

If the courier has not contacted you within 24 hours of dispatch readiness, reply here with your pickup location details and package readiness confirmation.

Best regards,
Zogular Logistics Support`,
  },
  {
    id: "product-moderation-guidelines",
    title: "Product Moderation: Image Standards & ZMW Pricing Rules",
    category: "inventory",
    suggestedStatus: "waiting-seller",
    templateText: `Hello {{seller_name}},

To ensure your listings convert effectively and comply with Zogular marketplace quality guidelines, please review the requirements below:

1. Imagery: High-resolution photos (minimum 1080x1080 px) on a clean, solid white or neutral studio background. No watermarks, phone numbers, or promotional text overlaid on the primary image.
2. Currency & Pricing: All prices must be quoted in Zambian Kwacha (ZMW) and inclusive of statutory taxes. Ensure realistic retail pricing to prevent automated pricing safeguards.
3. Title & Specifications: The product title must clearly state the brand, model, and primary specification (e.g., "Samsung Galaxy A54 5G - 128GB Awesome Black - Dual SIM").

Please update your product draft in Seller Studio to reflect these specifications and click "Submit for Moderation".

Warm regards,
Zogular Catalog Quality Team`,
  },
  {
    id: "rejected-product-appeal",
    title: "Product Moderation: Re-Review & Appeal Instructions",
    category: "inventory",
    suggestedStatus: "waiting-seller",
    templateText: `Hello {{seller_name}},

We understand your concern regarding the declination of your product listing. 

To appeal the rejection and request a speedy re-review:
1. In your Seller Studio, navigate to Catalog > Products and filter by "Rejected".
2. Open the rejected product and read the compliance notes left by the moderation officer.
3. Modify the flagged attributes (e.g. replace photos with white-background images, correct category classification, or adjust description).
4. Click "Save & Request Re-Review".

Our catalog review team re-assesses amended products within 4 to 8 business hours. If you feel the rejection was made in error, reply to this ticket with your supplier authenticity documentation or brand authorization letter.

Sincerely,
Zogular Moderation Support`,
  },
  {
    id: "kyc-pacra-document-request",
    title: "KYC Compliance: PACRA Registration & NRC Verification",
    category: "account",
    suggestedStatus: "waiting-seller",
    templateText: `Hello {{seller_name}},

In accordance with Bank of Zambia compliance standards and Zogular Merchant Verification requirements, we require official documentation before enabling store payout settlements.

Please reply to this ticket or upload in Seller Studio (Settings > Verification) clear, legible copies of:
1. Business Entity: PACRA Certificate of Incorporation / Business Name Registration, plus your ZRA TPIN Certificate.
2. Sole Proprietor: National Registration Card (NRC - both front and back clearly visible) or a valid Zambian Passport.
3. Proof of Settlement Ownership: A recent mobile money account statement or bank confirmation letter bearing the same registered name.

Once submitted, our compliance compliance desk reviews and unlocks your payout gateway within 1 business day.

Warm regards,
Zogular Merchant Trust & Safety`,
  },
  {
    id: "order-cancellation-restitution",
    title: "Order Cancellation: Stock Replenishment & Restitution",
    category: "order",
    suggestedStatus: "resolved",
    templateText: `Hello {{seller_name}},

This is to confirm that Order {{order_id}} has been cancelled in our central fulfillment system.

Restitution Summary:
1. Inventory Release: Any stock reserved for this order has been immediately returned to your active marketplace catalog inventory.
2. Buyer Restitution: If the buyer prepaid via Mobile Money or Card, their refund has been automatically routed back to their payment provider.
3. Zero Fees: No commission or transaction charges have been deducted from your merchant account for this transaction.

Your store inventory count is now synchronized. If you have any additional questions regarding this order, please let us know.

Best regards,
Zogular Fulfillment Team`,
  },
  {
    id: "general-resolution-closure",
    title: "Resolution Confirmation: Issue Resolved & Merchant Sign-off",
    category: "general",
    suggestedStatus: "resolved",
    templateText: `Hello {{seller_name}},

We are pleased to inform you that the issue reported in this ticket has been successfully investigated and resolved.

Please review your Seller Studio dashboard to confirm that everything is operating as expected. If you need any further assistance with this matter, simply reply directly to this message and your ticket will automatically reopen.

Thank you for being a valued merchant partner on Zogular!

Warm regards,
Zogular Merchant Support`,
  },
];
