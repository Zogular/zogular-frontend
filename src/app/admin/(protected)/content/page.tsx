"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Archive, Eye, ImagePlus, Megaphone, MoveDown, MoveUp, Send, Sparkles } from "lucide-react";
import { toast } from "sonner";
import {
  AdminDetailSheet,
  AdminEmptyState,
  AdminMetricCard,
  AdminPageHeader,
  AdminStatusBadge,
  type AdminTone,
} from "@/components/admin/AdminPrimitives";
import { FeaturePendingNotice } from "@/components/shared/FeaturePendingNotice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { BACKEND_INTEGRATION_PENDING_MESSAGE } from "@/services/backend-pending";
import { formatAdminDateTime, toTitleCase } from "@/lib/admin-format";
import { recordAdminAudit } from "@/services/admin/audit";
import {
  adminContentApi,
  type AdminBanner,
  type AdminContentWorkspace,
  type Announcement,
  type ContentStatus,
  type FeaturedCollection,
} from "@/services/admin/content";
import { adminHasPermission, CURRENT_ADMIN_IDENTITY } from "@/services/admin/session";

const statusTone: Record<ContentStatus, AdminTone> = {
  draft: "zinc",
  scheduled: "sky",
  published: "emerald",
  paused: "amber",
  archived: "rose",
};

const emptyWorkspace: AdminContentWorkspace = {
  banners: [],
  collections: [],
  announcements: [],
};

const ADMIN_CONTENT_BACKEND_PENDING = true;

export default function AdminContentPage() {
  const [workspace, setWorkspace] = useState<AdminContentWorkspace>(emptyWorkspace);
  const [loading, setLoading] = useState(true);
  const [selectedBanner, setSelectedBanner] = useState<AdminBanner | null>(null);
  const [previewTitle, setPreviewTitle] = useState("No preview selected");
  const [isMutating, setIsMutating] = useState(false);
  const [bannerTitle, setBannerTitle] = useState("");
  const [bannerTarget, setBannerTarget] = useState("/category/electronics");
  const [bannerAudience, setBannerAudience] = useState("All buyers");
  const [announcementTitle, setAnnouncementTitle] = useState("");
  const [announcementBody, setAnnouncementBody] = useState("");
  const [announcementChannel, setAnnouncementChannel] = useState<Announcement["channel"]>("marketplace");
  const [announcementScheduledAt, setAnnouncementScheduledAt] = useState("2026-05-12T08:00");

  const canManageContent = adminHasPermission("manage_content");

  const loadWorkspace = useCallback(async () => {
    try {
      setLoading(true);
      setWorkspace(await adminContentApi.fetchWorkspace());
    } catch {
      toast.error("Failed to load content workspace.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadWorkspace(); }, [loadWorkspace]);

  const metrics = useMemo(() => {
    const liveBanners = workspace.banners.filter((banner) => banner.status === "published").length;
    const scheduledItems = [...workspace.banners, ...workspace.collections, ...workspace.announcements].filter((item) => item.status === "scheduled").length;
    const archivedItems = [...workspace.banners, ...workspace.collections, ...workspace.announcements].filter((item) => item.status === "archived").length;
    return { liveBanners, scheduledItems, archivedItems };
  }, [workspace]);

  const updateBanner = async (banner: AdminBanner, status: ContentStatus) => {
    try {
      setIsMutating(true);
      await adminContentApi.updateBannerStatus(banner.id, status);
      await recordAdminAudit({
        actorId: CURRENT_ADMIN_IDENTITY.id,
        action: `content_banner_${status}`,
        target: banner.id,
        severity: status === "archived" ? "warning" : "info",
      });
      const updatedBanner = { ...banner, status };
      setWorkspace((current) => ({
        ...current,
        banners: current.banners.map((item) => item.id === banner.id ? updatedBanner : item),
      }));
      setSelectedBanner(updatedBanner);
      setPreviewTitle(`${updatedBanner.title} · ${toTitleCase(status)}`);
      toast.success(`Banner moved to ${toTitleCase(status)}.`);
    } catch {
      toast.error("Failed to update banner.");
    } finally {
      setIsMutating(false);
    }
  };

  const createBanner = async () => {
    if (!bannerTitle.trim() || !bannerTarget.trim()) return toast.error("Banner title and target are required.");
    const createdBanner: AdminBanner = {
      id: `BAN-${Date.now()}`,
      title: bannerTitle.trim(),
      placement: "homepage_hero",
      status: "scheduled",
      audience: bannerAudience.trim() || "All buyers",
      startAt: new Date().toISOString(),
      endAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      clickTarget: bannerTarget.trim(),
      priority: workspace.banners.length + 1,
    };

    await recordAdminAudit({
      actorId: CURRENT_ADMIN_IDENTITY.id,
      action: "content_banner_created",
      target: createdBanner.id,
      note: createdBanner.title,
    });
    setWorkspace((current) => ({ ...current, banners: [createdBanner, ...current.banners] }));
    setSelectedBanner(createdBanner);
    setPreviewTitle(`${createdBanner.title} · Scheduled campaign`);
    setBannerTitle("");
    toast.success("Banner campaign scheduled.");
  };

  const reorderCollection = async (collection: FeaturedCollection, direction: "up" | "down") => {
    try {
      setIsMutating(true);
      await adminContentApi.reorderCollection(collection.id, direction);
      await recordAdminAudit({
        actorId: CURRENT_ADMIN_IDENTITY.id,
        action: `content_collection_move_${direction}`,
        target: collection.id,
      });
      setWorkspace((current) => {
        const sorted = [...current.collections].sort((first, second) => first.order - second.order);
        const index = sorted.findIndex((item) => item.id === collection.id);
        const swapIndex = direction === "up" ? index - 1 : index + 1;
        if (swapIndex < 0 || swapIndex >= sorted.length) return current;
        [sorted[index], sorted[swapIndex]] = [sorted[swapIndex], sorted[index]];
        return {
          ...current,
          collections: sorted.map((item, itemIndex) => ({ ...item, order: itemIndex + 1 })),
        };
      });
      toast.success("Featured collection order updated.");
    } catch {
      toast.error("Failed to reorder collection.");
    } finally {
      setIsMutating(false);
    }
  };

  const publishAnnouncement = async () => {
    if (!announcementTitle.trim() || !announcementBody.trim()) return toast.error("Announcement title and body are required.");

    try {
      setIsMutating(true);
      const createdAnnouncement = await adminContentApi.publishAnnouncement({
        title: announcementTitle.trim(),
        body: announcementBody.trim(),
        channel: announcementChannel,
        scheduledAt: new Date(announcementScheduledAt).toISOString(),
      });
      await recordAdminAudit({
        actorId: CURRENT_ADMIN_IDENTITY.id,
        action: "content_announcement_scheduled",
        target: createdAnnouncement.id,
        note: createdAnnouncement.title,
      });
      setWorkspace((current) => ({ ...current, announcements: [createdAnnouncement, ...current.announcements] }));
      setPreviewTitle(`${createdAnnouncement.title} · ${toTitleCase(createdAnnouncement.channel)}`);
      setAnnouncementTitle("");
      setAnnouncementBody("");
      toast.success("Announcement scheduled.");
    } catch {
      toast.error("Failed to schedule announcement.");
    } finally {
      setIsMutating(false);
    }
  };

  if (!canManageContent) {
    return <AdminEmptyState title="Access denied" description="Your admin role cannot manage content operations." />;
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Content & Promo"
        description="Operations-only preview for homepage banners, featured sections, announcements, campaign hooks, and preview states."
      />

      <FeaturePendingNotice
        title="Content actions disabled"
        description="Backend integration pending. Banner scheduling, publish/pause/archive, collection reorder, and announcements are disabled until backend support is implemented."
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
        <AdminMetricCard title="Banners" value={workspace.banners.length} note="Homepage and promo placements" icon={<ImagePlus className="h-5 w-5" />} tone="indigo" />
        <AdminMetricCard title="Live banners" value={metrics.liveBanners} note="Currently published" icon={<Sparkles className="h-5 w-5" />} tone="emerald" />
        <AdminMetricCard title="Scheduled" value={metrics.scheduledItems} note="Queued campaigns and notices" icon={<Send className="h-5 w-5" />} tone="sky" />
        <AdminMetricCard title="Archived" value={metrics.archivedItems} note="Hidden from storefront surfaces" icon={<Archive className="h-5 w-5" />} tone="rose" />
      </div>

      {loading ? (
        <section className="rounded-3xl border border-white/70 bg-white/80 p-12 text-center text-sm font-bold text-zinc-500 shadow-xl shadow-zinc-900/5">Loading content workspace...</section>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
          <div className="space-y-6">
            <section className="rounded-3xl border border-white/70 bg-white/80 p-5 shadow-xl shadow-zinc-900/5 backdrop-blur-xl">
              <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
                <div>
                  <h2 className="text-lg font-black text-zinc-950">Banner manager</h2>
                  <p className="text-sm font-bold text-zinc-500">Create, preview, publish, pause, and archive campaign surfaces.</p>
                </div>
                <Button disabled={ADMIN_CONTENT_BACKEND_PENDING} onClick={createBanner} className="rounded-xl bg-zinc-950 font-black text-white hover:bg-zinc-800">
                  <ImagePlus className="mr-2 h-4 w-4" /> Backend pending
                </Button>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <Input value={bannerTitle} onChange={(event) => setBannerTitle(event.target.value)} placeholder={BACKEND_INTEGRATION_PENDING_MESSAGE} disabled={ADMIN_CONTENT_BACKEND_PENDING} className="h-11 rounded-xl border-zinc-200 bg-white" />
                <Input value={bannerTarget} onChange={(event) => setBannerTarget(event.target.value)} placeholder={BACKEND_INTEGRATION_PENDING_MESSAGE} disabled={ADMIN_CONTENT_BACKEND_PENDING} className="h-11 rounded-xl border-zinc-200 bg-white" />
                <Input value={bannerAudience} onChange={(event) => setBannerAudience(event.target.value)} placeholder={BACKEND_INTEGRATION_PENDING_MESSAGE} disabled={ADMIN_CONTENT_BACKEND_PENDING} className="h-11 rounded-xl border-zinc-200 bg-white" />
              </div>
              <div className="mt-4 space-y-3">
                {workspace.banners.map((banner) => (
                  <div key={banner.id} className="rounded-3xl border border-zinc-100 bg-white p-4 transition hover:bg-emerald-50/50">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="font-black text-zinc-950">{banner.title}</p>
                        <p className="text-xs font-bold text-zinc-500">{toTitleCase(banner.placement)} · {banner.clickTarget} · priority {banner.priority}</p>
                        <p className="text-xs font-medium text-zinc-400">{formatAdminDateTime(banner.startAt)} to {formatAdminDateTime(banner.endAt)}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <AdminStatusBadge tone={statusTone[banner.status]}>{toTitleCase(banner.status)}</AdminStatusBadge>
                        <Button variant="outline" size="sm" onClick={() => { setSelectedBanner(banner); setPreviewTitle(`${banner.title} · Preview`); }} className="rounded-xl font-black">
                          <Eye className="mr-2 h-4 w-4" /> Preview/Edit
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-3xl border border-white/70 bg-white/80 p-5 shadow-xl shadow-zinc-900/5 backdrop-blur-xl">
              <h2 className="text-lg font-black text-zinc-950">Featured collection manager</h2>
              <p className="text-sm font-bold text-zinc-500">Reorder homepage and campaign sections with visible priority changes.</p>
              <div className="mt-4 space-y-3">
                {[...workspace.collections].sort((first, second) => first.order - second.order).map((collection) => (
                  <div key={collection.id} className="flex flex-col gap-3 rounded-3xl border border-zinc-100 bg-white p-4 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="font-black text-zinc-950">{collection.order}. {collection.title}</p>
                      <p className="text-xs font-bold text-zinc-500">{collection.productCount} products · owner {collection.owner} · updated {formatAdminDateTime(collection.updatedAt)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <AdminStatusBadge tone={statusTone[collection.status]}>{toTitleCase(collection.status)}</AdminStatusBadge>
                      <Button variant="outline" size="icon-sm" aria-label={`Move ${collection.title} up`} disabled={ADMIN_CONTENT_BACKEND_PENDING || isMutating || collection.order === 1} onClick={() => reorderCollection(collection, "up")}><MoveUp className="h-4 w-4" /></Button>
                      <Button variant="outline" size="icon-sm" aria-label={`Move ${collection.title} down`} disabled={ADMIN_CONTENT_BACKEND_PENDING || isMutating || collection.order === workspace.collections.length} onClick={() => reorderCollection(collection, "down")}><MoveDown className="h-4 w-4" /></Button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <div className="space-y-6">
            <section className="rounded-3xl border border-white/70 bg-white/80 p-5 shadow-xl shadow-zinc-900/5 backdrop-blur-xl">
              <h2 className="text-lg font-black text-zinc-950">Announcement composer</h2>
              <p className="text-sm font-bold text-zinc-500">Schedule storefront, admin, or seller-facing notices.</p>
              <div className="mt-4 space-y-3">
                <Input value={announcementTitle} onChange={(event) => setAnnouncementTitle(event.target.value)} placeholder={BACKEND_INTEGRATION_PENDING_MESSAGE} disabled={ADMIN_CONTENT_BACKEND_PENDING} className="h-11 rounded-xl border-zinc-200 bg-white" />
                <Textarea value={announcementBody} onChange={(event) => setAnnouncementBody(event.target.value)} placeholder={BACKEND_INTEGRATION_PENDING_MESSAGE} disabled={ADMIN_CONTENT_BACKEND_PENDING} className="min-h-28 rounded-2xl border-zinc-200 bg-white" />
                <select value={announcementChannel} onChange={(event) => setAnnouncementChannel(event.target.value as Announcement["channel"])} disabled={ADMIN_CONTENT_BACKEND_PENDING} className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm font-bold text-zinc-700 shadow-sm disabled:cursor-not-allowed disabled:text-zinc-400">
                  <option value="marketplace">Storefront</option>
                  <option value="seller_portal">Seller portal</option>
                  <option value="admin">Admin</option>
                </select>
                <Input type="datetime-local" value={announcementScheduledAt} onChange={(event) => setAnnouncementScheduledAt(event.target.value)} disabled={ADMIN_CONTENT_BACKEND_PENDING} className="h-11 rounded-xl border-zinc-200 bg-white" />
                <Button onClick={publishAnnouncement} disabled={ADMIN_CONTENT_BACKEND_PENDING || isMutating} className="w-full rounded-xl bg-emerald-600 font-black text-white hover:bg-emerald-700">
                  <Megaphone className="mr-2 h-4 w-4" /> Backend pending
                </Button>
              </div>
            </section>

            <section className="rounded-3xl border border-zinc-200 bg-zinc-950 p-5 text-white shadow-2xl shadow-zinc-950/20">
              <p className="text-[10px] font-black uppercase tracking-wider text-emerald-300">Preview state</p>
              <h2 className="mt-3 text-2xl font-black">{previewTitle}</h2>
              <p className="mt-2 text-sm font-medium text-zinc-400">This preview state updates from banner, collection, and announcement actions so the UI never exposes dead preview controls.</p>
            </section>
          </div>
        </div>
      )}

      <AdminDetailSheet
        open={Boolean(selectedBanner)}
        onOpenChange={(open) => !open && setSelectedBanner(null)}
        title={selectedBanner?.title ?? "Banner"}
        description={selectedBanner ? `${selectedBanner.id} · ${selectedBanner.clickTarget}` : "Banner details"}
      >
        {selectedBanner ? (
          <div className="space-y-5">
            <div className="rounded-3xl border border-zinc-100 bg-white p-4">
              <p className="text-[10px] font-black uppercase tracking-wider text-zinc-500">Preview</p>
              <div className="mt-3 rounded-3xl bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.24),transparent_18rem),linear-gradient(135deg,#09090b,#27272a)] p-6 text-white">
                <p className="text-xs font-black uppercase tracking-wider text-emerald-300">{selectedBanner.audience}</p>
                <h3 className="mt-3 text-2xl font-black">{selectedBanner.title}</h3>
                <p className="mt-2 text-sm font-bold text-zinc-300">{selectedBanner.clickTarget}</p>
              </div>
            </div>

            <div className="grid gap-2 md:grid-cols-2">
              <Button disabled={ADMIN_CONTENT_BACKEND_PENDING || isMutating || selectedBanner.status === "published"} onClick={() => updateBanner(selectedBanner, "published")} className="rounded-xl bg-emerald-600 font-black text-white hover:bg-emerald-700">Publish</Button>
              <Button disabled={ADMIN_CONTENT_BACKEND_PENDING || isMutating || selectedBanner.status === "paused"} variant="outline" onClick={() => updateBanner(selectedBanner, "paused")} className="rounded-xl font-black">Unpublish</Button>
              <Button disabled={ADMIN_CONTENT_BACKEND_PENDING || isMutating || selectedBanner.status === "scheduled"} variant="outline" onClick={() => updateBanner(selectedBanner, "scheduled")} className="rounded-xl font-black">Schedule campaign</Button>
              <Button disabled={ADMIN_CONTENT_BACKEND_PENDING || isMutating || selectedBanner.status === "archived"} variant="destructive" onClick={() => updateBanner(selectedBanner, "archived")} className="rounded-xl font-black">Archive item</Button>
            </div>
          </div>
        ) : null}
      </AdminDetailSheet>
    </div>
  );
}
