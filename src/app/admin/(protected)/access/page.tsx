"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AdminDetailSheet,
  AdminEmptyState,
  AdminPageHeader,
  AdminStatusBadge,
} from "@/components/admin/AdminPrimitives";
import { useAdminIdentity } from "@/components/admin/AdminShell";
import { Button } from "@/components/ui/button";
import { AdminAccessStatusDialog } from "@/features/admin-access/components/AdminAccessStatusDialog";
import { formatAdminDateTime, toTitleCase } from "@/lib/admin-format";
import { adminAccessApi, type AdminAccessStatus, type AdminUserRecord } from "@/services/admin/access";
import { adminIdentityHasPermission } from "@/services/admin/session";
import { ApiError } from "@/services/api";

const SESSION_EXPIRED_MESSAGE = "Your session is no longer authorized. Sign in again to view the admin directory.";

function getAdminName(admin: AdminUserRecord) {
  return [admin.firstName, admin.lastName].filter(Boolean).join(" ") || "Administrator";
}

export default function AdminAccessPage() {
  const identity = useAdminIdentity();
  const authorizedIdentity = adminIdentityHasPermission(identity, "view_all_users") ? identity : null;

  return (
    <div className="mx-auto max-w-[96rem] space-y-5 pb-12">
      <AdminPageHeader title="Access Control" description="Manage administrator identities and roles." />
      {authorizedIdentity ? (
        <AdminDirectory
          key={JSON.stringify([
            authorizedIdentity.id,
            authorizedIdentity.claims.role,
            authorizedIdentity.claims.issuedAt,
            [...authorizedIdentity.claims.permissions].sort(),
          ])}
          actorId={authorizedIdentity.id}
          canChangeStatus={authorizedIdentity.claims.role === "SUPER_ADMIN" && adminIdentityHasPermission(authorizedIdentity, "edit_users")}
        />
      ) : (
        <p role="alert" className="p-4 text-sm text-rose-700">You do not have permission to view the admin directory.</p>
      )}
    </div>
  );
}

/** Keyed by authenticated authority so an identity change never renders a previous directory or decision. */
function AdminDirectory({ actorId, canChangeStatus }: { actorId: string; canChangeStatus: boolean }) {
  const [admins, setAdmins] = useState<AdminUserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [failure, setFailure] = useState<{ message: string; signInRequired?: boolean } | null>(null);
  const [selectedAdminId, setSelectedAdminId] = useState<string | null>(null);
  const [refreshRequired, setRefreshRequired] = useState(false);
  const listRequest = useRef<AbortController | null>(null);
  const selectedAdmin = admins.find((admin) => admin.id === selectedAdminId);

  const fetchAdminsList = useCallback(async () => {
    if (listRequest.current) return;
    const controller = new AbortController();
    listRequest.current = controller;

    try {
      const result = await adminAccessApi.fetchAdmins(controller.signal);
      if (controller.signal.aborted) return;
      setAdmins(result);
      setSelectedAdminId((current) => result.some((admin) => admin.id === current) ? current : null);
      setRefreshRequired(false);
      setFailure(null);
    } catch (error) {
      if (controller.signal.aborted) return;
      const status = error instanceof ApiError ? error.status : null;
      // An unconfirmed directory is not a safe basis for another access decision.
      setAdmins([]);
      setSelectedAdminId(null);
      setFailure(status === 401
        ? { message: SESSION_EXPIRED_MESSAGE, signInRequired: true }
        : { message: status === 403
          ? "The server denied access to the admin directory."
          : "The admin directory could not be refreshed. Try again." });
    } finally {
      if (listRequest.current === controller) {
        listRequest.current = null;
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void fetchAdminsList();
    return () => {
      listRequest.current?.abort();
      listRequest.current = null;
    };
  }, [fetchAdminsList]);

  function handleConfirmed(status: AdminAccessStatus) {
    setAdmins((current) => current.map((admin) =>
      admin.id === status.id ? { ...admin, isActive: status.isActive } : admin,
    ));
  }

  function handleSessionExpired() {
    listRequest.current?.abort();
    listRequest.current = null;
    setAdmins([]);
    setSelectedAdminId(null);
    setLoading(false);
    setFailure({ message: SESSION_EXPIRED_MESSAGE, signInRequired: true });
  }

  function handleRefresh() {
    setLoading(true);
    void fetchAdminsList();
  }

  const recovery = (failure || refreshRequired) ? (
    <div className="space-y-2 rounded-lg bg-rose-50 p-3 text-sm text-rose-800">
      <p role="alert">{failure?.message ?? "Refresh admins to confirm the current access status before making another change."}</p>
      {!failure?.signInRequired ? (
        <Button type="button" variant="outline" disabled={loading} onClick={handleRefresh}>
          Refresh admins
        </Button>
      ) : null}
    </div>
  ) : null;

  return (
    <>
      {!selectedAdmin ? recovery : null}
      {!failure || admins.length > 0 ? (
        <div className="overflow-hidden rounded-3xl border border-white/70 bg-white/80 shadow-xl shadow-zinc-900/5 backdrop-blur-xl">
          <div className="overflow-x-auto">
            <table className="w-full table-fixed text-sm md:min-w-[640px] md:table-auto">
              <thead>
                <tr className="bg-zinc-50 text-left text-xs font-black uppercase tracking-wider text-zinc-500">
                  <th className="rounded-tl-3xl px-4 py-4 md:px-5">Administrator</th>
                  <th className="hidden px-5 py-4 md:table-cell">Role</th>
                  <th className="w-24 px-3 py-4 md:w-auto md:px-5">Status</th>
                  <th className="hidden rounded-tr-3xl px-5 py-4 md:table-cell">Joined</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {loading && admins.length === 0 ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={`loading-${i}`}>
                      <td colSpan={4} className="px-5 py-4">
                        <div className="h-10 w-full animate-pulse rounded-xl bg-zinc-200/50" />
                      </td>
                    </tr>
                  ))
                ) : admins.length === 0 ? (
                  <tr>
                    <td colSpan={4}>
                      <AdminEmptyState title="No admins found" description="No administrator accounts match the query." />
                    </td>
                  </tr>
                ) : (
                  admins.map((admin) => (
                    <tr
                      key={admin.id}
                      onClick={() => setSelectedAdminId(admin.id)}
                      className="cursor-pointer transition-colors hover:bg-zinc-50"
                    >
                      <td className="px-4 py-4 md:px-5">
                        <button
                          type="button"
                          aria-haspopup="dialog"
                          className="max-w-full rounded-sm text-left font-black text-zinc-950 [overflow-wrap:anywhere] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
                          onClick={(event) => {
                            event.stopPropagation();
                            setSelectedAdminId(admin.id);
                          }}
                        >
                          {getAdminName(admin)}
                        </button>
                        <p className="text-xs font-semibold text-zinc-500 [overflow-wrap:anywhere]">{admin.email}</p>
                        <p className="mt-1 text-xs font-bold text-zinc-700 md:hidden">{admin.role.replace(/_/g, " ")}</p>
                      </td>
                      <td className="hidden px-5 py-4 md:table-cell">
                        <span className="text-xs font-bold uppercase tracking-wider text-zinc-700">
                          {admin.role.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="px-3 py-4 md:px-5">
                        <AdminStatusBadge tone={admin.isActive ? "emerald" : "rose"}>
                          {admin.isActive ? "Active" : "Revoked"}
                        </AdminStatusBadge>
                      </td>
                      <td className="hidden px-5 py-4 text-sm font-bold text-zinc-700 md:table-cell">{formatAdminDateTime(admin.createdAt)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      <AdminDetailSheet
        open={Boolean(selectedAdmin)}
        onOpenChange={(open) => { if (!open) setSelectedAdminId(null); }}
        title={selectedAdmin ? "Administrator Context" : "Loading..."}
        description={selectedAdmin ? [selectedAdmin.email, selectedAdmin.isActive ? "Active" : "Revoked"].filter(Boolean).join(" · ") : "Select an admin to view details."}
        contentClassName="data-[side=right]:w-full data-[side=right]:sm:max-w-xl [&_[data-slot=sheet-header]]:pr-14 [&_[data-slot=sheet-description]]:[overflow-wrap:anywhere] [&>[data-slot=sheet-close]]:text-white [&>[data-slot=sheet-close]]:hover:bg-white/10 [&>[data-slot=sheet-close]]:hover:text-white"
        bodyClassName="min-h-0 overscroll-contain"
      >
        {selectedAdmin ? (
          <div className="space-y-4">
            <div className="rounded-3xl border border-zinc-100 bg-white p-4">
              <h3 className="text-sm font-black text-zinc-950">Identity Snapshot</h3>
              <div className="mt-3 grid gap-2 text-sm text-zinc-700 [overflow-wrap:anywhere]">
                <p><strong>Name:</strong> {getAdminName(selectedAdmin)}</p>
                {selectedAdmin.email ? <p><strong>Email:</strong> {selectedAdmin.email}</p> : null}
                <p><strong>Role:</strong> {toTitleCase(selectedAdmin.role.replace(/_/g, " "))}</p>
                <p><strong>Joined:</strong> {formatAdminDateTime(selectedAdmin.createdAt)}</p>
              </div>
            </div>

            {recovery}
            {canChangeStatus && actorId !== selectedAdmin.id && selectedAdmin.role !== "SUPER_ADMIN" ? (
              <div className="rounded-3xl border border-sky-200 bg-sky-50/60 p-4">
                <h3 className="text-sm font-black text-sky-950">Security Control</h3>
                <div className="mt-4">
                  <AdminAccessStatusDialog
                    key={selectedAdmin.id}
                    target={selectedAdmin}
                    targetName={getAdminName(selectedAdmin)}
                    blocked={loading || refreshRequired || failure !== null}
                    onConfirmed={handleConfirmed}
                    onRefreshRequired={() => setRefreshRequired(true)}
                    onSessionExpired={handleSessionExpired}
                  />
                </div>
              </div>
            ) : null}
          </div>
        ) : (
          <AdminEmptyState title="No admin selected" description="Select an account from the directory." />
        )}
      </AdminDetailSheet>
    </>
  );
}
