"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Barcode, Box, Building2, CheckCircle2, ChevronDown, ChevronUp, DollarSign, Info, ListPlus, Palette, Percent, PlusCircle, Settings2, ShieldAlert, Sparkles, Trash2, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fetchCategoryAttributes, fetchCategoryTree, type CategoryAttributeOption, type CategoryNode } from "@/services/categories-api";
import { Toaster, toast } from "sonner";
import { createSellerCatalogProduct, type CreateSellerProductInput, type ProductCondition, type SellerProductListing, type SellerProductStatus } from "@/services/seller-catalog";
import { CategoryDrawer } from "./CategoryDrawer";
import { CategorySpecificDetails, type CategoryFieldValue } from "./CategorySpecificDetails";
import { ListingReadiness, type ListingReadinessItem } from "./ListingReadiness";
import { ProductEssentialsSection } from "./ProductEssentialsSection";
import { ProductImagesSection } from "./ProductImagesSection";
import { fieldError, GlassSection, inputErrorClass, InputField, ProductListingMobileActions, ProductListingStudioHeader, ToggleSwitch } from "./ProductListingStudioPrimitives";
import { useProductImages } from "../_hooks/useProductImages";
import { categoryAttributesToDetailGroup, getCategoryDetailGroup, type CategoryDetailField } from "../_lib/category-detail-fields";
import { buildSelectionFromLegacy, flattenCategoryNodes, makeCategorySelection, type CategorySelection, type PickerSelection } from "../_lib/category-selection";
import {
  buildSku,
  buildVariants,
  getDefaultWeight,
  MAX_IMAGES,
  splitVariantValues,
  withoutRecordKey,
} from "../_lib/product-listing-studio";

type ProductStatus = Extract<SellerProductStatus, "draft" | "pending_review">;
type ValidationErrors = Record<string, string>;

type ProductListingStudioMode = "create" | "edit";

type ProductListingStudioFormProps = {
  backHref?: string;
  initialProduct?: SellerProductListing;
  mode: ProductListingStudioMode;
  onPersist?: (payload: CreateSellerProductInput, status: ProductStatus) => Promise<void>;
  onStatusChange?: (status: ProductStatus) => Promise<void>;
  canSubmitForReview?: boolean;
  submitLabel?: string;
};

function splitStoredDimensions(value?: string) {
  const parts = value?.split("x").map((item) => item.trim()) ?? [];
  return {
    l: parts[0] ?? "",
    w: parts[1] ?? "",
    h: parts[2] ?? "",
  };
}

function variantOptionsFromProduct(product?: SellerProductListing) {
  if (!product?.variants.length || (product.variants.length === 1 && product.variants[0]?.value === "Default")) {
    return { colors: "", sizes: "" };
  }

  const colorValues = product.variants.filter((variant) => variant.label === "Color").map((variant) => variant.value);
  const sizeValues = product.variants.filter((variant) => variant.label === "Size").map((variant) => variant.value);

  return {
    colors: colorValues.join(", "),
    sizes: sizeValues.join(", "),
  };
}

export function ProductListingStudioForm({
  backHref = "/seller/products",
  initialProduct,
  mode,
  onPersist,
  onStatusChange,
  canSubmitForReview = true,
  submitLabel = "Submit for Review",
}: ProductListingStudioFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<ValidationErrors>({});

  const isEditMode = mode === "edit";
  const initialCategory = initialProduct ? buildSelectionFromLegacy(initialProduct.categoryName, initialProduct.subcategoryName) : null;
  const initialVariantOptions = variantOptionsFromProduct(initialProduct);
  const initialDimensions = splitStoredDimensions(initialProduct?.logistics.dimensions);

  const [productName, setProductName] = useState(initialProduct?.title ?? "");
  const [brand, setBrand] = useState(initialProduct?.brand ?? "");
  const [condition, setCondition] = useState<ProductCondition>(initialProduct?.condition ?? "new");
  const [description, setDescription] = useState(initialProduct?.description ?? "");
  const {
    ensureImagesUploaded,
    fileInputRef,
    handleImageSelection,
    imageWarnings,
    images,
    removeImage,
    retryImageUpload,
    setImageVariant,
    setPrimaryImage,
  } = useProductImages(initialProduct?.images ?? []);

  const [price, setPrice] = useState(initialProduct ? String(initialProduct.price) : "");
  const [salePrice, setSalePrice] = useState(initialProduct?.salePrice ? String(initialProduct.salePrice) : "");
  const [stock, setStock] = useState(initialProduct ? String(initialProduct.stock) : "");
  const [sku, setSku] = useState(initialProduct?.sku ?? "");
  const [lowStockThreshold, setLowStockThreshold] = useState(initialProduct ? String(initialProduct.lowStockThreshold) : "5");

  const [categoryTree, setCategoryTree] = useState<CategoryNode[]>([]);
  const [categorySearch, setCategorySearch] = useState("");
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);
  const [browsePath, setBrowsePath] = useState<CategoryNode[]>([]);
  const [pickerSelection, setPickerSelection] = useState<PickerSelection | null>(null);
  const [submittedCategory, setSubmittedCategory] = useState<CategorySelection | null>(initialCategory);
  const [categoryAttributes, setCategoryAttributes] = useState<CategoryAttributeOption[]>([]);
  const [isLoadingCategoryAttributes, setIsLoadingCategoryAttributes] = useState(false);

  const [deliveryType, setDeliveryType] = useState(initialProduct?.deliveryType ?? "standard");
  const [packageWeight, setPackageWeight] = useState(initialProduct ? String(initialProduct.logistics.weightKG) : "");

  const [hasDiscount, setHasDiscount] = useState(Boolean(initialProduct?.salePrice));
  const [hasVariants, setHasVariants] = useState(Boolean(initialVariantOptions.colors || initialVariantOptions.sizes));
  const [showAdvanced, setShowAdvanced] = useState(isEditMode);

  const [specs, setSpecs] = useState(initialProduct?.specifications.length ? initialProduct.specifications : [{ name: "", value: "" }]);
  const [categoryFieldValues, setCategoryFieldValues] = useState<CategoryFieldValue[]>(initialProduct?.attributes ?? []);
  const [variantOptions, setVariantOptions] = useState(initialVariantOptions);
  const [seo, setSeo] = useState({ title: initialProduct?.seo.metaTitle ?? "", description: initialProduct?.seo.metaDescription ?? "" });
  const [dimensions, setDimensions] = useState(initialDimensions);

  const selectedSubcategory = submittedCategory?.subcategoryName ?? "";
  const revealDetails = Boolean(submittedCategory);
  const fallbackCategoryDetailGroup = useMemo(
    () => submittedCategory ? getCategoryDetailGroup(submittedCategory) : null,
    [submittedCategory],
  );
  const categoryDetailGroup = useMemo(() => {
    if (!fallbackCategoryDetailGroup) return null;
    return categoryAttributesToDetailGroup(categoryAttributes, fallbackCategoryDetailGroup);
  }, [categoryAttributes, fallbackCategoryDetailGroup]);
  const requiredCategoryFieldsComplete = useMemo(() => {
    if (isLoadingCategoryAttributes) return false;
    if (!categoryDetailGroup) return false;
    const requiredFields = categoryDetailGroup.fields.filter((field) => field.required);
    if (!requiredFields.length) return true;
    return requiredFields.every((field) => categoryFieldValues.some((item) => item.attributeId === field.attributeId && item.value.trim()));
  }, [categoryDetailGroup, categoryFieldValues, isLoadingCategoryAttributes]);
  const currentLevel = browsePath.length ? browsePath[browsePath.length - 1].children ?? [] : categoryTree;
  const flatCategoryNodes = useMemo(() => flattenCategoryNodes(categoryTree), [categoryTree]);
  const searchResults = useMemo(() => {
    const query = categorySearch.trim().toLowerCase();
    if (!query) return [];
    return flatCategoryNodes.filter(({ path }) => path.some((node) => node.name.toLowerCase().includes(query))).slice(0, 12);
  }, [categorySearch, flatCategoryNodes]);
  const selectedPickerCategory = pickerSelection ? makeCategorySelection(pickerSelection) : null;
  const canSubmitCategory = Boolean(
    pickerSelection &&
      (pickerSelection.isOther
        ? pickerSelection.path.length > 0
        : !pickerSelection.path[pickerSelection.path.length - 1].children?.length),
  );
  const variantValues = useMemo(
    () => (hasVariants ? splitVariantValues(variantOptions.colors || variantOptions.sizes) : []),
    [hasVariants, variantOptions.colors, variantOptions.sizes],
  );
  const readiness = useMemo<ListingReadinessItem[]>(
    () => [
      { label: "Images added", done: images.length > 0, detail: `${images.length}/${MAX_IMAGES}` },
      { label: "Name added", done: Boolean(productName.trim()), detail: productName.trim() ? "Ready" : "Pending" },
      { label: "Category selected", done: Boolean(submittedCategory), detail: submittedCategory?.leafName ?? "Pending" },
      { label: "Details completed", done: Boolean(description.trim() && price && stock && requiredCategoryFieldsComplete), detail: isLoadingCategoryAttributes ? "Loading" : revealDetails ? "In progress" : "Locked" },
      { label: "Ready for review", done: Boolean(images.length && productName.trim() && submittedCategory && price && stock && description.trim() && requiredCategoryFieldsComplete), detail: "Final check" },
    ],
    [description, images.length, isLoadingCategoryAttributes, price, productName, requiredCategoryFieldsComplete, revealDetails, stock, submittedCategory],
  );

  useEffect(() => {
    let isMounted = true;
    fetchCategoryTree().then((categories) => {
      if (isMounted) setCategoryTree(categories);
    });
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!submittedCategory) {
      setCategoryAttributes([]);
      setIsLoadingCategoryAttributes(false);
      return;
    }

    setCategoryAttributes([]);

    if (submittedCategory.isOther || !submittedCategory.isBackendCategory) {
      setIsLoadingCategoryAttributes(false);
      return;
    }

    let isCurrent = true;
    setIsLoadingCategoryAttributes(true);
    fetchCategoryAttributes(submittedCategory.leafSlug)
      .then((attributes) => {
        if (isCurrent) setCategoryAttributes(attributes);
      })
      .finally(() => {
        if (isCurrent) setIsLoadingCategoryAttributes(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [submittedCategory]);

  const addSpec = () => setSpecs((current) => [...current, { name: "", value: "" }]);
  const removeSpec = (index: number) => setSpecs((current) => current.filter((_, i) => i !== index));
  const updateSpec = (index: number, field: "name" | "value", value: string) => {
    setSpecs((current) => {
      return current.map((spec, specIndex) => {
        if (specIndex !== index) return spec;
        if (field === "name") return { ...spec, name: value };
        return { ...spec, value };
      });
    });
  };

  const updateCategoryFieldValue = (field: CategoryDetailField, value: string) => {
    setCategoryFieldValues((current) => {
      const existing = current.find((item) => item.attributeId === field.attributeId);
      const nextValue = {
        attributeId: field.attributeId,
        slug: field.slug,
        name: field.label,
        value,
      };
      if (!existing) return [...current, nextValue];
      return current.map((item) => item.attributeId === field.attributeId ? nextValue : item);
    });
    setErrors((current) => withoutRecordKey(current, "categoryDetails"));
  };

  const validateForm = (status: ProductStatus) => {
    const nextErrors: ValidationErrors = {};

    if (status === "pending_review") {
      if (!images.length) nextErrors.images = "Add at least one product image before review.";
      if (images.some((image) => image.processedWidth !== image.processedHeight)) nextErrors.images = "Product images must be processed into square listing images.";
      if (!productName.trim()) nextErrors.productName = "Product name required.";
      if (!submittedCategory) nextErrors.category = "Submit a final category first.";
      if (!description.trim()) nextErrors.description = "Description required before submission.";
      if (isLoadingCategoryAttributes) nextErrors.categoryDetails = "Wait for category attributes to finish loading.";
      else if (!requiredCategoryFieldsComplete) nextErrors.categoryDetails = "Complete the required category-specific fields.";
      if (!price || Number(price) <= 0) nextErrors.price = "Valid price required.";
      if (!stock || Number(stock) < 0) nextErrors.stock = "Valid stock required.";
      if (hasVariants && !variantOptions.colors.trim() && !variantOptions.sizes.trim()) nextErrors.variants = "Add at least one color or size.";
    }

    if (status === "draft") {
      if (!productName.trim() && !images.length && !submittedCategory) nextErrors.productName = "Add a name, image, or category before saving a draft.";
      if (price && Number(price) <= 0) nextErrors.price = "Price must be greater than zero.";
      if (stock && Number(stock) < 0) nextErrors.stock = "Stock cannot be negative.";
    }

    if (Number(lowStockThreshold) < 0) nextErrors.lowStockThreshold = "Valid threshold required.";
    if (hasDiscount) {
      if (!salePrice || Number(salePrice) <= 0) nextErrors.salePrice = "Valid sale price required.";
      else if (Number(price || 0) > 0 && Number(salePrice) >= Number(price)) nextErrors.salePrice = "Must be lower than regular price.";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSave = async (e: React.FormEvent | React.MouseEvent, status: ProductStatus) => {
    e.preventDefault();
    if (status === "pending_review" && !canSubmitForReview) {
      toast.error("Seller approval is required before products can be submitted for review.");
      return;
    }
    if (!validateForm(status)) {
      toast.error("Please fix the highlighted fields.");
      return;
    }

    setIsSubmitting(true);

    try {
      const uploadedImages = await ensureImagesUploaded();

      const durableImages = uploadedImages.filter(
        (image) => !image.url.startsWith("blob:"),
      );

      if (images.length > 0 && durableImages.length !== images.length) {
        throw new Error("Only uploaded Cloudinary images can be saved to this product.");
      }

      const category = submittedCategory ?? buildSelectionFromLegacy("Computing", "Laptops");
      const finalSKU = sku.trim() || buildSku(category.subcategoryName, productName || "Draft product");
      const finalWeight = packageWeight ? Number(packageWeight) : getDefaultWeight(category.subcategoryName);
      const normalizedStock = stock ? Number(stock) : 0;
      const normalizedPrice = price ? Number(price) : 0;
      const moderationFlags = category.isOther ? ["category_other_selected", `category_path:${category.path.join(" > ")}`] : [];
      const payloadStatus: SellerProductStatus = isEditMode && initialProduct && status === "draft" ? initialProduct.status : status;

      const categorySpecifications = categoryFieldValues
        .filter((item) => item.value.trim())
        .map((item) => ({ name: item.name, value: item.value.trim() }));
      const categoryAttributePayload = categoryFieldValues
        .filter((item) => item.value.trim())
        .map((item) => ({
          attributeId: item.attributeId,
          slug: item.slug,
          name: item.name,
          value: item.value.trim(),
        }));

      const payload: CreateSellerProductInput = {
        title: productName.trim() || "Untitled draft product",
        brand: brand.trim(),
        condition,
        description: description.trim(),
        categoryName: category.categoryName,
        categorySlug: category.categorySlug,
        subcategoryName: category.subcategoryName,
        subcategorySlug: category.subcategorySlug,
        status: payloadStatus,
        price: normalizedPrice,
        salePrice: hasDiscount ? Number(salePrice) : null,
        stock: normalizedStock,
        lowStockThreshold: Number(lowStockThreshold),
        sku: finalSKU,
        images: durableImages,
        deliveryType: deliveryType as "standard" | "express",
        logistics: {
          weightKG: finalWeight,
          dimensions: showAdvanced && dimensions.l ? `${dimensions.l}x${dimensions.w}x${dimensions.h}` : "Standard Box",
        },
        variants: buildVariants(hasVariants, variantOptions, finalSKU, normalizedStock),
        attributes: categoryAttributePayload,
        specifications: [
          ...categorySpecifications,
          ...specs.filter((s) => s.name.trim() && s.value.trim()),
        ],
        seo: {
          metaTitle: seo.title.trim() || `${productName.trim() || "Zogular product"} | Zogular`,
          metaDescription: seo.description.trim() || `Buy ${productName.trim() || "this product"} in Zambia on Zogular.`,
        },
        moderation: moderationFlags.length
          ? {
              submittedAt: null,
              reviewedAt: null,
              reviewedBy: null,
              moderationNotes: null,
              moderationFlags,
              riskScore: null,
              duplicateWarnings: [],
              categorySuggestions: [category.path.join(" > ")],
              imageSafetyWarnings: [],
            }
          : undefined,
      };

      if (onPersist) {
        await onPersist(payload, status);
      } else {
        await createSellerCatalogProduct(payload);
      }
      if (onStatusChange && status === "pending_review") await onStatusChange(status);
      toast.success(
        isEditMode
          ? status === "draft"
            ? "Product changes saved."
            : "Product updated and submitted for review."
          : status === "draft"
            ? "Draft saved successfully!"
            : "Product submitted for review!",
        {
        description: isEditMode
          ? status === "draft"
            ? "Your listing updates are stored in the seller catalog."
            : "Your edited product is waiting for admin moderation."
          : status === "draft"
            ? "Your draft is ready for editing later."
            : "Your product is waiting for admin moderation.",
        icon: <CheckCircle2 className="h-4 w-4 text-[#009E49]" />,
        style: { borderRadius: "14px", border: "1px solid #e4e7ec" },
      });
      router.push(isEditMode && initialProduct ? `/seller/products/${initialProduct.id}` : "/seller/products");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save product");
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitCategory = () => {
    if (!canSubmitCategory || !pickerSelection) return;
    const selection = makeCategorySelection(pickerSelection);
    if (!selection) return;
    setSubmittedCategory(selection);
    setCategoryFieldValues([]);
    setErrors((current) => withoutRecordKey(current, "category"));
    setIsCategoryOpen(false);
  };

  const selectBrowseNode = (node: CategoryNode) => {
    const path = [...browsePath, node];
    setPickerSelection({ path, isOther: false });
    if (node.children?.length) setBrowsePath(path);
  };

  const chooseSearchResult = (path: CategoryNode[]) => {
    setBrowsePath(path.slice(0, -1));
    setPickerSelection({ path, isOther: false });
    setCategorySearch("");
  };

  return (
    <div className="mx-auto max-w-6xl animate-in fade-in pb-56 duration-500 md:pb-12">
      <Toaster position="top-center" />

      <form noValidate onSubmit={(e) => handleSave(e, "pending_review")}>
        <ProductListingStudioHeader
          backHref={backHref}
          isEditMode={isEditMode}
          isSubmitting={isSubmitting}
          revealDetails={revealDetails}
          onSave={handleSave}
          canSubmitForReview={canSubmitForReview}
          submitLabel={submitLabel}
        />

        <div className="mb-5">
          <ListingReadiness items={readiness} variant="mobile" />
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-5">
            <ProductImagesSection
              error={errors.images}
              fileInputRef={fileInputRef}
              imageWarnings={imageWarnings}
              images={images}
              onImageSelection={handleImageSelection}
              onRemoveImage={removeImage}
              onRetryImageUpload={retryImageUpload}
              onSetImageVariant={setImageVariant}
              onSetPrimaryImage={setPrimaryImage}
              variantValues={variantValues}
            />

            <ProductEssentialsSection
              categoryError={errors.category}
              nameError={errors.productName}
              onOpenCategory={() => setIsCategoryOpen(true)}
              onProductNameChange={setProductName}
              productName={productName}
              submittedCategory={submittedCategory}
            />

            {revealDetails ? (
              <>
                <GlassSection title="Description" subtitle="Give shoppers enough detail to buy with confidence." icon={<ListPlus className="h-4 w-4" />}>
                  <textarea
                    aria-label="Product description"
                    placeholder="Describe your product's features, condition, inclusions, and buyer benefits..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className={`min-h-32 w-full resize-y rounded-2xl border bg-white/80 p-4 text-sm font-medium shadow-inner outline-none focus-visible:ring-2 ${inputErrorClass(errors.description)}`}
                  />
                  {fieldError(errors.description)}
                </GlassSection>

                <GlassSection title="Highlights" subtitle="Short points that can later power listing bullets and search snippets." icon={<Sparkles className="h-4 w-4" />}>
                  <div className="space-y-3">
                    {specs.map((spec, index) => (
                      <div key={index} className="grid grid-cols-[minmax(0,0.8fr)_minmax(0,1fr)_44px] gap-2">
                        <Input placeholder="e.g. RAM" value={spec.name} onChange={(e) => updateSpec(index, "name", e.target.value)} className="h-11 rounded-xl border-zinc-200 bg-white/80 text-sm shadow-inner focus-visible:ring-[#009E49]" />
                        <Input placeholder="e.g. 16GB" value={spec.value} onChange={(e) => updateSpec(index, "value", e.target.value)} className="h-11 rounded-xl border-zinc-200 bg-white/80 text-sm shadow-inner focus-visible:ring-[#009E49]" />
                        <Button aria-label={`Remove highlight ${index + 1}`} type="button" variant="ghost" size="icon" onClick={() => removeSpec(index)} className="h-11 w-11 rounded-xl text-zinc-400 hover:bg-rose-50 hover:text-rose-500">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    <Button type="button" variant="outline" onClick={addSpec} className="h-11 w-full rounded-xl border-dashed border-zinc-300 bg-white/70 font-bold text-zinc-600 hover:border-[#009E49] hover:bg-[#009E49]/5 hover:text-[#009E49]">
                      <PlusCircle className="mr-2 h-4 w-4" />
                      Add Highlight
                    </Button>
                  </div>
                </GlassSection>

                {categoryDetailGroup ? (
                  <>
                    {submittedCategory?.isBackendCategory ? (
                      <div className={`rounded-2xl border p-3 text-xs font-bold leading-relaxed ${
                        isLoadingCategoryAttributes
                          ? "border-amber-200 bg-amber-50/80 text-amber-800"
                          : categoryAttributes.length
                            ? "border-emerald-200 bg-emerald-50/80 text-emerald-800"
                            : "border-zinc-200 bg-white/75 text-zinc-600"
                      }`}>
                        {isLoadingCategoryAttributes
                          ? "Loading backend category attributes..."
                          : categoryAttributes.length
                            ? `${categoryAttributes.length} backend attribute${categoryAttributes.length === 1 ? "" : "s"} loaded for ${submittedCategory.leafName}.`
                            : "No backend attributes returned for this category yet. Showing the baseline category fields for now."}
                      </div>
                    ) : null}
                    <CategorySpecificDetails
                      group={categoryDetailGroup}
                      values={categoryFieldValues}
                      onChange={updateCategoryFieldValue}
                    />
                    {fieldError(errors.categoryDetails)}
                  </>
                ) : null}

                <GlassSection title="Product Identity" subtitle="Keep universal listing fields separate from category-specific requirements." icon={<Building2 className="h-4 w-4" />}>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Brand (Optional)</label>
                      <Input placeholder="e.g. Apple" value={brand} onChange={(e) => setBrand(e.target.value)} className="h-11 rounded-xl border-zinc-200 bg-white/80 text-sm shadow-inner focus-visible:ring-[#009E49]" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Condition</label>
                      <select aria-label="Product condition" value={condition} onChange={(e) => setCondition(e.target.value as ProductCondition)} className="h-11 w-full rounded-xl border border-zinc-200 bg-white/80 px-3 text-sm font-medium text-zinc-900 shadow-inner outline-none focus-visible:ring-2 focus-visible:ring-[#009E49]">
                        <option value="new">Brand New</option>
                        <option value="used-like-new">Used - Like New</option>
                        <option value="used-good">Used - Good</option>
                        <option value="refurbished">Refurbished</option>
                      </select>
                    </div>
                  </div>
                </GlassSection>

                <GlassSection title="Variants" subtitle="Set color or size options now. Image tagging can use these values immediately." icon={<Palette className="h-4 w-4" />}>
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-black text-zinc-950">Multiple colors or sizes?</p>
                      <p className="mt-1 text-xs font-semibold text-zinc-500">Keep disabled for single-option products.</p>
                    </div>
                    <ToggleSwitch active={hasVariants} onClick={() => setHasVariants(!hasVariants)} />
                  </div>
                  {hasVariants ? (
                    <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2">
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Colors</label>
                        <Input placeholder="e.g. Red, Blue, Black" value={variantOptions.colors} onChange={(e) => setVariantOptions({ ...variantOptions, colors: e.target.value })} className="h-11 rounded-xl border-zinc-200 bg-white/80 text-sm shadow-inner focus-visible:ring-[#009E49]" />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Sizes</label>
                        <Input placeholder="e.g. S, M, L or 40, 41, 42" value={variantOptions.sizes} onChange={(e) => setVariantOptions({ ...variantOptions, sizes: e.target.value })} className="h-11 rounded-xl border-zinc-200 bg-white/80 text-sm shadow-inner focus-visible:ring-[#009E49]" />
                      </div>
                      <div className="md:col-span-2">{fieldError(errors.variants)}</div>
                    </div>
                  ) : null}
                </GlassSection>
              </>
            ) : null}
          </div>

          <aside className="space-y-5 lg:sticky lg:top-24 lg:self-start">
            <ListingReadiness items={readiness} variant="desktop" />

            {revealDetails ? (
              <>
                <GlassSection title="Pricing & Inventory" icon={<DollarSign className="h-4 w-4" />}>
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Price (Kwacha)</label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-zinc-500">K</span>
                        <Input type="number" placeholder="0.00" value={price} onChange={(e) => setPrice(e.target.value)} className={`h-11 rounded-xl bg-white/80 pl-8 text-base font-bold shadow-inner ${inputErrorClass(errors.price)}`} />
                      </div>
                      {fieldError(errors.price)}
                    </div>
                    <div className="flex items-center justify-between rounded-2xl border border-zinc-100 bg-white/60 px-3 py-2">
                      <span className="flex items-center gap-1.5 text-xs font-bold text-zinc-700"><Percent className="h-3.5 w-3.5 text-[#FF6B00]" /> Offer a discount?</span>
                      <ToggleSwitch active={hasDiscount} onClick={() => setHasDiscount(!hasDiscount)} />
                    </div>
                    {hasDiscount ? (
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold uppercase tracking-wider text-[#FF6B00]">Sale Price (Kwacha)</label>
                        <Input type="number" placeholder="0.00" value={salePrice} onChange={(e) => setSalePrice(e.target.value)} className={`h-11 rounded-xl bg-orange-50 text-base font-bold text-[#FF6B00] shadow-inner placeholder:text-orange-300 ${inputErrorClass(errors.salePrice)}`} />
                        {fieldError(errors.salePrice)}
                      </div>
                    ) : null}
                    <div className="grid grid-cols-3 gap-2">
                      <InputField icon={<Box className="h-4 w-4" />} label="Stock" error={errors.stock} input={<Input type="number" placeholder="0" value={stock} onChange={(e) => setStock(e.target.value)} className={`h-11 rounded-xl bg-white/80 pl-8 text-sm font-bold shadow-inner ${inputErrorClass(errors.stock)}`} />} />
                      <InputField icon={<ShieldAlert className="h-4 w-4 text-amber-500" />} label="Low Stock" error={errors.lowStockThreshold} input={<Input type="number" value={lowStockThreshold} onChange={(e) => setLowStockThreshold(e.target.value)} className={`h-11 rounded-xl bg-white/80 pl-8 text-sm font-bold shadow-inner ${inputErrorClass(errors.lowStockThreshold)}`} />} />
                      <InputField icon={<Barcode className="h-4 w-4" />} label="SKU" input={<Input placeholder="Auto" value={sku} onChange={(e) => setSku(e.target.value)} className="h-11 rounded-xl border-zinc-200 bg-white/80 pl-8 text-xs font-medium shadow-inner focus-visible:ring-[#009E49]" />} />
                    </div>
                  </div>
                </GlassSection>

                <GlassSection title="Logistics / Weight" icon={<Truck className="h-4 w-4" />}>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Delivery Type</label>
                      <select aria-label="Delivery type" value={deliveryType} onChange={(e) => setDeliveryType(e.target.value === "express" ? "express" : "standard")} className="h-11 w-full rounded-xl border border-zinc-200 bg-white/80 px-3 text-sm font-medium text-zinc-900 shadow-inner outline-none focus-visible:ring-2 focus-visible:ring-[#009E49]">
                        <option value="standard">Standard</option>
                        <option value="express">Express</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Weight (KG)</label>
                      <Input type="number" placeholder={`${getDefaultWeight(selectedSubcategory)} (Auto)`} value={packageWeight} onChange={(e) => setPackageWeight(e.target.value)} className="h-11 rounded-xl border-zinc-200 bg-white/80 text-sm font-medium shadow-inner focus-visible:ring-[#009E49]" />
                    </div>
                  </div>
                </GlassSection>

                <div className="overflow-hidden rounded-3xl border border-white/70 bg-white/75 shadow-[0_18px_50px_rgba(15,23,42,0.08)] backdrop-blur-2xl">
                  <button type="button" className="flex w-full items-center justify-between p-5 text-left" onClick={() => setShowAdvanced(!showAdvanced)}>
                    <span>
                      <span className="flex items-center gap-2 text-sm font-black uppercase tracking-wider text-zinc-950"><Settings2 className="h-4 w-4 text-[#009E49]" /> Warranty / Advanced Details</span>
                      <span className="mt-1 block text-xs font-semibold text-zinc-500">SEO optional, dimensions, and later warranty fields.</span>
                    </span>
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-100 text-zinc-500">{showAdvanced ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}</span>
                  </button>
                  {showAdvanced ? (
                    <div className="space-y-5 border-t border-zinc-100 p-5">
                      <div className="space-y-3">
                        <h3 className="text-xs font-black uppercase tracking-wider text-zinc-700">SEO optional</h3>
                        <Input placeholder="Meta title" value={seo.title} onChange={(e) => setSeo({ ...seo, title: e.target.value })} className="h-11 rounded-xl border-zinc-200 bg-white/80 text-sm shadow-inner focus-visible:ring-[#009E49]" />
                        <textarea aria-label="SEO meta description" placeholder="Meta description" value={seo.description} onChange={(e) => setSeo({ ...seo, description: e.target.value })} className="min-h-20 w-full resize-y rounded-xl border border-zinc-200 bg-white/80 p-3 text-sm shadow-inner outline-none focus-visible:ring-2 focus-visible:ring-[#009E49]" />
                      </div>
                      <div className="space-y-3">
                        <h3 className="text-xs font-black uppercase tracking-wider text-zinc-700">Dimensions (cm)</h3>
                        <div className="grid grid-cols-3 gap-2">
                          <Input type="number" placeholder="L" value={dimensions.l} onChange={(e) => setDimensions({ ...dimensions, l: e.target.value })} className="h-11 rounded-xl border-zinc-200 bg-white/80 text-center text-sm shadow-inner" />
                          <Input type="number" placeholder="W" value={dimensions.w} onChange={(e) => setDimensions({ ...dimensions, w: e.target.value })} className="h-11 rounded-xl border-zinc-200 bg-white/80 text-center text-sm shadow-inner" />
                          <Input type="number" placeholder="H" value={dimensions.h} onChange={(e) => setDimensions({ ...dimensions, h: e.target.value })} className="h-11 rounded-xl border-zinc-200 bg-white/80 text-center text-sm shadow-inner" />
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              </>
            ) : (
              <div className="rounded-3xl border border-amber-200 bg-amber-50/80 p-4 text-sm font-semibold leading-relaxed text-amber-800 shadow-sm">
                <Info className="mb-2 h-4 w-4" />
                Submit a final category from the drawer to unlock product details, pricing, logistics, variants, and review submission.
              </div>
            )}
          </aside>
        </div>
      </form>

      <CategoryDrawer
        open={isCategoryOpen}
        onOpenChange={setIsCategoryOpen}
        categorySearch={categorySearch}
        setCategorySearch={setCategorySearch}
        browsePath={browsePath}
        setBrowsePath={setBrowsePath}
        currentLevel={currentLevel}
        searchResults={searchResults}
        pickerSelection={pickerSelection}
        selectedPickerCategory={selectedPickerCategory}
        canSubmitCategory={canSubmitCategory}
        onSelectBrowseNode={selectBrowseNode}
        onChooseSearchResult={chooseSearchResult}
        onSelectOther={() => setPickerSelection({ path: browsePath, isOther: true })}
        onSubmitCategory={submitCategory}
      />

      <ProductListingMobileActions
        isEditMode={isEditMode}
        isSubmitting={isSubmitting}
        revealDetails={revealDetails}
        onSave={handleSave}
        canSubmitForReview={canSubmitForReview}
        submitLabel={submitLabel}
      />
    </div>
  );
}
