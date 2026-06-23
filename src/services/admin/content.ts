import { throwBackendPendingFeature } from "@/services/backend-pending";

export type ContentStatus = "draft" | "scheduled" | "published" | "paused" | "archived";

export interface AdminBanner {
  id: string;
  title: string;
  placement: "homepage_hero" | "category_strip" | "checkout_notice";
  status: ContentStatus;
  audience: string;
  startAt: string;
  endAt: string;
  clickTarget: string;
  priority: number;
}

export interface FeaturedCollection {
  id: string;
  title: string;
  status: ContentStatus;
  productCount: number;
  owner: string;
  order: number;
  updatedAt: string;
}

export interface Announcement {
  id: string;
  title: string;
  body: string;
  status: ContentStatus;
  channel: "admin" | "marketplace" | "seller_portal";
  scheduledAt: string;
}

export interface AdminContentWorkspace {
  banners: AdminBanner[];
  collections: FeaturedCollection[];
  announcements: Announcement[];
}

export const adminContentApi = {
  async fetchWorkspace(): Promise<AdminContentWorkspace> {
    return {
      banners: [],
      collections: [],
      announcements: [],
    };
  },
  async updateBannerStatus(bannerId: string, status: ContentStatus): Promise<void> {
    void bannerId;
    void status;
    throwBackendPendingFeature("Admin content banner status update");
  },
  async reorderCollection(collectionId: string, direction: "up" | "down"): Promise<void> {
    void collectionId;
    void direction;
    throwBackendPendingFeature("Admin content collection reorder");
  },
  async publishAnnouncement(announcement: Omit<Announcement, "id" | "status">): Promise<Announcement> {
    void announcement;
    throwBackendPendingFeature("Admin content announcement scheduling");
  },
};
