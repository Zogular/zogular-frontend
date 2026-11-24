"use client";

/**
 * @file AdminNotificationControl.tsx
 * @module features/admin-shell/components
 * @description
 * Top-right administrative notification action control.
 *
 * Architectural Design:
 * - Positioned in the global AdminHeader next to AdminProfilePopover.
 * - Truthfully represents that administrative live notifications and background alert feeds
 *   are currently inactive/unavailable in this release.
 * - Renders a visibly disabled, non-consuming, non-clickable button control.
 * - Accurately labelled "Notifications are not available yet".
 * - Contains ZERO background polling, WebSockets, Server-Sent Events (SSE), push, or live network loops.
 * - Strictly prevents fabricated unread badges, simulated live alerts, or misleading clickable workflows.
 * - Accessible via keyboard navigation and screen readers with explicit inactive state labeling.
 */

import React from "react";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";

export function AdminNotificationControl() {
  return (
    <Button
      type="button"
      variant="ghost"
      disabled
      aria-disabled="true"
      className="size-11 rounded-xl text-[var(--admin-ink-muted,#787b74)] opacity-50 cursor-not-allowed focus-visible:ring-0"
      aria-label="Notifications are not available yet"
      title="Notifications are not available yet"
      data-testid="admin-notification-trigger"
    >
      <Bell className="size-5" aria-hidden="true" />
      <span className="sr-only">Notifications are not available yet</span>
    </Button>
  );
}
