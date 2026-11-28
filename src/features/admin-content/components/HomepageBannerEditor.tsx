"use client";

import { useId, useState, type FormEvent } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { AdminHomepageBanner, HomepageBannerAsset, HomepageBannerInput } from "@/services/admin/content";
import { homepageBannerCopyLimits } from "@/services/homepage-banners";

export const campaignDestinationLabels = {
  products: "All products",
  "new-arrivals": "New arrivals",
  categories: "Categories",
} as const;
const lusakaOffsetMs = 2 * 60 * 60 * 1000;

function toLusakaInput(iso: string) {
  return new Date(Date.parse(iso) + lusakaOffsetMs).toISOString().slice(0, 23);
}

function fromLusakaInput(value: string) {
  return Date.parse(`${value}+02:00`);
}

export function HomepageBannerEditor({ banner, submitted, initialInput, assets, disabled, saving, onSave, onClose }: {
  banner: AdminHomepageBanner | null;
  submitted?: HomepageBannerInput;
  initialInput?: HomepageBannerInput;
  assets: readonly HomepageBannerAsset[];
  disabled: boolean;
  saving: boolean;
  onSave?: (input: HomepageBannerInput) => void;
  onClose: () => void;
}) {
  const headingId = useId();
  const draft = submitted ?? initialInput ?? banner;
  const [assetKey, setAssetKey] = useState(draft?.assetKey ?? "");
  const [validationError, setValidationError] = useState("");
  const selectedAsset = assets.find((asset) => asset.key === assetKey);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (disabled || !onSave) return;
    const fields = new FormData(event.currentTarget);
    const read = (name: string) => String(fields.get(name) ?? "").trim();
    const start = fromLusakaInput(read("startsAt"));
    const end = fromLusakaInput(read("endsAt"));
    const headline = read("headline");
    const ctaLabel = read("ctaLabel");
    const destination = read("destination");
    if (!selectedAsset || !headline || !ctaLabel || (
      destination !== "products" && destination !== "new-arrivals" && destination !== "categories"
    )) {
      setValidationError("Enter the headline and button label, then choose a destination and approved image set.");
      return;
    }
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
      setValidationError("Enter an end time after the start time.");
      return;
    }
    setValidationError("");
    onSave({
      headline, ctaLabel, destination, assetKey,
      description: read("description") || null,
      startsAt: new Date(start).toISOString(), endsAt: new Date(end).toISOString(),
    });
  }

  const selectClass = "min-h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm focus-visible:outline-2 focus-visible:outline-emerald-700";

  return (
    <section aria-labelledby={headingId} className="border-t border-zinc-200 pt-5">
      <h2 id={headingId} className="text-lg font-semibold">{submitted ? (banner ? "Submitted edit" : "Submitted draft") : banner ? "Edit draft" : "New banner draft"}</h2>
      <form onSubmit={submit} className="mt-4 space-y-4">
        <fieldset disabled={disabled} className="grid min-w-0 gap-4 sm:grid-cols-2">
          <label className="grid min-w-0 gap-1.5 text-sm font-medium">
            Headline
            <Input name="headline" maxLength={homepageBannerCopyLimits.headline} defaultValue={draft?.headline} required />
          </label>
          <label className="grid min-w-0 gap-1.5 text-sm font-medium">
            Button label
            <Input name="ctaLabel" maxLength={homepageBannerCopyLimits.ctaLabel} defaultValue={draft?.ctaLabel} required />
          </label>
          <label className="grid min-w-0 gap-1.5 text-sm font-medium sm:col-span-2">
            Description (optional)
            <textarea name="description" rows={2} maxLength={homepageBannerCopyLimits.description} defaultValue={draft?.description ?? ""} className={`${selectClass} py-2`} />
          </label>
          <label className="grid min-w-0 gap-1.5 text-sm font-medium">
            Destination
            <select name="destination" className={selectClass} defaultValue={draft?.destination ?? ""} required>
              <option value="" disabled>Select a destination</option>
              {Object.entries(campaignDestinationLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label className="grid min-w-0 gap-1.5 text-sm font-medium">
            Approved image set
            <select className={selectClass} value={assetKey} onChange={(event) => setAssetKey(event.target.value)} required>
              <option value="" disabled>Select an image set</option>
              {assetKey && !selectedAsset && <option value={assetKey} disabled>Previously selected image set is unavailable</option>}
              {assets.map((asset) => <option key={asset.key} value={asset.key}>{asset.key}</option>)}
            </select>
          </label>
          <label className="grid min-w-0 gap-1.5 text-sm font-medium">
            Starts (Lusaka time)
            <Input type="datetime-local" name="startsAt" step="0.001" defaultValue={draft ? toLusakaInput(draft.startsAt) : undefined} required />
          </label>
          <label className="grid min-w-0 gap-1.5 text-sm font-medium">
            Ends (Lusaka time)
            <Input type="datetime-local" name="endsAt" step="0.001" defaultValue={draft ? toLusakaInput(draft.endsAt) : undefined} required />
          </label>
        </fieldset>
        {selectedAsset && (
          <div className="grid gap-4 sm:grid-cols-[1fr_2fr]" aria-label="Approved image previews">
            {([ ["Mobile crop", selectedAsset.mobileSrc, "aspect-3/2"], ["Desktop crop", selectedAsset.desktopSrc, "aspect-3/1"] ] as const).map(([label, src, aspect]) => (
              <figure key={label} className="min-w-0 space-y-1.5">
                <div className={`relative ${aspect} overflow-hidden rounded-md bg-zinc-100`}>
                  <Image fill unoptimized src={src} alt="" className="object-contain" />
                </div>
                <figcaption className="text-sm text-zinc-600">{label}</figcaption>
              </figure>
            ))}
          </div>
        )}
        {validationError && <p role="alert" className="text-sm text-red-700">{validationError}</p>}
        <div className="flex flex-wrap gap-2">
          {!submitted && <Button type="submit" disabled={disabled || !selectedAsset}>{saving ? "Saving…" : "Save draft"}</Button>}
          <Button type="button" variant="outline" disabled={saving} onClick={onClose}>{submitted ? "Close" : "Cancel"}</Button>
        </div>
      </form>
    </section>
  );
}
