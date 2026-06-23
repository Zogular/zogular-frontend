"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, Bell, ClipboardList, Flag, Save, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import {
  AdminEmptyState,
  AdminMetricCard,
  AdminPageHeader,
  AdminSearchField,
  AdminStatusBadge,
  AdminToolbar,
  type AdminTone,
} from "@/components/admin/AdminPrimitives";
import { FeaturePendingNotice } from "@/components/shared/FeaturePendingNotice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatAdminDateTime, toTitleCase } from "@/lib/admin-format";
import { BACKEND_INTEGRATION_PENDING_MESSAGE } from "@/services/backend-pending";
import { recordAdminAudit } from "@/services/admin/audit";
import {
  adminSystemApi,
  type AdminSystemAuditLog,
  type AdminSystemWorkspace,
  type FeatureFlagRecord,
  type FeatureFlagStatus,
  type HealthStatus,
  type PlatformConfigRecord,
} from "@/services/admin/system";
import { adminHasPermission, CURRENT_ADMIN_IDENTITY } from "@/services/admin/session";

const emptyWorkspace: AdminSystemWorkspace = {
  auditLogs: [],
  featureFlags: [],
  configs: [],
  notices: [],
  health: [],
};

const severityTone: Record<AdminSystemAuditLog["severity"], AdminTone> = {
  info: "indigo",
  warning: "amber",
  critical: "rose",
};

const healthTone: Record<HealthStatus, AdminTone> = {
  healthy: "emerald",
  degraded: "amber",
  attention: "rose",
};

const ADMIN_SYSTEM_BACKEND_PENDING = true;

export default function AdminSystemPage() {
  const [workspace, setWorkspace] = useState<AdminSystemWorkspace>(emptyWorkspace);
  const [loading, setLoading] = useState(true);
  const [logSearch, setLogSearch] = useState("");
  const [severityFilter, setSeverityFilter] = useState<AdminSystemAuditLog["severity"] | "all">("all");
  const [configDrafts, setConfigDrafts] = useState<Record<string, string>>({});
  const [noticeTitle, setNoticeTitle] = useState("");
  const [noticeBody, setNoticeBody] = useState("");
  const [isMutating, setIsMutating] = useState(false);

  const canViewLogs = adminHasPermission("view_system_logs");
  const canConfigure = adminHasPermission("configure_platform");
  const canAccess = canViewLogs || canConfigure;

  const loadWorkspace = useCallback(async () => {
    try {
      setLoading(true);
      const nextWorkspace = await adminSystemApi.fetchWorkspace();
      setWorkspace(nextWorkspace);
      setConfigDrafts(Object.fromEntries(nextWorkspace.configs.map((config) => [config.id, config.value])));
    } catch {
      toast.error("Failed to load system workspace.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadWorkspace(); }, [loadWorkspace]);

  const filteredLogs = useMemo(() => {
    const normalizedSearch = logSearch.trim().toLowerCase();
    return workspace.auditLogs.filter((log) => {
      const matchesSearch = !normalizedSearch || [log.id, log.actor, log.action, log.target]
        .some((value) => value.toLowerCase().includes(normalizedSearch));
      const matchesSeverity = severityFilter === "all" || log.severity === severityFilter;
      return matchesSearch && matchesSeverity;
    });
  }, [logSearch, severityFilter, workspace.auditLogs]);

  const metrics = useMemo(() => {
    const enabledFlags = workspace.featureFlags.filter((flag) => flag.status === "enabled").length;
    const criticalLogs = workspace.auditLogs.filter((log) => log.severity === "critical").length;
    const attentionHealth = workspace.health.filter((widget) => widget.status !== "healthy").length;
    return { enabledFlags, criticalLogs, attentionHealth };
  }, [workspace]);

  const toggleFlag = async (flag: FeatureFlagRecord) => {
    if (!canConfigure) return toast.error("You do not have permission to toggle platform flags.");
    const nextStatus: FeatureFlagStatus = flag.status === "enabled" ? "disabled" : "enabled";

    try {
      setIsMutating(true);
      await adminSystemApi.toggleFeatureFlag(flag.id, nextStatus);
      await recordAdminAudit({
        actorId: CURRENT_ADMIN_IDENTITY.id,
        action: `feature_flag_${nextStatus}`,
        target: flag.key,
        severity: "warning",
      });
      setWorkspace((current) => ({
        ...current,
        featureFlags: current.featureFlags.map((item) => item.id === flag.id ? { ...item, status: nextStatus, updatedAt: new Date().toISOString() } : item),
      }));
      toast.success(`${flag.name} ${nextStatus}.`);
    } catch {
      toast.error("Failed to update feature flag.");
    } finally {
      setIsMutating(false);
    }
  };

  const saveConfig = async (config: PlatformConfigRecord) => {
    if (!canConfigure) return toast.error("You do not have permission to edit platform config.");
    const nextValue = configDrafts[config.id]?.trim();
    if (!nextValue) return toast.error("Config value cannot be empty.");

    try {
      setIsMutating(true);
      await adminSystemApi.updateConfig(config.id, nextValue);
      await recordAdminAudit({
        actorId: CURRENT_ADMIN_IDENTITY.id,
        action: "platform_config_updated",
        target: config.key,
        severity: "critical",
        note: `${config.value} -> ${nextValue}`,
      });
      setWorkspace((current) => ({
        ...current,
        configs: current.configs.map((item) => item.id === config.id ? { ...item, value: nextValue } : item),
      }));
      toast.success(`${config.label} updated.`);
    } catch {
      toast.error("Failed to update platform config.");
    } finally {
      setIsMutating(false);
    }
  };

  const publishNotice = async () => {
    if (!canConfigure) return toast.error("You do not have permission to publish operational notices.");
    if (!noticeTitle.trim() || !noticeBody.trim()) return toast.error("Notice title and body are required.");

    try {
      setIsMutating(true);
      const notice = await adminSystemApi.publishNotice({ title: noticeTitle.trim(), body: noticeBody.trim() });
      await recordAdminAudit({
        actorId: CURRENT_ADMIN_IDENTITY.id,
        action: "ops_notice_published",
        target: notice.id,
        severity: "warning",
      });
      setWorkspace((current) => ({ ...current, notices: [notice, ...current.notices] }));
      setNoticeTitle("");
      setNoticeBody("");
      toast.success("Operational notice published.");
    } catch {
      toast.error("Failed to publish notice.");
    } finally {
      setIsMutating(false);
    }
  };

  if (!canAccess) {
    return <AdminEmptyState title="Access denied" description="Your admin role cannot access system operations." />;
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Platform System"
        description="Operations-only preview for audit logs, feature flags, platform configs, operational notices, and environment health."
      />

      <FeaturePendingNotice
        title="System actions disabled"
        description="Backend integration pending. Feature flags, platform config saves, and operational notice publishing are disabled until backend support is implemented."
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
        <AdminMetricCard title="Audit logs" value={workspace.auditLogs.length} note="Sensitive action trail" icon={<ClipboardList className="h-5 w-5" />} tone="indigo" />
        <AdminMetricCard title="Enabled flags" value={metrics.enabledFlags} note="Active operational controls" icon={<Flag className="h-5 w-5" />} tone="emerald" />
        <AdminMetricCard title="Critical logs" value={metrics.criticalLogs} note="Requires governance review" icon={<ShieldAlert className="h-5 w-5" />} tone="rose" />
        <AdminMetricCard title="Health alerts" value={metrics.attentionHealth} note="System widgets not green" icon={<Activity className="h-5 w-5" />} tone={metrics.attentionHealth ? "amber" : "emerald"} />
      </div>

      {loading ? (
        <section className="rounded-3xl border border-white/70 bg-white/80 p-12 text-center text-sm font-bold text-zinc-500 shadow-xl shadow-zinc-900/5">Loading system controls...</section>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-6">
            {canViewLogs ? (
              <section className="overflow-hidden rounded-3xl border border-white/70 bg-white/80 shadow-xl shadow-zinc-900/5 backdrop-blur-xl">
                <div className="border-b border-zinc-100 p-5">
                  <h2 className="text-lg font-black text-zinc-950">Audit logs</h2>
                  <p className="text-sm font-bold text-zinc-500">Filter sensitive actions by actor, target, action, and severity.</p>
                  <AdminToolbar>
                    <AdminSearchField value={logSearch} onChange={setLogSearch} placeholder="Search logs, actors, actions, or targets" className="flex-1" />
                    <select value={severityFilter} onChange={(event) => setSeverityFilter(event.target.value as AdminSystemAuditLog["severity"] | "all")} className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm font-bold text-zinc-700 shadow-sm">
                      <option value="all">All severities</option>
                      <option value="info">Info</option>
                      <option value="warning">Warning</option>
                      <option value="critical">Critical</option>
                    </select>
                  </AdminToolbar>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[780px] text-left text-sm">
                    <thead className="bg-zinc-950 text-[11px] uppercase tracking-wider text-zinc-300">
                      <tr>
                        <th className="px-5 py-4 font-black">Action</th>
                        <th className="px-5 py-4 font-black">Actor</th>
                        <th className="px-5 py-4 font-black">Target</th>
                        <th className="px-5 py-4 font-black">Severity</th>
                        <th className="px-5 py-4 font-black">Time</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {filteredLogs.length === 0 ? (
                        <tr><td colSpan={5}><AdminEmptyState title="No logs match this filter" /></td></tr>
                      ) : filteredLogs.map((log) => (
                        <tr key={log.id} className="bg-white/55 transition-colors hover:bg-indigo-50/60">
                          <td className="px-5 py-4 font-black text-zinc-950">{toTitleCase(log.action)}</td>
                          <td className="px-5 py-4 font-bold text-zinc-700">{log.actor}</td>
                          <td className="px-5 py-4 font-bold text-zinc-600">{log.target}</td>
                          <td className="px-5 py-4"><AdminStatusBadge tone={severityTone[log.severity]}>{log.severity}</AdminStatusBadge></td>
                          <td className="px-5 py-4 text-xs font-bold text-zinc-500">{formatAdminDateTime(log.timestamp)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            ) : null}

            <section className="rounded-3xl border border-white/70 bg-white/80 p-5 shadow-xl shadow-zinc-900/5 backdrop-blur-xl">
              <h2 className="text-lg font-black text-zinc-950">Feature flags</h2>
              <p className="text-sm font-bold text-zinc-500">Toggle future operational surfaces without blocking trust, governance, or shipping extensions.</p>
              <div className="mt-4 space-y-3">
                {workspace.featureFlags.map((flag) => (
                  <div key={flag.id} className="flex flex-col gap-3 rounded-3xl border border-zinc-100 bg-white p-4 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="font-black text-zinc-950">{flag.name}</p>
                      <p className="text-xs font-bold text-zinc-500">{flag.key} · owner {flag.owner} · updated {formatAdminDateTime(flag.updatedAt)}</p>
                      <p className="mt-1 text-sm text-zinc-600">{flag.description}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <AdminStatusBadge tone={flag.status === "enabled" ? "emerald" : "zinc"}>{flag.status}</AdminStatusBadge>
                      <Button disabled={ADMIN_SYSTEM_BACKEND_PENDING || isMutating || !canConfigure} onClick={() => toggleFlag(flag)} className="rounded-xl bg-zinc-950 font-black text-white hover:bg-zinc-800">
                        Backend pending
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <div className="space-y-6">
            <section className="rounded-3xl border border-white/70 bg-white/80 p-5 shadow-xl shadow-zinc-900/5 backdrop-blur-xl">
              <h2 className="text-lg font-black text-zinc-950">System health</h2>
              <div className="mt-4 grid gap-3">
                {workspace.health.map((widget) => (
                  <div key={widget.id} className="rounded-3xl border border-zinc-100 bg-white p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-black text-zinc-950">{widget.label}</p>
                      <AdminStatusBadge tone={healthTone[widget.status]}>{widget.status}</AdminStatusBadge>
                    </div>
                    <p className="mt-2 text-sm font-bold text-zinc-500">{widget.detail}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-3xl border border-white/70 bg-white/80 p-5 shadow-xl shadow-zinc-900/5 backdrop-blur-xl">
              <h2 className="text-lg font-black text-zinc-950">Platform configs</h2>
              <p className="text-sm font-bold text-zinc-500">Editable operational values with audit-ready save actions.</p>
              <div className="mt-4 space-y-3">
                {workspace.configs.map((config) => (
                  <div key={config.id} className="rounded-3xl border border-zinc-100 bg-white p-4">
                    <p className="font-black text-zinc-950">{config.label}</p>
                    <p className="text-xs font-bold text-zinc-500">{config.key} · {config.valueType} · owner {config.owner}</p>
                    <div className="mt-3 flex gap-2">
                      <Input value={configDrafts[config.id] ?? config.value} onChange={(event) => setConfigDrafts((current) => ({ ...current, [config.id]: event.target.value }))} disabled={ADMIN_SYSTEM_BACKEND_PENDING} className="h-11 rounded-xl border-zinc-200 bg-white" />
                      <Button disabled={ADMIN_SYSTEM_BACKEND_PENDING || isMutating || !canConfigure || (configDrafts[config.id] ?? config.value) === config.value} onClick={() => saveConfig(config)} className="rounded-xl bg-zinc-950 font-black text-white hover:bg-zinc-800">
                        <Save className="mr-2 h-4 w-4" /> Backend pending
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-3xl border border-white/70 bg-white/80 p-5 shadow-xl shadow-zinc-900/5 backdrop-blur-xl">
              <h2 className="text-lg font-black text-zinc-950">Operational notice</h2>
              <div className="mt-4 space-y-3">
                <Input value={noticeTitle} onChange={(event) => setNoticeTitle(event.target.value)} placeholder={BACKEND_INTEGRATION_PENDING_MESSAGE} disabled={ADMIN_SYSTEM_BACKEND_PENDING} className="h-11 rounded-xl border-zinc-200 bg-white" />
                <Textarea value={noticeBody} onChange={(event) => setNoticeBody(event.target.value)} placeholder={BACKEND_INTEGRATION_PENDING_MESSAGE} disabled={ADMIN_SYSTEM_BACKEND_PENDING} className="min-h-24 rounded-2xl border-zinc-200 bg-white" />
                <Button disabled={ADMIN_SYSTEM_BACKEND_PENDING || isMutating || !canConfigure} onClick={publishNotice} className="w-full rounded-xl bg-emerald-600 font-black text-white hover:bg-emerald-700">
                  <Bell className="mr-2 h-4 w-4" /> Backend pending
                </Button>
              </div>
              <div className="mt-4 space-y-2">
                {workspace.notices.map((notice) => (
                  <div key={notice.id} className="rounded-2xl bg-zinc-50 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-black text-zinc-950">{notice.title}</p>
                      <AdminStatusBadge tone={notice.status === "published" ? "emerald" : "zinc"}>{notice.status}</AdminStatusBadge>
                    </div>
                    <p className="mt-1 text-xs font-bold text-zinc-500">{formatAdminDateTime(notice.updatedAt)}</p>
                    <p className="mt-2 text-sm text-zinc-600">{notice.body}</p>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
