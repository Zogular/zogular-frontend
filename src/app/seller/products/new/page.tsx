"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, UploadCloud, CheckCircle2, Tag, Box, DollarSign,
  Image as ImageIcon, Percent, Palette, Truck, Barcode, ListPlus,
  Trash2, PlusCircle, Settings2, ChevronDown, ChevronUp, AlertCircle,
  FolderTree, Building2, ShieldAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Toaster, toast } from "sonner";
import {
  createSellerCatalogProduct,
  getCategoryMetaByName,
  getSubcategoryMeta,
  SELLER_CATEGORY_TREE,
  slugifySellerValue,
  type CreateSellerProductInput,
  type ProductCondition,
  type SellerProductImage,
  type SellerProductVariant,
  type SellerProductStatus,
} from "@/services/seller-catalog";

// ============================================================================
// 1. DATA CONTRACTS
// ============================================================================
type ProductStatus = Extract<SellerProductStatus, "draft" | "pending_review">;
type ValidationErrors = Record<string, string>;

// ============================================================================
// 3. UI CONFIGURATIONS & HELPERS
// ============================================================================
const getDefaultWeight = (subcategory: string) => {
  const weights: Record<string, number> = {
    Smartphones: 0.4, Laptops: 2.5, Tablets: 0.7, "Audio & Headphones": 0.5, Wearables: 0.2, "Gaming Consoles": 3.0, Cameras: 0.9, Accessories: 0.3, "Home Appliances": 15.0,
    "TVs & Entertainment": 9.0, "Men's Clothing": 0.3, "Women's Clothing": 0.25, Footwear: 0.8, Bags: 0.9, Watches: 0.2, Jewelry: 0.1, "Beauty & Personal Care": 0.4,
    Furniture: 12.0, "Kitchen & Dining": 2.0, "Home Decor": 1.2, Bedding: 2.5, "Cleaning Supplies": 3.0, Beverages: 1.5, Snacks: 0.6, Staples: 2.0, "Frozen Foods": 1.8,
    Supplements: 0.5, "Medical Supplies": 0.8, "Baby Products": 1.5, Toys: 0.9, "Kids Clothing": 0.25, "School Supplies": 0.7, "Fitness Equipment": 8.0, "Outdoor Gear": 3.5,
    Sportswear: 0.4, "Car Accessories": 2.0, "Motorbike Accessories": 2.5, "Spare Parts": 5.0,
  };
  return weights[subcategory] || 1.0;
};

function buildSku(subcategory: string, title: string) {
  const prefix = slugifySellerValue(subcategory).slice(0, 3).toUpperCase() || "ZMY";
  const suffix = slugifySellerValue(title).slice(0, 5).toUpperCase() || Date.now().toString().slice(-5);
  return `ZM-${prefix}-${suffix}`;
}

function buildVariants(
  hasVariants: boolean,
  options: { colors: string; sizes: string },
  sku: string,
  stock: number,
): SellerProductVariant[] {
  if (!hasVariants) return [{ id: `${sku}-default`, label: "Option", value: "Default", sku, stock }];

  const colors = options.colors.split(",").map((item) => item.trim()).filter(Boolean);
  const sizes = options.sizes.split(",").map((item) => item.trim()).filter(Boolean);
  const values = colors.length ? colors : sizes;

  return (values.length ? values : ["Default"]).map((value, index) => ({
    id: `${sku}-${slugifySellerValue(value) || index + 1}`,
    label: colors.length ? "Color" : sizes.length ? "Size" : "Option",
    value,
    sku: `${sku}-${index + 1}`,
    stock,
    swatchClass: colors.length ? swatchClassForColor(value) : "bg-zinc-200 border-zinc-200",
  }));
}

function swatchClassForColor(value: string) {
  const color = value.toLowerCase();
  if (color.includes("black")) return "bg-zinc-900 border-zinc-900";
  if (color.includes("white")) return "bg-white border-zinc-200";
  if (color.includes("blue")) return "bg-blue-500 border-blue-500";
  if (color.includes("red")) return "bg-red-500 border-red-500";
  if (color.includes("green")) return "bg-[#009E49] border-[#009E49]";
  if (color.includes("orange")) return "bg-[#FF6B00] border-[#FF6B00]";
  return "bg-zinc-300 border-zinc-300";
}

// ============================================================================
// 4. SUBCOMPONENTS
// ============================================================================
const ToggleSwitch = ({ active, onClick }: { active: boolean; onClick: () => void }) => (
  <div onClick={onClick} className={`relative h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 transition-colors ${active ? "border-[#009E49] bg-[#009E49]" : "border-zinc-200 bg-zinc-100"}`}>
    <div className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-300 ${active ? "translate-x-5" : "translate-x-0.5"}`} />
  </div>
);

// ============================================================================
// 5. MAIN PAGE EXPORT
// ============================================================================
export default function AddProductPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<ValidationErrors>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const objectUrlsRef = useRef<string[]>([]);

  // Form State
  const [productName, setProductName] = useState("");
  const [brand, setBrand] = useState("");
  const [condition, setCondition] = useState<ProductCondition>("new");
  const [description, setDescription] = useState("");
  const [images, setImages] = useState<SellerProductImage[]>([]);

  const [price, setPrice] = useState("");
  const [salePrice, setSalePrice] = useState("");
  const [stock, setStock] = useState("");
  const [sku, setSku] = useState("");
  const [lowStockThreshold, setLowStockThreshold] = useState("5");

  const [searchCategory, setSearchCategory] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Computing");
  const [selectedSubcategory, setSelectedSubcategory] = useState("Laptops");
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);

  const [deliveryType, setDeliveryType] = useState("standard");
  const [packageWeight, setPackageWeight] = useState("");

  const [hasDiscount, setHasDiscount] = useState(false);
  const [hasVariants, setHasVariants] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [specs, setSpecs] = useState([{ name: "", value: "" }]);
  const [variantOptions, setVariantOptions] = useState({ colors: "", sizes: "" });
  const [seo, setSeo] = useState({ title: "", description: "" });
  const [dimensions, setDimensions] = useState({ l: "", w: "", h: "" });

  const filteredSubcategories = useMemo(() => {
    return (SELLER_CATEGORY_TREE[selectedCategory] ?? []).filter((sub) =>
      sub.toLowerCase().includes(searchCategory.toLowerCase())
    );
  }, [selectedCategory, searchCategory]);

  useEffect(() => {
    return () => {
      objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  const addSpec = () => setSpecs([...specs, { name: "", value: "" }]);
  const removeSpec = (index: number) => setSpecs(specs.filter((_, i) => i !== index));
  const updateSpec = (index: number, field: "name" | "value", value: string) => {
    const next = [...specs];
    next[index][field] = value;
    setSpecs(next);
  };

  const handleImageSelection = (files: FileList | null) => {
    if (!files?.length) return;
    const selectedFiles = Array.from(files).slice(0, Math.max(0, 6 - images.length));
    const nextImages = selectedFiles.map<SellerProductImage>((file, index) => {
      const url = URL.createObjectURL(file);
      objectUrlsRef.current.push(url);
      return {
        id: `${file.name}-${Date.now()}-${index}`,
        url,
        name: file.name,
        isPrimary: images.length === 0 && index === 0,
      };
    });
    setImages((current) => [...current, ...nextImages]);
  };

  const removeImage = (imageId: string) => {
    setImages((current) => {
      const removed = current.find((image) => image.id === imageId);
      if (removed?.url.startsWith("blob:")) URL.revokeObjectURL(removed.url);
      objectUrlsRef.current = objectUrlsRef.current.filter((url) => url !== removed?.url);
      const remaining = current.filter((image) => image.id !== imageId);
      return remaining.map((image, index) => ({ ...image, isPrimary: index === 0 ? true : image.isPrimary }));
    });
  };

  const setPrimaryImage = (imageId: string) => {
    setImages((current) => current.map((image) => ({ ...image, isPrimary: image.id === imageId })));
  };

  const validateForm = (status: ProductStatus) => {
    const nextErrors: ValidationErrors = {};
    if (!productName.trim()) nextErrors.productName = "Product name required.";
    if (status === "pending_review" && !description.trim()) nextErrors.description = "Description required before submission.";
    if (status === "pending_review" && images.length === 0) nextErrors.images = "Add at least one product image.";
    if (!selectedCategory.trim()) nextErrors.category = "Category required.";
    if (!selectedSubcategory.trim()) nextErrors.subcategory = "Subcategory required.";
    if (!price || Number(price) <= 0) nextErrors.price = "Valid price required.";
    if (!stock || Number(stock) < 0) nextErrors.stock = "Valid stock required.";
    if (Number(lowStockThreshold) < 0) nextErrors.lowStockThreshold = "Valid threshold required.";
    if (hasVariants && !variantOptions.colors.trim() && !variantOptions.sizes.trim()) nextErrors.variants = "Add at least one color or size.";
    if (hasDiscount) {
      if (!salePrice || Number(salePrice) <= 0) nextErrors.salePrice = "Valid sale price required.";
      else if (Number(salePrice) >= Number(price || 0)) nextErrors.salePrice = "Must be lower than regular price.";
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSave = async (e: React.FormEvent | React.MouseEvent, status: ProductStatus) => {
    e.preventDefault();
    if (!validateForm(status)) {
      toast.error("Please fix the highlighted fields.");
      return;
    }

    setIsSubmitting(true);

    const categoryMeta = getCategoryMetaByName(selectedCategory);
    const subcategoryMeta = getSubcategoryMeta(selectedCategory, selectedSubcategory);
    const finalSKU = sku.trim() || buildSku(selectedSubcategory, productName);
    const finalWeight = packageWeight ? Number(packageWeight) : getDefaultWeight(selectedSubcategory);

    const payload: CreateSellerProductInput = {
      title: productName.trim(),
      brand: brand.trim(),
      condition,
      description: description.trim(),
      categoryName: categoryMeta.name,
      categorySlug: categoryMeta.slug,
      subcategoryName: subcategoryMeta.name,
      subcategorySlug: subcategoryMeta.slug,
      status,
      price: Number(price),
      salePrice: hasDiscount ? Number(salePrice) : null,
      stock: Number(stock),
      lowStockThreshold: Number(lowStockThreshold),
      sku: finalSKU,
      images,
      deliveryType: deliveryType as "standard" | "express",
      logistics: {
        weightKG: finalWeight,
        dimensions: showAdvanced && dimensions.l ? `${dimensions.l}x${dimensions.w}x${dimensions.h}` : "Standard Box",
      },
      variants: buildVariants(hasVariants, variantOptions, finalSKU, Number(stock)),
      specifications: specs.filter((s) => s.name.trim() && s.value.trim()),
      seo: {
        metaTitle: seo.title.trim() || `${productName.trim()} | Zogular`,
        metaDescription: seo.description.trim() || `Buy ${productName.trim()} in Lusaka on Zogular. Best prices and fast delivery available.`,
      },
    };

    try {
      await createSellerCatalogProduct(payload);
      
      toast.success(status === "draft" ? "Draft saved successfully!" : "Product submitted for review!", {
        description: status === "draft" ? "Your draft is ready for editing later." : "Your product is waiting for admin moderation.",
        icon: <CheckCircle2 className="h-4 w-4 text-[#009E49]" />,
        style: { borderRadius: "14px", border: "1px solid #e4e7ec" },
      });
      
      router.push("/seller/products");
      
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save product");
    } finally {
      setIsSubmitting(false);
    }
  };

  const fieldError = (msg?: string) => msg ? <p className="mt-1 flex items-center gap-1 text-xs font-semibold text-red-500"><AlertCircle className="h-3.5 w-3.5" />{msg}</p> : null;
  const inputErrorClass = (err?: string) => err ? "border-red-300 focus-visible:ring-red-500" : "border-zinc-200 focus-visible:ring-[#009E49]";

  return (
    <div className="mx-auto max-w-250 animate-in fade-in pb-24 duration-500 md:pb-12">
      <Toaster position="top-center" />

      <form noValidate onSubmit={(e) => handleSave(e, "pending_review")}>
        
        {/* HEADER */}
        <div className="sticky top-18 md:top-0 z-20 mb-6 -mx-4 flex items-center justify-between border-b border-zinc-200/50 bg-[#f4fbf6]/80 px-4 py-4 backdrop-blur-md md:mx-0 md:border-none md:px-0">
          <div className="flex items-center gap-3">
            <Link href="/seller/products">
              <Button aria-label="Go back to products" type="button" variant="ghost" size="icon" className="h-9 w-9 rounded-full border border-zinc-200 bg-white text-zinc-600 shadow-sm hover:bg-zinc-100">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-xl font-black leading-none tracking-tight text-zinc-900 md:text-2xl">Add Product</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" onClick={(e) => handleSave(e, "draft")} disabled={isSubmitting} className="hidden h-10 rounded-xl border-zinc-200 bg-white px-4 font-bold text-zinc-600 shadow-sm hover:bg-zinc-50 md:flex">
              Save Draft
            </Button>
            <Button type="submit" disabled={isSubmitting} className="h-10 rounded-xl bg-[#009E49] px-6 font-bold text-white shadow-[0_4px_15px_rgba(0,158,73,0.2)] transition-all active:scale-95 hover:bg-[#00853d]">
              {isSubmitting ? "Submitting..." : "Submit for Review"}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_350px]">
          
          {/* LEFT COLUMN */}
          <div className="space-y-6">
            
            {/* BASIC INFO */}
            <div className="rounded-3xl border border-zinc-200/80 bg-white p-5 shadow-sm md:p-7">
              <h2 className="mb-5 flex items-center gap-2 text-sm font-black uppercase tracking-wider text-zinc-900"><Tag className="h-4 w-4 text-zinc-400" /> Basic Information</h2>
              <div className="space-y-4">
                
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Product Name</label>
                  <Input placeholder="e.g. MacBook Air M2 - 256GB" value={productName} onChange={(e) => setProductName(e.target.value)} className={`h-12 rounded-xl bg-zinc-50 text-base font-medium shadow-inner ${inputErrorClass(errors.productName)}`} />
                  {fieldError(errors.productName)}
                </div>

                {/* HORIZONTAL GRID: Brand & Condition */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Brand (Optional)</label>
                    <div className="relative">
                      <Building2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                      <Input placeholder="e.g. Apple" value={brand} onChange={(e) => setBrand(e.target.value)} className="h-11 rounded-xl bg-zinc-50 pl-9 text-sm shadow-inner" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Condition</label>
                    <select aria-label="Product condition" value={condition} onChange={(e) => setCondition(e.target.value as ProductCondition)} className="h-11 w-full appearance-none rounded-xl border border-zinc-200 bg-zinc-50 px-4 text-sm font-medium text-zinc-900 shadow-inner outline-none focus-visible:ring-2 focus-visible:ring-[#009E49]">
                      <option value="new">Brand New</option>
                      <option value="used-like-new">Used - Like New</option>
                      <option value="used-good">Used - Good</option>
                      <option value="refurbished">Refurbished</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Description</label>
                  <textarea aria-label="Product description" placeholder="Describe your product's features and benefits..." value={description} onChange={(e) => setDescription(e.target.value)} className={`min-h-32 w-full resize-y rounded-xl border bg-zinc-50 p-4 text-sm font-medium shadow-inner outline-none focus-visible:ring-2 ${inputErrorClass(errors.description)}`} />
                  {fieldError(errors.description)}
                </div>
              </div>
            </div>

            {/* MEDIA */}
            <div className="rounded-3xl border border-zinc-200/80 bg-white p-5 shadow-sm md:p-7">
              <h2 className="mb-5 flex items-center gap-2 text-sm font-black uppercase tracking-wider text-zinc-900"><ImageIcon className="h-4 w-4 text-zinc-400" /> Product Media</h2>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className={`w-full cursor-pointer rounded-2xl border-2 border-dashed bg-zinc-50 p-8 text-center transition-colors hover:bg-zinc-100 group ${errors.images ? "border-red-300" : "border-zinc-200"}`}
              >
                <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full border border-zinc-200 bg-white shadow-sm transition-transform group-hover:scale-110">
                  <UploadCloud className="h-6 w-6 text-[#009E49]" />
                </div>
                <p className="text-sm font-bold text-zinc-900">Click to upload images</p>
                <p className="mt-1 text-xs text-zinc-500">JPEG, PNG or WEBP (Max 5MB each)</p>
              </button>
              <input
                ref={fileInputRef}
                aria-label="Upload product images"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                className="hidden"
                onChange={(event) => handleImageSelection(event.target.files)}
              />
              {fieldError(errors.images)}
              {images.length > 0 ? (
                <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-4">
                  {images.map((image) => (
                    <div key={image.id} className="group relative aspect-square overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-50">
                      <Image src={image.url} alt={image.name} fill sizes="120px" unoptimized className="object-cover" />
                      {image.isPrimary ? (
                        <span className="absolute left-2 top-2 rounded-md bg-[#009E49] px-2 py-1 text-[9px] font-black uppercase tracking-wider text-white">
                          Primary
                        </span>
                      ) : null}
                      <div className="absolute inset-x-2 bottom-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                        <button type="button" onClick={() => setPrimaryImage(image.id)} className="flex-1 rounded-lg bg-white/90 px-2 py-1 text-[10px] font-bold text-zinc-700 shadow-sm">
                          Set
                        </button>
                        <button type="button" onClick={() => removeImage(image.id)} className="rounded-lg bg-red-500 px-2 py-1 text-[10px] font-bold text-white shadow-sm">
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>

            {/* SPECS */}
            <div className="rounded-3xl border border-zinc-200/80 bg-white p-5 shadow-sm md:p-7">
              <h2 className="mb-5 flex items-center gap-2 text-sm font-black uppercase tracking-wider text-zinc-900"><ListPlus className="h-4 w-4 text-zinc-400" /> Specifications & Details</h2>
              <div className="space-y-3">
                <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Custom Specifications</label>
                {specs.map((spec, index) => (
                  <div key={index} className="animate-in flex items-center gap-2 fade-in slide-in-from-top-2">
                    <Input placeholder="e.g. RAM" value={spec.name} onChange={(e) => updateSpec(index, "name", e.target.value)} className="h-11 w-1/3 rounded-xl border-zinc-200 bg-zinc-50 text-sm shadow-inner focus-visible:ring-[#009E49]" />
                    <Input placeholder="e.g. 16GB" value={spec.value} onChange={(e) => updateSpec(index, "value", e.target.value)} className="h-11 flex-1 rounded-xl border-zinc-200 bg-zinc-50 text-sm shadow-inner focus-visible:ring-[#009E49]" />
                    <Button aria-label={`Remove specification ${index + 1}`} type="button" variant="ghost" size="icon" onClick={() => removeSpec(index)} className="h-11 w-11 shrink-0 rounded-xl text-zinc-400 transition-colors hover:bg-red-50 hover:text-red-500"><Trash2 className="h-4 w-4" /></Button>
                  </div>
                ))}
                <Button type="button" variant="outline" onClick={addSpec} className="mt-2 h-11 w-full rounded-xl border-dashed border-zinc-300 font-bold text-zinc-600 transition-all hover:border-[#009E49] hover:bg-[#009E49]/5 hover:text-[#009E49]"><PlusCircle className="mr-2 h-4 w-4" /> Add Specification</Button>
              </div>
            </div>

            {/* VARIANTS */}
            <div className="overflow-hidden rounded-3xl border border-zinc-200/80 bg-white p-5 shadow-sm transition-all duration-300 md:p-7">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="flex items-center gap-2 text-sm font-black uppercase tracking-wider text-zinc-900"><Palette className="h-4 w-4 text-zinc-400" /> Options & Variants</h2>
                  <p className="mt-1 text-xs font-medium text-zinc-500">Does this product have multiple sizes or colors?</p>
                </div>
                <ToggleSwitch active={hasVariants} onClick={() => setHasVariants(!hasVariants)} />
              </div>
              
              {hasVariants && (
                <div className="animate-in mt-6 border-t border-zinc-100 pt-6 fade-in slide-in-from-top-2">
                  {/* HORIZONTAL GRID: Colors & Sizes */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Colors (Comma separated)</label>
                      <Input placeholder="e.g. Red, Blue, Black" value={variantOptions.colors} onChange={(e) => setVariantOptions({...variantOptions, colors: e.target.value})} className="h-11 rounded-xl border-zinc-200 bg-zinc-50 text-sm shadow-inner focus-visible:ring-[#009E49]" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Sizes (Comma separated)</label>
                      <Input placeholder="e.g. S, M, L or 40, 41, 42" value={variantOptions.sizes} onChange={(e) => setVariantOptions({...variantOptions, sizes: e.target.value})} className="h-11 rounded-xl border-zinc-200 bg-zinc-50 text-sm shadow-inner focus-visible:ring-[#009E49]" />
                    </div>
                  </div>
                  {fieldError(errors.variants)}
                </div>
              )}
            </div>
          </div>

          {/* RIGHT COLUMN */}
          <div className="space-y-6">
            
            {/* PRICING & INVENTORY */}
            <div className="rounded-3xl border border-zinc-200/80 bg-white p-5 shadow-sm md:p-6">
              <h2 className="mb-5 flex items-center gap-2 text-sm font-black uppercase tracking-wider text-zinc-900"><DollarSign className="h-4 w-4 text-zinc-400" /> Pricing & Inventory</h2>
              <div className="space-y-5">
                
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Price (Kwacha)</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-zinc-500">K</span>
                    <Input type="number" placeholder="0.00" value={price} onChange={(e) => setPrice(e.target.value)} className={`h-11 rounded-xl bg-zinc-50 pl-8 text-base font-bold shadow-inner ${inputErrorClass(errors.price)}`} />
                  </div>
                  {fieldError(errors.price)}
                </div>

                <div className="flex items-center justify-between border-y border-zinc-100 py-2">
                  <span className="flex items-center gap-1.5 text-xs font-bold text-zinc-700"><Percent className="h-3.5 w-3.5 text-[#FF6B00]" /> Offer a discount?</span>
                  <ToggleSwitch active={hasDiscount} onClick={() => setHasDiscount(!hasDiscount)} />
                </div>

                {hasDiscount && (
                  <div className="animate-in space-y-1.5 fade-in slide-in-from-top-2">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-[#FF6B00]">Sale Price (Kwacha)</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-[#FF6B00]">K</span>
                      <Input type="number" placeholder="0.00" value={salePrice} onChange={(e) => setSalePrice(e.target.value)} className={`h-11 rounded-xl bg-orange-50 pl-8 text-base font-bold text-[#FF6B00] shadow-inner placeholder:text-orange-300 ${inputErrorClass(errors.salePrice)}`} />
                    </div>
                    {fieldError(errors.salePrice)}
                  </div>
                )}

                {/* HORIZONTAL GRID: 3 Columns for Stock Data */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Stock</label>
                    <div className="relative">
                      <Box className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                      <Input type="number" placeholder="0" value={stock} onChange={(e) => setStock(e.target.value)} className={`h-11 rounded-xl bg-zinc-50 pl-8 text-sm font-bold shadow-inner ${inputErrorClass(errors.stock)}`} />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Low Stock</label>
                    <div className="relative">
                      <ShieldAlert className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-amber-500" />
                      <Input type="number" value={lowStockThreshold} onChange={(e) => setLowStockThreshold(e.target.value)} className={`h-11 rounded-xl bg-zinc-50 pl-8 text-sm font-bold shadow-inner ${inputErrorClass(errors.lowStockThreshold)}`} />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">SKU</label>
                    <div className="relative">
                      <Barcode className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                      <Input placeholder="Auto" value={sku} onChange={(e) => setSku(e.target.value)} className="h-11 rounded-xl border-zinc-200 bg-zinc-50 pl-8 text-xs font-medium shadow-inner placeholder:text-zinc-400 focus-visible:ring-[#009E49]" />
                    </div>
                  </div>
                </div>
                {(errors.stock || errors.lowStockThreshold) && <div className="text-xs text-red-500 font-semibold flex items-center gap-1"><AlertCircle className="h-3.5 w-3.5"/> Check stock values</div>}
              </div>
            </div>

            {/* ORGANIZATION */}
            <div className="relative z-10 rounded-3xl border border-zinc-200/80 bg-white p-5 shadow-sm md:p-6">
              <h2 className="mb-5 text-sm font-black uppercase tracking-wider text-zinc-900">Organization</h2>
              <div className="space-y-4">
                
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Category</label>
                  {/* HORIZONTAL GRID: Category Buttons */}
                  <div className="grid grid-cols-2 gap-2">
                    {Object.keys(SELLER_CATEGORY_TREE).map((category) => (
                      <button key={category} type="button" onClick={() => { setSelectedCategory(category); setSelectedSubcategory(SELLER_CATEGORY_TREE[category][0]); setSearchCategory(""); setIsCategoryOpen(false); }} className={`rounded-xl border px-2 py-2 text-xs font-bold transition-all ${selectedCategory === category ? "border-[#009E49] bg-[#009E49]/10 text-[#009E49]" : "border-zinc-200 bg-zinc-50 text-zinc-700 hover:bg-zinc-100"}`}>
                        {category}
                      </button>
                    ))}
                  </div>
                  {fieldError(errors.category)}
                </div>

                <div className="relative space-y-1.5 pt-2">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Subcategory</label>
                  <div className={`flex h-11 cursor-pointer items-center justify-between rounded-xl border bg-zinc-50 px-4 shadow-inner ${errors.subcategory ? "border-red-300" : "border-zinc-200"}`} onClick={() => setIsCategoryOpen(!isCategoryOpen)}>
                    <span className="text-sm font-bold text-zinc-900">{selectedSubcategory}</span>
                    <FolderTree className="h-4 w-4 text-zinc-400" />
                  </div>
                  {fieldError(errors.subcategory)}

                  {isCategoryOpen && (
                    <div className="absolute left-0 top-full z-50 mt-2 w-full overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-[0_10px_40px_rgba(0,0,0,0.1)]">
                      <div className="border-b border-zinc-100 p-2">
                        <Input autoFocus placeholder="Search subcategories..." value={searchCategory} onChange={(e) => setSearchCategory(e.target.value)} className="h-9 border-none bg-zinc-50 text-sm font-medium focus-visible:ring-0" />
                      </div>
                      <div className="max-h-52 overflow-y-auto p-1">
                        {filteredSubcategories.length > 0 ? filteredSubcategories.map((sub) => (
                          <div key={sub} onClick={() => { setSelectedSubcategory(sub); setIsCategoryOpen(false); setSearchCategory(""); }} className="cursor-pointer rounded-lg px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-[#009E49]/10 hover:text-[#009E49]">
                            {sub}
                          </div>
                        )) : <div className="p-3 text-sm text-zinc-500">No matches found.</div>}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* SHIPPING (Horizontal) */}
            <div className="rounded-3xl border border-zinc-200/80 bg-white p-5 shadow-sm md:p-6">
              <h2 className="mb-5 flex items-center gap-2 text-sm font-black uppercase tracking-wider text-zinc-900"><Truck className="h-4 w-4 text-zinc-400" /> Shipping</h2>
              {/* HORIZONTAL GRID */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Delivery Type</label>
                  <select aria-label="Delivery type" value={deliveryType} onChange={(e) => setDeliveryType(e.target.value)} className="h-11 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-sm font-medium text-zinc-900 shadow-inner outline-none focus-visible:ring-2 focus-visible:ring-[#009E49]">
                    <option value="standard">Standard</option>
                    <option value="express">Express</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Weight (KG)</label>
                  <div className="relative">
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-zinc-400">KG</span>
                    <Input type="number" placeholder={`${getDefaultWeight(selectedSubcategory)} (Auto)`} value={packageWeight} onChange={(e) => setPackageWeight(e.target.value)} className="h-11 rounded-xl border-zinc-200 bg-zinc-50 text-sm font-medium shadow-inner placeholder:text-zinc-400 focus-visible:ring-[#009E49]" />
                  </div>
                </div>
              </div>
            </div>

            {/* ADVANCED */}
            <div className="overflow-hidden rounded-3xl border border-zinc-200/80 bg-white shadow-sm">
              <div className="flex cursor-pointer items-center justify-between p-5 transition-colors hover:bg-zinc-50/50 md:p-6" onClick={() => setShowAdvanced(!showAdvanced)}>
                <h2 className="flex items-center gap-2 text-sm font-black uppercase tracking-wider text-zinc-900"><Settings2 className="h-4 w-4 text-zinc-400" /> Advanced Settings</h2>
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-100 text-zinc-500">
                  {showAdvanced ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </div>
              </div>

              {showAdvanced && (
                <div className="animate-in space-y-6 border-t border-zinc-100 p-5 pt-0 fade-in slide-in-from-top-4 md:p-6 md:pt-0">
                  <div className="space-y-4 mt-4">
                    <h3 className="text-xs font-black uppercase tracking-wider text-zinc-700">Search Engine Optimization</h3>
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Meta Title</label>
                      <Input placeholder="Leave blank to auto-generate" value={seo.title} onChange={(e) => setSeo({...seo, title: e.target.value})} className="h-11 rounded-xl border-zinc-200 bg-zinc-50 text-sm shadow-inner focus-visible:ring-[#009E49]" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Meta Description</label>
                      <textarea aria-label="SEO meta description" placeholder="Write a short summary..." value={seo.description} onChange={(e) => setSeo({...seo, description: e.target.value})} className="min-h-20 w-full resize-y rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-sm shadow-inner outline-none focus-visible:ring-2 focus-visible:ring-[#009E49]" />
                    </div>
                  </div>

                  <div className="space-y-4 border-t border-zinc-100 pt-4">
                    <h3 className="text-xs font-black uppercase tracking-wider text-zinc-700">Dimensions (cm)</h3>
                    {/* HORIZONTAL GRID */}
                    <div className="grid grid-cols-3 gap-3">
                      <Input type="number" placeholder="L" value={dimensions.l} onChange={(e) => setDimensions({...dimensions, l: e.target.value})} className="h-11 rounded-xl border-zinc-200 bg-zinc-50 text-center text-sm shadow-inner" />
                      <Input type="number" placeholder="W" value={dimensions.w} onChange={(e) => setDimensions({...dimensions, w: e.target.value})} className="h-11 rounded-xl border-zinc-200 bg-zinc-50 text-center text-sm shadow-inner" />
                      <Input type="number" placeholder="H" value={dimensions.h} onChange={(e) => setDimensions({...dimensions, h: e.target.value})} className="h-11 rounded-xl border-zinc-200 bg-zinc-50 text-center text-sm shadow-inner" />
                    </div>
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>
      </form>

      {/* MOBILE ACTIONS */}
      <div className="fixed bottom-16 left-0 z-30 w-full border-t border-zinc-200 bg-white/95 p-4 shadow-[0_-10px_20px_rgba(0,0,0,0.05)] backdrop-blur-md md:hidden">
        <div className="grid grid-cols-2 gap-3">
          <Button type="button" variant="outline" onClick={(e) => handleSave(e, "draft")} disabled={isSubmitting} className="h-12 rounded-xl border-zinc-200 bg-white font-bold text-zinc-700">
            Save Draft
          </Button>
          <Button type="button" onClick={(e) => handleSave(e, "pending_review")} disabled={isSubmitting} className="h-12 rounded-xl bg-[#009E49] font-extrabold text-white shadow-[0_4px_15px_rgba(0,158,73,0.3)] transition-all active:scale-95 hover:bg-[#00853d]">
            {isSubmitting ? "Submitting..." : "Submit for Review"}
          </Button>
        </div>
      </div>
    </div>
  );
}
