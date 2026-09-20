/**
 * @file types.ts
 * @module features/admin-categories
 * @description
 * Type contracts for admin category management and product-field configuration.
 * Defines category records, hierarchy tree nodes, custom/inherited attribute configurations,
 * multi-dimensional variation options, and mutation payloads.
 */

export type CategoryAttributeType = "TEXT" | "NUMBER" | "SELECT";

/**
 * Detailed configuration for custom category attributes.
 * Serialized into `CategoryAttribute.options` JSON column in backend.
 */
export type AttributeOptionConfig = {
  /**
   * Predefined choices for dropdown selection (e.g. ["Black", "Silver", "Gold"])
   */
  choices?: string[];
  /**
   * Primary measurement or representation unit (e.g. "W", "kVA", "GB", "inch")
   */
  unit?: string;
  /**
   * Allowed alternate units selectable by seller (e.g. ["W", "kW", "MW"])
   */
  allowedUnits?: string[];
  /**
   * When true, this field can define product variation choices.
   */
  isVariation?: boolean;
  /**
   * When true, this field can be offered as a buyer filter.
   */
  isFilterable?: boolean;
  /**
   * When true, this field can be highlighted as a quick choice where supported.
   */
  isSlicer?: boolean;
  /**
   * Contextual guidance presented to sellers on the product creation form.
   */
  sellerGuidance?: string;
  /**
   * Visual input placeholder for sellers (e.g. "e.g. 5000")
   */
  placeholder?: string;
};

/**
 * Represents a category attribute record, supporting both direct custom attributes
 * and inherited attributes from ancestor categories.
 */
export type CategoryAttributeRecord = {
  id: string;
  categoryId: string;
  name: string;
  slug: string;
  type: CategoryAttributeType;
  options: AttributeOptionConfig | null;
  isRequired: boolean;
  sortOrder: number;
  isInherited?: boolean;
  inheritedFromCategory?: {
    id: string;
    name: string;
  };
  createdAt?: string;
  updatedAt?: string;
};

/**
 * Unified response contract for category attribute queries.
 */
export type CategoryAttributesResponse = {
  directAttributes: CategoryAttributeRecord[];
  inheritedAttributes: CategoryAttributeRecord[];
  allAttributes: CategoryAttributeRecord[];
};

/**
 * Payload for creating a new custom category attribute.
 */
export type CreateCategoryAttributePayload = {
  name: string;
  slug?: string;
  type: CategoryAttributeType;
  options?: AttributeOptionConfig | null;
  isRequired?: boolean;
  sortOrder?: number;
};

/**
 * Payload for updating an existing category attribute.
 */
export type UpdateCategoryAttributePayload = Partial<CreateCategoryAttributePayload>;

/**
 * Category record in the administrative catalog.
 */
export type AdminCategoryRecord = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  parentId: string | null;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  _count: {
    children: number;
    products: number;
    attributes: number;
  };
};

/**
 * Hierarchical tree node for recursive taxonomy rendering.
 */
export type AdminCategoryTreeNode = AdminCategoryRecord & {
  children: AdminCategoryTreeNode[];
};

/**
 * Payload for creating or updating a category in the taxonomy.
 */
export type AdminCategoryPayload = {
  name: string;
  slug?: string;
  description?: string;
  icon?: string;
  parentId?: string | null;
  isActive?: boolean;
  sortOrder?: number;
  reason?: string;
};

/**
 * Industry Template descriptor for standard product attribute presets.
 */
/**
 * Server-issued category template. The backend owns its definitions and the
 * frontend deliberately keeps no parallel industry catalog.
 */
export type CategoryTemplateDefinition = {
  templateKey: string;
  title: string;
  description: string;
  attributes: CreateCategoryAttributePayload[];
};

/** The exact non-optimistic outcome returned by the template application API. */
export type CategoryTemplateApplyOutcome = {
  templateKey: string;
  requestedAttributeSlugs: string[];
  createdAttributes: CategoryAttributeRecord[];
  updatedAttributes: CategoryAttributeRecord[];
  unchangedAttributes: CategoryAttributeRecord[];
};
