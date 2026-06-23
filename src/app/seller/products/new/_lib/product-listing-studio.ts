import { slugifySellerValue, type SellerProductVariant } from "@/services/seller-catalog";

export const MAX_IMAGES = 10;
export const MAX_IMAGE_SIZE = 3 * 1024 * 1024;
export const MAX_PROCESSED_IMAGE_SIZE = 1600;
export const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const AUTO_CROPPED_IMAGE_WARNING = "Auto-cropped to a square preview for consistent ZOGULAR listing cards.";

export const getDefaultWeight = (subcategory: string) => {
  const weights: Record<string, number> = {
    Smartphones: 0.4,
    Laptops: 2.5,
    Tablets: 0.7,
    "Audio & Headphones": 0.5,
    Wearables: 0.2,
    "Gaming Consoles": 3,
    Cameras: 0.9,
    Accessories: 0.3,
    "Home Appliances": 15,
    "TVs & Entertainment": 9,
    "Men's Clothing": 0.3,
    "Women's Clothing": 0.25,
    Footwear: 0.8,
    Bags: 0.9,
    Watches: 0.2,
    Jewelry: 0.1,
    "Beauty & Personal Care": 0.4,
    Furniture: 12,
    "Kitchen & Dining": 2,
    "Home Decor": 1.2,
    Bedding: 2.5,
    "Cleaning Supplies": 3,
    Beverages: 1.5,
    Snacks: 0.6,
    Staples: 2,
    "Frozen Foods": 1.8,
    Supplements: 0.5,
    "Medical Supplies": 0.8,
    "Baby Products": 1.5,
    Toys: 0.9,
    "Kids Clothing": 0.25,
    "School Supplies": 0.7,
    "Fitness Equipment": 8,
    "Outdoor Gear": 3.5,
    Sportswear: 0.4,
    "Car Accessories": 2,
    "Motorbike Accessories": 2.5,
    "Spare Parts": 5,
  };
  return Object.hasOwn(weights, subcategory) ? weights[subcategory] : 1;
};

export function buildSku(subcategory: string, title: string) {
  const prefix = slugifySellerValue(subcategory).slice(0, 3).toUpperCase() || "ZMY";
  const titleSegment = slugifySellerValue(title).replace(/-/g, "").slice(0, 10).toUpperCase() || "ITEM";
  const uniqueSegment = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`.slice(-6).toUpperCase();
  return `ZM-${prefix}-${titleSegment}-${uniqueSegment}`;
}

export function buildVariants(
  hasVariants: boolean,
  options: { colors: string; sizes: string },
  sku: string,
  stock: number,
): SellerProductVariant[] {
  if (!hasVariants) return [{ id: `${sku}-default`, label: "Option", value: "Default", sku, stock }];

  const colors = splitVariantValues(options.colors);
  const sizes = splitVariantValues(options.sizes);
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

export function splitVariantValues(value: string) {
  return value.split(",").map((item) => item.trim()).filter(Boolean);
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

export const withoutRecordKey = <TValue,>(record: Record<string, TValue>, key: string): Record<string, TValue> =>
  Object.hasOwn(record, key) ? Object.fromEntries(Object.entries(record).filter(([k]) => k !== key)) as Record<string, TValue> : record;

export const readRecordValue = <TValue,>(record: Record<string, TValue>, key: string): TValue | undefined =>
  Object.hasOwn(record, key) ? record[key] : undefined;

export function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new window.Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Unable to read image dimensions."));
    image.src = url;
  });
}

export function canvasToBlob(canvas: HTMLCanvasElement, type: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Unable to process image."));
    }, type, 0.9);
  });
}
