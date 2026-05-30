import NextImage from "next/image";
import { Image as ImageIcon, UploadCloud } from "lucide-react";
import { MAX_IMAGES, readRecordValue } from "../_lib/product-listing-studio";
import type { SellerProductImage } from "@/services/seller-catalog";
import { fieldError, GlassSection } from "./ProductListingStudioPrimitives";

export function ProductImagesSection({
  error,
  fileInputRef,
  imageWarnings,
  images,
  onImageSelection,
  onRemoveImage,
  onSetImageVariant,
  onSetPrimaryImage,
  variantValues,
}: {
  error?: string;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  imageWarnings: Record<string, string>;
  images: SellerProductImage[];
  onImageSelection: (files: FileList | null) => void;
  onRemoveImage: (imageId: string) => void;
  onSetImageVariant: (imageId: string, linkedVariantValue: string) => void;
  onSetPrimaryImage: (imageId: string) => void;
  variantValues: string[];
}) {
  return (
    <GlassSection
      title="Product Images"
      subtitle="Add clean product photos now. Variant tagging is stored as metadata for the later color-gallery flow."
      icon={<ImageIcon className="h-4 w-4" />}
    >
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={images.length >= MAX_IMAGES}
        className={`group w-full rounded-2xl border-2 border-dashed p-5 text-left transition-all ${
          error ? "border-rose-300 bg-rose-50/70" : "border-emerald-200 bg-linear-to-br from-emerald-50/80 via-white/90 to-white"
        } ${images.length >= MAX_IMAGES ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:border-[#009E49] hover:shadow-lg hover:shadow-emerald-900/5"}`}
      >
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-white bg-white shadow-sm transition-transform group-hover:scale-105">
            <UploadCloud className="h-6 w-6 text-[#009E49]" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-black text-zinc-950">Upload product images</p>
            <p className="mt-1 text-xs font-semibold leading-relaxed text-zinc-500">JPG, PNG, WEBP. Max 3MB each. Non-square images are auto-cropped to square.</p>
          </div>
        </div>
      </button>
      <input
        ref={fileInputRef}
        aria-label="Upload product images"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="hidden"
        onChange={(event) => onImageSelection(event.target.files)}
      />
      {fieldError(error)}

      <div className="mt-4 grid gap-2 rounded-2xl border border-amber-200/70 bg-amber-50/80 p-3 text-xs font-semibold leading-relaxed text-amber-800 md:grid-cols-2">
        <p>Final listing images are square. Upload 500x500px to 2000x2000px when possible; otherwise ZOGULAR center-crops them.</p>
        <p>No watermarks, phone numbers, WhatsApp numbers, Instagram handles, or logo overlays.</p>
      </div>

      {images.length > 0 ? (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
          {images.map((image) => {
            const imageWarning = readRecordValue(imageWarnings, image.id);
            return (
              <div key={image.id} className="overflow-hidden rounded-2xl border border-white/70 bg-white/85 shadow-sm ring-1 ring-zinc-900/3">
                <div className="group relative aspect-square overflow-hidden bg-zinc-100">
                  <NextImage src={image.url} alt={image.name} fill sizes="160px" unoptimized className="object-cover" />
                  {image.isPrimary ? (
                    <span className="absolute left-2 top-2 rounded-lg bg-[#009E49] px-2 py-1 text-[9px] font-black uppercase tracking-wider text-white">Primary</span>
                  ) : null}
                  <div className="absolute inset-x-2 bottom-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <button type="button" onClick={() => onSetPrimaryImage(image.id)} className="flex-1 rounded-lg bg-white/95 px-2 py-1 text-[10px] font-bold text-zinc-700 shadow-sm">Set</button>
                    <button type="button" onClick={() => onRemoveImage(image.id)} className="rounded-lg bg-rose-500 px-2 py-1 text-[10px] font-bold text-white shadow-sm">Remove</button>
                  </div>
                </div>
                <div className="space-y-2 p-2">
                  <select
                    aria-label={`Variant tag for ${image.name}`}
                    value={image.linkedVariantValue ?? ""}
                    onChange={(event) => onSetImageVariant(image.id, event.target.value)}
                    className="h-9 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-2 text-xs font-bold text-zinc-700 outline-none focus:ring-2 focus:ring-[#009E49]"
                  >
                    <option value="">General</option>
                    {variantValues.map((value) => (
                      <option key={value} value={value}>{value}</option>
                    ))}
                  </select>
                  {image.wasAutoCropped ? <p className="text-[10px] font-black uppercase tracking-wide text-emerald-700">Square crop applied</p> : null}
                  {imageWarning ? <p className="text-[10px] font-semibold leading-snug text-amber-700">{imageWarning}</p> : null}
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
    </GlassSection>
  );
}
