import type { CategoryAttributeOption } from "@/services/categories-api";
import type { CategoryFieldValue } from "../_components/CategorySpecificDetails";
import type { CategorySelection } from "./category-selection";

export type CategoryLoadStatus = "loading" | "success" | "error";

export function validateCategoryIntegrity(
  status: "draft" | "pending_review",
  selection: CategorySelection | null,
  attributesStatus: CategoryLoadStatus,
  requiredFieldsComplete: boolean,
) {
  if (status === "draft") return {};

  const errors: { category?: string; categoryDetails?: string } = {};
  if (!selection?.isBackendCategory || selection.isOther) {
    errors.category = "Confirm a final category from the category service before review.";
  }
  if (attributesStatus === "loading") {
    errors.categoryDetails = "Wait for category attributes to finish loading.";
  } else if (attributesStatus === "error") {
    errors.categoryDetails = "Category attributes are unavailable.";
  } else if (!requiredFieldsComplete) {
    errors.categoryDetails = "Complete the required category-specific fields.";
  }
  return errors;
}

export function reconcileCategoryFieldValues(
  values: readonly CategoryFieldValue[],
  nextAttributes: readonly CategoryAttributeOption[],
) {
  const retained: CategoryFieldValue[] = [];
  const movedToManual: CategoryFieldValue[] = [];

  for (const currentValue of values.filter((item) => item.value.trim())) {
    const matchingAttribute = nextAttributes.find(
      (attribute) => attribute.id === currentValue.attributeId || attribute.slug === currentValue.slug,
    );
    if (matchingAttribute) {
      retained.push({
        attributeId: matchingAttribute.id,
        slug: matchingAttribute.slug,
        name: matchingAttribute.name,
        value: currentValue.value,
      });
    } else {
      movedToManual.push(currentValue);
    }
  }

  return { retained, movedToManual };
}
