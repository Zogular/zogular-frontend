import { type CategoryAttributeOption } from "@/services/categories-api";
import { slugifySellerValue } from "@/services/seller-catalog";
import { type CategorySelection } from "./category-selection";

export type CategoryDetailFieldType = "text" | "number" | "select" | "date" | "textarea";

export type CategoryDetailField = {
  id: string;
  attributeId: string;
  slug: string;
  label: string;
  type: CategoryDetailFieldType;
  placeholder?: string;
  options?: string[];
  required?: boolean;
  source: "backend" | "phase-1" | "manual";
};

export type CategoryDetailGroup = {
  id: string;
  title: string;
  description: string;
  reviewNote?: string;
  fields: CategoryDetailField[];
};

const SMARTPHONE_DETAILS: CategoryDetailGroup = {
  id: "smartphones",
  title: "Phone Details",
  description: "Capture the phone specs buyers compare first.",
  fields: [
    phaseOneField({ id: "ram", label: "RAM", type: "select", options: ["2GB", "3GB", "4GB", "6GB", "8GB", "12GB", "16GB+"], required: true }),
    phaseOneField({ id: "storage", label: "Storage", type: "select", options: ["32GB", "64GB", "128GB", "256GB", "512GB", "1TB"], required: true }),
    phaseOneField({ id: "battery-capacity", label: "Battery Capacity", type: "number", placeholder: "e.g. 5000" }),
    phaseOneField({ id: "screen-size", label: "Screen Size", type: "text", placeholder: "e.g. 6.7 inch" }),
    phaseOneField({ id: "warranty", label: "Warranty", type: "select", options: ["No warranty", "7 days", "30 days", "6 months", "12 months"] }),
    phaseOneField({ id: "imei-serial", label: "IMEI / Serial Optional", type: "text", placeholder: "Optional internal reference" }),
  ],
};

const FOOTWEAR_DETAILS: CategoryDetailGroup = {
  id: "footwear",
  title: "Shoe Details",
  description: "Show the fit, style, and variants shoppers need before checkout.",
  fields: [
    phaseOneField({ id: "shoe-size", label: "Size", type: "text", placeholder: "e.g. EU 42 / UK 8", required: true }),
    phaseOneField({ id: "color", label: "Color", type: "text", placeholder: "e.g. Black, White" }),
    phaseOneField({ id: "gender", label: "Gender", type: "select", options: ["Men", "Women", "Unisex", "Kids"] }),
    phaseOneField({ id: "material", label: "Material", type: "text", placeholder: "e.g. Leather, knit, canvas" }),
    phaseOneField({ id: "brand", label: "Brand", type: "text", placeholder: "e.g. Nike" }),
    phaseOneField({ id: "variant-colors", label: "Variant Colors", type: "text", placeholder: "Comma separated colors" }),
  ],
};

const BEAUTY_DETAILS: CategoryDetailGroup = {
  id: "beauty-personal-care",
  title: "Beauty / Personal Care Details",
  description: "Add safety, suitability, and usage details for personal care products.",
  fields: [
    phaseOneField({ id: "volume", label: "Volume / Size", type: "text", placeholder: "e.g. 250ml, 50g", required: true }),
    phaseOneField({ id: "skin-type", label: "Skin Type", type: "select", options: ["All skin types", "Dry", "Oily", "Combination", "Sensitive"] }),
    phaseOneField({ id: "ingredients", label: "Ingredients", type: "textarea", placeholder: "List key ingredients" }),
    phaseOneField({ id: "expiry-date", label: "Expiry Date", type: "date" }),
    phaseOneField({ id: "usage-notes", label: "Usage Notes", type: "textarea", placeholder: "How should the buyer use it?" }),
  ],
};

const GENERIC_DETAILS: CategoryDetailGroup = {
  id: "generic",
  title: "Category Details",
  description: "Add the details that matter for this product type.",
  fields: [
    phaseOneField({ id: "brand-model", label: "Brand / Model", type: "text", placeholder: "e.g. Samsung Galaxy A55" }),
    phaseOneField({ id: "key-feature", label: "Key Feature", type: "text", placeholder: "e.g. Waterproof, wireless, handmade" }),
    phaseOneField({ id: "material-or-spec", label: "Material / Specification", type: "text", placeholder: "e.g. Cotton, stainless steel, 220V" }),
  ],
};

const OTHER_DETAILS: CategoryDetailGroup = {
  id: "other",
  title: "Manual Category Review Details",
  description: "Use this simpler form when the exact category is missing.",
  reviewNote: "Admin will manually review this listing and match it to the best category before approval.",
  fields: [
    manualField({ id: "closest-category", label: "Closest Category", type: "text", placeholder: "What category did you expect?" }),
    manualField({ id: "product-type", label: "Product Type", type: "text", placeholder: "e.g. Phone case, office chair, face cream", required: true }),
    manualField({ id: "important-details", label: "Important Details", type: "textarea", placeholder: "Anything admin should know while reviewing?" }),
  ],
};

const CATEGORY_FIELD_GROUPS = [SMARTPHONE_DETAILS, FOOTWEAR_DETAILS, BEAUTY_DETAILS, GENERIC_DETAILS, OTHER_DETAILS];

export function getCategoryDetailGroup(selection: CategorySelection): CategoryDetailGroup {
  if (selection.isOther) return OTHER_DETAILS;
  const matchKey = `${selection.categoryName} ${selection.subcategoryName} ${selection.leafName} ${selection.leafSlug}`.toLowerCase();

  if (matchKey.includes("smartphone") || matchKey.includes("phone")) return SMARTPHONE_DETAILS;
  if (matchKey.includes("footwear") || matchKey.includes("shoe")) return FOOTWEAR_DETAILS;
  if (matchKey.includes("beauty") || matchKey.includes("personal care") || matchKey.includes("skin")) return BEAUTY_DETAILS;

  return GENERIC_DETAILS;
}

export function categoryAttributesToDetailGroup(attributes: CategoryAttributeOption[], fallback: CategoryDetailGroup): CategoryDetailGroup {
  if (!attributes.length) return fallback;

  return {
    id: fallback.id,
    title: fallback.title,
    description: fallback.description,
    fields: attributes.map((attribute) => {
      const slug = attribute.slug || slugifySellerValue(attribute.name);
      return {
      id: attribute.id,
      attributeId: attribute.id,
      slug,
      label: attribute.name,
      type: attribute.type,
      options: attribute.options ?? undefined,
      required: attribute.isRequired,
      source: "backend",
    };
    }),
  };
}

export function getCategoryDetailGroupById(groupId: string): CategoryDetailGroup {
  return CATEGORY_FIELD_GROUPS.find((group) => group.id === groupId) ?? GENERIC_DETAILS;
}

function phaseOneField(field: Omit<CategoryDetailField, "attributeId" | "slug" | "source">): CategoryDetailField {
  return {
    ...field,
    attributeId: field.id,
    slug: field.id,
    source: "phase-1",
  };
}

function manualField(field: Omit<CategoryDetailField, "attributeId" | "slug" | "source">): CategoryDetailField {
  return {
    ...field,
    attributeId: field.id,
    slug: field.id,
    source: "manual",
  };
}
