"use client";

import { useId, useState, type FormEvent } from "react";
import Image from "next/image";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, RefreshCw } from "lucide-react";
import { useAdminIdentity } from "@/components/admin/AdminShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiError } from "@/services/api";
import {
  adminContentApi,
  type AdminHomepageBanner,
  type HomepageBannerAsset,
  type HomepageBannerInput,
} from "@/services/admin/content";
import { homepageBannerCopyLimits } from "@/services/homepage-banners";

const destinationLabels = {
  products: "All products",
  "new-arrivals": "New arrivals",
  categories: "Categories",
} as const;
const stateLabels = { DRAFT: "Draft", PUBLISHED: "Published", PAUSED: "Paused" } as const;
const lusakaTime = new Intl.DateTimeFormat("en-ZM", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Lusaka" });
const lusakaOffsetMs = 2 * 60 * 60 * 1000;

type BannerWrite =
  | { action: "save"; banner: AdminHomepageBanner | null; input: HomepageBannerInput }
  | { action: "publish" | "pause"; banner: AdminHomepageBanner };

function toLusakaInput(iso: string) {
  return new Date(Date.parse(iso) + lusakaOffsetMs).toISOString().slice(0, 23);
}

function fromLusakaInput(value: string) {
  return Date.parse(`${value}+02:00`);
}

function statusOf(error: unknown) {
  return error instanceof ApiError ? error.status : undefined;
}

function BannerEditor({ banner, assets, disabled, saving, onSave, onClose }: {
  banner: AdminHomepageBanner | null;
  assets: readonly HomepageBannerAsset[];
  disabled: boolean;
  saving: boolean;
  onSave: (input: HomepageBannerInput) => void;
  onClose: () => void;
}) {
  const headingId = useId();
  const [assetKey, setAssetKey] = useState(banner?.assetKey ?? "");
  const [validationError, setValidationError] = useState("");
  const selectedAsset = assets.find((asset) => asset.key === assetKey);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
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
      <h2 id={headingId} className="text-lg font-semibold">{banner ? "Edit draft" : "New banner draft"}</h2>
      <form onSubmit={submit} className="mt-4 space-y-4">
        <fieldset disabled={disabled} className="grid min-w-0 gap-4 sm:grid-cols-2">
          <label className="grid min-w-0 gap-1.5 text-sm font-medium">
            Headline
            <Input name="headline" maxLength={homepageBannerCopyLimits.headline} defaultValue={banner?.headline} required />
          </label>
          <label className="grid min-w-0 gap-1.5 text-sm font-medium">
            Button label
            <Input name="ctaLabel" maxLength={homepageBannerCopyLimits.ctaLabel} defaultValue={banner?.ctaLabel} required />
          </label>
          <label className="grid min-w-0 gap-1.5 text-sm font-medium sm:col-span-2">
            Description (optional)
            <textarea name="description" rows={2} maxLength={homepageBannerCopyLimits.description} defaultValue={banner?.description ?? ""} className={`${selectClass} py-2`} />
          </label>
          <label className="grid min-w-0 gap-1.5 text-sm font-medium">
            Destination
            <select name="destination" className={selectClass} defaultValue={banner?.destination ?? ""} required>
              <option value="" disabled>Select a destination</option>
              {Object.entries(destinationLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
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
            <Input type="datetime-local" name="startsAt" step="0.001" defaultValue={banner && toLusakaInput(banner.startsAt) || undefined} required />
          </label>
          <label className="grid min-w-0 gap-1.5 text-sm font-medium">
            Ends (Lusaka time)
            <Input type="datetime-local" name="endsAt" step="0.001" defaultValue={banner && toLusakaInput(banner.endsAt) || undefined} required />
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
          <Button type="submit" disabled={disabled || !selectedAsset}>{saving ? "Saving…" : "Save draft"}</Button>
          <Button type="button" variant="outline" disabled={saving} onClick={onClose}>Cancel</Button>
        </div>
      </form>
    </section>
  );
}

export function HomepageBannerWorkspace() {
  const queryClient = useQueryClient();
  const identity = useAdminIdentity();
  const queryKey = ["admin", "homepage-banners", identity?.id] as const;
  // undefined closes the editor; null opens a fresh draft.
  const [editor, setEditor] = useState<AdminHomepageBanner | null | undefined>();
  const [feedback, setFeedback] = useState("");
  const list = useQuery({
    queryKey,
    queryFn: ({ signal }) => adminContentApi.listHomepageBanners(signal),
    retry: false,
    gcTime: 0,
    enabled: Boolean(identity),
  });
  const write = useMutation({
    retry: false,
    mutationFn: (request: BannerWrite) => request.action === "save"
      ? request.banner
        ? adminContentApi.updateHomepageBanner(request.banner.id, request.banner.version, request.input)
        : adminContentApi.createHomepageBanner(request.input)
      : adminContentApi.changeHomepageBannerState(request.banner.id, request.banner.version, request.action),
    onMutate: () => setFeedback(""),
    onSuccess: async (_saved, request) => {
      setEditor(undefined);
      setFeedback(request.action === "save" ? "Draft saved." : request.action === "publish" ? "Banner publication saved." : "Banner paused.");
      await queryClient.invalidateQueries({ queryKey });
    },
    onError: (error) => {
      if ([401, 403].includes(statusOf(error) ?? 0)) {
        setEditor(undefined);
        void queryClient.resetQueries({ queryKey });
      }
    },
  });

  const failureStatus = statusOf(write.error ?? list.error);
  const accessDenied = failureStatus === 401 || failureStatus === 403;
  const conflict = write.isError && failureStatus === 409;
  const data = accessDenied || list.isError ? undefined : list.data;
  const needsReload = write.isError && failureStatus !== 400 && failureStatus !== 422;
  const blocked = write.isPending || list.isFetching || needsReload;

  async function reload() {
    const result = await list.refetch();
    if (result.isSuccess) {
      setEditor(undefined);
      setFeedback("");
      write.reset();
    }
  }

  return (
    <div className="mx-auto max-w-5xl min-w-0 space-y-5 pb-12 text-zinc-900">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Homepage banners</h1>
        <Button disabled={!data?.assets.length || blocked} onClick={() => { write.reset(); setFeedback(""); setEditor(null); }}>
          <Plus aria-hidden="true" /> New draft
        </Button>
      </header>
      {list.isPending && !accessDenied && <p role="status" className="text-sm text-zinc-700">Loading banners…</p>}
      {accessDenied ? <p role="alert" className="text-sm text-red-700">You no longer have access to homepage banners. Sign in with an authorized admin account.</p> : (
        <>
          {list.isError && <div className="flex flex-wrap items-center gap-3">
            <p role="alert" className="text-sm text-red-700">Banners could not be loaded.</p>
            <Button variant="outline" disabled={list.isFetching} onClick={() => void reload()}><RefreshCw aria-hidden="true" /> Retry</Button>
          </div>}
          {write.isError && <div className="flex flex-wrap items-center gap-3">
            <p role="alert" className="text-sm text-red-700">{conflict
              ? "This banner changed or its schedule overlaps another banner. Reload before trying again."
              : failureStatus === 400 || failureStatus === 422
                ? "Banner details were not accepted. Check the image set, copy, and schedule, then try again."
                : "The banner change could not be confirmed. Reload to check the latest status before trying again."}</p>
            <Button variant="outline" disabled={list.isFetching} onClick={() => void reload()}><RefreshCw aria-hidden="true" /> Reload banners</Button>
          </div>}
          {feedback && <p role="status" className="text-sm text-emerald-800">{feedback}</p>}
          {data && (
            <>
              {data.assets.length === 0 && <p role="status" className="border-y border-zinc-200 py-3 text-sm text-zinc-700">No approved image sets are available. New drafts and publication are unavailable.</p>}
              {data.items.length === 0 ? <p className="text-sm text-zinc-700">No homepage banners yet.</p> : (
                <ul aria-label="Homepage banners" className="divide-y divide-zinc-200 border-y border-zinc-200">
                  {data.items.map((banner) => (
                    <li key={banner.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                      <div className="min-w-0 space-y-1">
                        <h2 className="wrap-anywhere text-sm font-semibold">{banner.headline}</h2>
                        <p className="text-sm text-zinc-600">{stateLabels[banner.state]} · {destinationLabels[banner.destination]}</p>
                        <p className="text-xs text-zinc-600">{lusakaTime.format(Date.parse(banner.startsAt))} to {lusakaTime.format(Date.parse(banner.endsAt))} CAT</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {banner.state === "DRAFT" && <>
                          <Button variant="outline" disabled={blocked} onClick={() => { write.reset(); setFeedback(""); setEditor(banner); }}>Edit draft</Button>
                          <Button disabled={blocked || editor?.id === banner.id || !data.assets.some((asset) => asset.key === banner.assetKey)} onClick={() => write.mutate({ action: "publish", banner })}>Publish</Button>
                        </>}
                        {banner.state === "PUBLISHED" && <Button variant="outline" disabled={blocked} onClick={() => write.mutate({ action: "pause", banner })}>Pause</Button>}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              {editor !== undefined && <BannerEditor key={editor ? `${editor.id}:${editor.version}` : "new"} banner={editor} assets={data.assets} disabled={blocked} saving={write.isPending && write.variables.action === "save"} onSave={(input) => write.mutate({ action: "save", banner: editor, input })} onClose={() => setEditor(undefined)} />}
            </>
          )}
        </>
      )}
    </div>
  );
}
