"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BarChart3, CalendarClock, Download, FileSpreadsheet, FileText, Save, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import {
  AdminEmptyState,
  AdminMetricCard,
  AdminPageHeader,
  AdminStatusBadge,
  AdminToolbar,
  type AdminTone,
} from "@/components/admin/AdminPrimitives";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { formatAdminCurrency, formatAdminDateTime, toTitleCase } from "@/lib/admin-format";
import { recordAdminAudit } from "@/services/admin/audit";
import {
  adminReportsApi,
  type AdminReportsWorkspace,
  type GeneratedReport,
  type ReportAudience,
  type ReportFormat,
  type ReportPreset,
} from "@/services/admin/reports";
import { adminIdentityHasPermission } from "@/services/admin/session";
import { useAdminIdentity } from "@/components/admin/AdminShell";

type ExportJob = {
  id: string;
  title: string;
  format: ReportFormat;
  status: "queued" | "downloaded";
  createdAt: string;
};

type ReportJob = {
  id: string;
  label: string;
  meta: string;
  status: "generated" | "scheduled" | "queued" | "downloaded";
  createdAt: string;
};

const emptyWorkspace: AdminReportsWorkspace = {
  presets: [],
  snapshot: {
    gmv: 0,
    netRevenue: 0,
    orders: 0,
    activeSellers: 0,
    disputeRate: 0,
    payoutLiability: 0,
  },
  exports: [],
};

const audienceTone: Record<ReportAudience, AdminTone> = {
  executive: "indigo",
  investor: "emerald",
  finance: "amber",
  operations: "sky",
};

export default function AdminReportsPage() {
  const [workspace, setWorkspace] = useState<AdminReportsWorkspace>(emptyWorkspace);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState("last_30_days");
  const [audienceFilter, setAudienceFilter] = useState<ReportAudience | "all">("all");
  const [selectedPresetId, setSelectedPresetId] = useState("");
  const [newPresetName, setNewPresetName] = useState("");
  const [newPresetAudience, setNewPresetAudience] = useState<ReportAudience>("executive");
  const [generatedReports, setGeneratedReports] = useState<GeneratedReport[]>([]);
  const [exportJobs, setExportJobs] = useState<ExportJob[]>([]);
  const [scheduledReports, setScheduledReports] = useState<ReportJob[]>([]);
  const [isJobsModalOpen, setIsJobsModalOpen] = useState(false);
  const [isMutating, setIsMutating] = useState(false);

  const identity = useAdminIdentity()!;
  const canViewReports = adminIdentityHasPermission(identity, "view_financial_reports");
  const canExportReports = adminIdentityHasPermission(identity, "export_reports");

  const loadWorkspace = useCallback(async () => {
    try {
      setLoading(true);
      const nextWorkspace = await adminReportsApi.fetchWorkspace();
      setWorkspace(nextWorkspace);
      setSelectedPresetId(nextWorkspace.presets[0]?.id ?? "");
    } catch {
      toast.error("Failed to load reports workspace.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadWorkspace(); }, [loadWorkspace]);

  const filteredPresets = useMemo(() => {
    return workspace.presets.filter((preset) => audienceFilter === "all" || preset.audience === audienceFilter);
  }, [audienceFilter, workspace.presets]);

  const selectedPreset = useMemo(() => {
    return workspace.presets.find((preset) => preset.id === selectedPresetId) ?? workspace.presets[0] ?? null;
  }, [selectedPresetId, workspace.presets]);

  const reportJobs = useMemo<ReportJob[]>(() => {
    const generated = generatedReports.map((report) => ({
      id: `generated-${report.id}`,
      label: `${report.id} · ${toTitleCase(report.audience)}`,
      meta: `${toTitleCase(report.dateRange)} · ${formatAdminDateTime(report.generatedAt)}`,
      status: "generated" as const,
      createdAt: report.generatedAt,
    }));
    const exports = exportJobs.map((job) => ({
      id: `export-${job.id}`,
      label: `${job.title} · ${job.format.toUpperCase()}`,
      meta: `${toTitleCase(job.status)} · ${formatAdminDateTime(job.createdAt)}`,
      status: job.status,
      createdAt: job.createdAt,
    }));
    return [...generated, ...scheduledReports, ...exports]
      .sort((first, second) => new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime());
  }, [exportJobs, generatedReports, scheduledReports]);

  const generateReport = async (preset: ReportPreset) => {
    try {
      setIsMutating(true);
      const generated = await adminReportsApi.generateReport(preset.id, preset.audience, dateRange);
      await recordAdminAudit({
        actorId: identity.id,
        action: "report_generated",
        target: preset.id,
        note: dateRange,
      });
      setGeneratedReports((current) => [generated, ...current]);
      toast.success(`${preset.name} generated.`);
    } catch {
      toast.error("Failed to generate report.");
    } finally {
      setIsMutating(false);
    }
  };

  const savePreset = async () => {
    if (!newPresetName.trim()) return toast.error("Preset name is required.");

    try {
      setIsMutating(true);
      const preset = await adminReportsApi.savePreset(newPresetName.trim(), newPresetAudience);
      await recordAdminAudit({
        actorId: identity.id,
        action: "report_preset_saved",
        target: preset.id,
        note: preset.name,
      });
      setWorkspace((current) => ({ ...current, presets: [preset, ...current.presets] }));
      setSelectedPresetId(preset.id);
      setNewPresetName("");
      toast.success("Report preset saved.");
    } catch {
      toast.error("Failed to save report preset.");
    } finally {
      setIsMutating(false);
    }
  };

  const exportSummary = (title: string, format: ReportFormat) => {
    if (!canExportReports) {
      toast.error("You do not have permission to export reports.");
      return;
    }

    const job: ExportJob = {
      id: `EXPJOB-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title,
      format,
      status: format === "csv" ? "downloaded" : "queued",
      createdAt: new Date().toISOString(),
    };

    if (format === "csv") {
      const csv = [
        ["metric", "value"],
        ["gmv", String(workspace.snapshot.gmv)],
        ["net_revenue", String(workspace.snapshot.netRevenue)],
        ["orders", String(workspace.snapshot.orders)],
        ["active_sellers", String(workspace.snapshot.activeSellers)],
        ["dispute_rate", String(workspace.snapshot.disputeRate)],
        ["payout_liability", String(workspace.snapshot.payoutLiability)],
      ].map((row) => row.join(",")).join("\n");
      const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `zogular-report-${new Date().toISOString().slice(0, 10)}.csv`;
      anchor.click();
      URL.revokeObjectURL(url);
      toast.success("CSV export downloaded.");
    } else {
      toast.success("PDF export job queued.");
    }

    setExportJobs((current) => [job, ...current]);
    void recordAdminAudit({
      actorId: identity.id,
      action: `report_export_${format}`,
      target: title,
      severity: "warning",
    });
  };

  const scheduleReport = (preset: ReportPreset) => {
    const createdAt = new Date().toISOString();
    const job: ReportJob = {
      id: `schedule-${preset.id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      label: preset.name,
      meta: `${toTitleCase(dateRange)} · scheduled ${formatAdminDateTime(createdAt)}`,
      status: "scheduled",
      createdAt,
    };
    setScheduledReports((current) => [job, ...current]);
    toast.success("Report schedule saved.");
  };

  if (!canViewReports) {
    return <AdminEmptyState title="Access denied" description="Your admin role cannot view executive reports." />;
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Reports"
        description="Executive and investor-safe reporting with presets, KPI snapshots, exports, and schedule-ready flows."
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
        <AdminMetricCard title="GMV" value={formatAdminCurrency(workspace.snapshot.gmv)} note="Selected period snapshot" icon={<BarChart3 className="h-5 w-5" />} tone="emerald" />
        <AdminMetricCard title="Net revenue" value={formatAdminCurrency(workspace.snapshot.netRevenue)} note="Platform revenue snapshot" icon={<FileSpreadsheet className="h-5 w-5" />} tone="indigo" />
        <AdminMetricCard title="Orders" value={workspace.snapshot.orders} note="Completed and active orders" icon={<FileText className="h-5 w-5" />} tone="sky" />
        <AdminMetricCard title="Dispute rate" value={`${workspace.snapshot.disputeRate}%`} note="Investor-safe risk signal" icon={<ShieldCheck className="h-5 w-5" />} tone="amber" />
      </div>

      <AdminToolbar>
        <select value={dateRange} onChange={(event) => setDateRange(event.target.value)} className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm font-bold text-zinc-700 shadow-sm">
          <option value="last_7_days">Last 7 days</option>
          <option value="last_30_days">Last 30 days</option>
          <option value="month_to_date">Month to date</option>
          <option value="quarter_to_date">Quarter to date</option>
        </select>
        <select value={audienceFilter} onChange={(event) => setAudienceFilter(event.target.value as ReportAudience | "all")} className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm font-bold text-zinc-700 shadow-sm">
          <option value="all">All audiences</option>
          <option value="executive">Executive</option>
          <option value="investor">Investor</option>
          <option value="finance">Finance</option>
          <option value="operations">Operations</option>
        </select>
        <select value={selectedPresetId} onChange={(event) => setSelectedPresetId(event.target.value)} className="h-11 flex-1 rounded-xl border border-zinc-200 bg-white px-3 text-sm font-bold text-zinc-700 shadow-sm">
          {workspace.presets.map((preset) => <option key={preset.id} value={preset.id}>{preset.name}</option>)}
        </select>
        <Button disabled={!selectedPreset || isMutating} onClick={() => selectedPreset && generateReport(selectedPreset)} className="rounded-xl bg-zinc-950 font-black text-white hover:bg-zinc-800">
          Generate report
        </Button>
      </AdminToolbar>

      {loading ? (
        <section className="rounded-3xl border border-white/70 bg-white/80 p-12 text-center text-sm font-bold text-zinc-500 shadow-xl shadow-zinc-900/5">Loading report workspace...</section>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <section className="rounded-3xl border border-white/70 bg-white/80 p-5 shadow-xl shadow-zinc-900/5 backdrop-blur-xl">
            <h2 className="text-lg font-black text-zinc-950">Report presets</h2>
            <p className="text-sm font-bold text-zinc-500">Generate leadership, finance, operations, and investor-safe summaries.</p>
            <div className="mt-4 space-y-3">
              {filteredPresets.length === 0 ? (
                <AdminEmptyState title="No presets match this audience" />
              ) : filteredPresets.map((preset) => (
                <div key={preset.id} className="rounded-3xl border border-zinc-100 bg-white p-4 transition hover:bg-emerald-50/50">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="font-black text-zinc-950">{preset.name}</p>
                      <p className="text-xs font-bold text-zinc-500">{toTitleCase(preset.cadence)} · last generated {formatAdminDateTime(preset.lastGeneratedAt)}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <AdminStatusBadge tone={audienceTone[preset.audience]}>{preset.audience}</AdminStatusBadge>
                      {preset.includesFinancials ? <AdminStatusBadge tone="amber">Financials</AdminStatusBadge> : <AdminStatusBadge tone="emerald">Investor-safe</AdminStatusBadge>}
                      <Button disabled={isMutating} variant="outline" onClick={() => generateReport(preset)} className="rounded-xl font-black">Generate</Button>
                      <Button disabled={isMutating} variant="outline" onClick={() => scheduleReport(preset)} className="rounded-xl font-black">
                        <CalendarClock className="mr-2 h-4 w-4" /> Schedule
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <div className="space-y-6">
            <section className="rounded-3xl border border-white/70 bg-white/80 p-5 shadow-xl shadow-zinc-900/5 backdrop-blur-xl">
              <h2 className="text-lg font-black text-zinc-950">Save preset</h2>
              <div className="mt-4 space-y-3">
                <Input value={newPresetName} onChange={(event) => setNewPresetName(event.target.value)} placeholder="Preset name" className="h-11 rounded-xl border-zinc-200 bg-white" />
                <select value={newPresetAudience} onChange={(event) => setNewPresetAudience(event.target.value as ReportAudience)} className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm font-bold text-zinc-700 shadow-sm">
                  <option value="executive">Executive</option>
                  <option value="investor">Investor</option>
                  <option value="finance">Finance</option>
                  <option value="operations">Operations</option>
                </select>
                <Button onClick={savePreset} disabled={isMutating} className="w-full rounded-xl bg-zinc-950 font-black text-white hover:bg-zinc-800">
                  <Save className="mr-2 h-4 w-4" /> Save preset
                </Button>
              </div>
            </section>

            <section className="rounded-3xl border border-white/70 bg-white/80 p-5 shadow-xl shadow-zinc-900/5 backdrop-blur-xl">
              <h2 className="text-lg font-black text-zinc-950">Exports</h2>
              <div className="mt-4 space-y-3">
                {workspace.exports.map((panel) => (
                  <div key={panel.id} className="rounded-3xl border border-zinc-100 bg-white p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-black text-zinc-950">{panel.title}</p>
                        <p className="mt-1 text-sm text-zinc-600">{panel.description}</p>
                        <p className="mt-2 text-xs font-bold text-zinc-500">{panel.permissionHint}</p>
                      </div>
                      <Button disabled={!canExportReports} onClick={() => exportSummary(panel.title, panel.format)} className="rounded-xl bg-emerald-600 font-black text-white hover:bg-emerald-700">
                        <Download className="mr-2 h-4 w-4" /> {panel.format.toUpperCase()}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-3xl border border-zinc-200 bg-zinc-950 p-5 text-white shadow-2xl shadow-zinc-950/20">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-black">Recent report jobs</h2>
                  <p className="mt-1 text-xs font-bold text-zinc-500">Latest jobs stay bounded; full history opens separately.</p>
                </div>
                {reportJobs.length > 6 ? (
                  <button type="button" onClick={() => setIsJobsModalOpen(true)} className="rounded-full border border-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-emerald-300 transition hover:bg-white/10">
                    View all
                  </button>
                ) : null}
              </div>
              <div className="mt-4 max-h-80 space-y-3 overflow-y-auto pr-1 overscroll-contain">
                {reportJobs.slice(0, 6).map((job) => (
                  <div key={job.id} className="rounded-2xl border border-white/10 bg-white/7 p-3 text-sm font-bold text-zinc-300">
                    <p>{job.label}</p>
                    <p className="mt-1 text-[10px] font-black uppercase tracking-wider text-zinc-500">{job.meta}</p>
                  </div>
                ))}
                {reportJobs.length === 0 ? (
                  <p className="rounded-2xl border border-white/10 bg-white/7 p-3 text-sm font-bold text-zinc-400">No report jobs yet.</p>
                ) : null}
              </div>
            </section>
          </div>
        </div>
      )}

      <Dialog open={isJobsModalOpen} onOpenChange={setIsJobsModalOpen}>
        <DialogContent className="max-w-2xl rounded-3xl border border-white/70 bg-white/95 p-0 shadow-2xl shadow-zinc-950/20 backdrop-blur-xl">
          <DialogHeader className="border-b border-zinc-100 px-6 py-5">
            <DialogTitle className="text-xl font-black text-zinc-950">Report Job History</DialogTitle>
            <DialogDescription className="text-sm font-bold text-zinc-500">
              Generated, scheduled, and export jobs. This dialog is intentionally scroll-bounded for large histories.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[70vh] space-y-3 overflow-y-auto p-6 overscroll-contain">
            {reportJobs.map((job) => (
              <div key={job.id} className="rounded-2xl border border-zinc-100 bg-zinc-50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-black text-zinc-950">{job.label}</p>
                    <p className="mt-1 text-xs font-bold text-zinc-500">{job.meta}</p>
                  </div>
                  <AdminStatusBadge tone={job.status === "downloaded" || job.status === "generated" ? "emerald" : job.status === "scheduled" ? "sky" : "amber"}>
                    {job.status}
                  </AdminStatusBadge>
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
