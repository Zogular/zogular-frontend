"use client";

import { Plus, RefreshCw } from "lucide-react";
import { useAdminIdentity } from "@/components/admin/AdminShell";
import { Button } from "@/components/ui/button";
import { isCanonicalCampaignActor } from "@/services/admin/content";
import { adminIdentityHasPermission } from "@/services/admin/session";
import { campaignDestinationLabels, HomepageBannerEditor } from "./HomepageBannerEditor";
import { useHomepageBannerWorkspace } from "../hooks/useHomepageBannerWorkspace";

const stateLabels = { DRAFT: "Draft", PUBLISHED: "Published", PAUSED: "Paused" } as const;
const lusakaTime = new Intl.DateTimeFormat("en-ZM", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Lusaka" });

export function HomepageBannerWorkspace() {
  const identity = useAdminIdentity();
  if (!identity || !adminIdentityHasPermission(identity, "access_admin_panel") || !adminIdentityHasPermission(identity, "manage_content")) {
    return <CampaignAccessDenied />;
  }
  if (!isCanonicalCampaignActor(identity.id)) return <CampaignActorRefresh />;
  // issuedAt is generated on each authority read, not a session ID.
  const authority = JSON.stringify([identity.id, identity.claims.role, identity.claims.authStrength, [...identity.claims.permissions].sort()]);
  return <AuthorizedBannerWorkspace key={authority} authority={authority} expectedActor={identity.id} />;
}

function CampaignAccessDenied() {
  return <p role="alert" className="text-sm text-red-700">You no longer have access to homepage banners. Sign in with an authorized admin account.</p>;
}

function CampaignActorRefresh() {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <p role="alert" className="text-sm text-red-700">Refresh the page to verify your admin account. Review the latest banners before choosing another action.</p>
      <Button variant="outline" onClick={() => window.location.reload()}>Refresh page</Button>
    </div>
  );
}

function AuthorizedBannerWorkspace({ authority, expectedActor }: { authority: string; expectedActor: string }) {
  const {
    accessLoss, data, editor, editorIsStale, blocked, pending, checking, saving, listPending, listError, listFetching,
    createHold, recovery, reviewed, canUseReviewed, viewSubmittedEdit, verificationDraft, notice, readNotice, feedback,
    send, reload, acceptReviewedBanner, discardSubmittedEdit, openNewDraft, openEdit, closeEditor, openSubmittedDraft,
    openSubmittedEdit, closeSubmittedDraft, closeSubmittedEdit,
  } = useHomepageBannerWorkspace(authority, expectedActor);

  if (accessLoss === "refresh") return <CampaignActorRefresh />;
  if (accessLoss === "denied") return <CampaignAccessDenied />;

  return (
    <div className="mx-auto max-w-5xl min-w-0 space-y-5 pb-12 text-zinc-900">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Homepage banners</h1>
        <Button disabled={!data?.assets.length || blocked || Boolean(createHold)} onClick={openNewDraft}>
          <Plus aria-hidden="true" /> New draft
        </Button>
      </header>
      {listPending && <p role="status" className="text-sm text-zinc-700">Loading banners…</p>}
      {listError && <div className="flex flex-wrap items-center gap-3">
        <p role="alert" className="text-sm text-red-700">Banners could not be loaded.</p>
        <Button variant="outline" disabled={listFetching || pending || checking} onClick={() => void reload()}><RefreshCw aria-hidden="true" /> Retry</Button>
      </div>}
      {createHold && <div className="flex flex-wrap items-center gap-3">
        <p role="alert" className="text-sm text-red-700">We could not confirm whether the new draft was saved. A matching banner does not confirm this submission. New drafts are locked for this visit. Check the banner list before creating another draft on a later visit.</p>
        <Button variant="outline" disabled={pending} onClick={openSubmittedDraft}>View submitted draft</Button>
        {!recovery && <Button variant="outline" disabled={listFetching || pending || checking} onClick={() => void reload()}><RefreshCw aria-hidden="true" /> Reload banners</Button>}
      </div>}
      {recovery && <div className="space-y-2">
        <p role="alert" className="text-sm text-red-700">{recovery.reason === "conflict"
          ? "This banner changed or its schedule overlaps another banner. Check the latest banner before making another change."
          : recovery.reason === "missing"
            ? "The banner was not found. Check the latest banner before making another change."
            : "We could not confirm whether the banner change completed. Check the latest banner before making another change."}</p>
        {canUseReviewed && reviewed && <p role="status" className="text-sm">Latest banner: {reviewed.headline} ({stateLabels[reviewed.state]}). Review it before choosing a new action.</p>}
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" disabled={listFetching || checking} onClick={() => void reload()}><RefreshCw aria-hidden="true" /> Reload banners</Button>
          {recovery.submitted && <>
            <Button variant="outline" onClick={openSubmittedEdit}>View submitted edit</Button>
            <Button variant="outline" disabled={checking} onClick={discardSubmittedEdit}>Discard submitted edit</Button>
          </>}
          {canUseReviewed && !recovery.submitted && <Button variant="outline" disabled={listFetching || checking} onClick={() => acceptReviewedBanner()}>Use reviewed banner</Button>}
          {canUseReviewed && recovery.submitted && reviewed?.state === "DRAFT" && (
            <Button variant="outline" disabled={listFetching || checking} onClick={() => acceptReviewedBanner(true)}>Start new edit from reviewed banner</Button>
          )}
        </div>
        {canUseReviewed && recovery.submitted && reviewed?.state === "DRAFT" && <p className="text-sm text-zinc-700">Starting a new edit replaces the submitted copy with the latest saved values. Nothing will be sent until you save.</p>}
      </div>}
      {notice && <div className="flex flex-wrap items-center gap-3">
        <p role="alert" className="text-sm text-red-700">{notice}</p>
        {verificationDraft && !listError && <Button variant="outline" disabled={listFetching || pending || checking}
          onClick={() => void reload()}><RefreshCw aria-hidden="true" /> Reload banners</Button>}
      </div>}
      {verificationDraft && editorIsStale && <p role="status" className="text-sm">The saved draft changed. Keep a copy of these values, then open the latest draft before making another change.</p>}
      {readNotice && <p role="alert" className="text-sm text-red-700">{readNotice}</p>}
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
                    <p className="text-sm text-zinc-600">{stateLabels[banner.state]} · {campaignDestinationLabels[banner.destination]}</p>
                    <p className="text-xs text-zinc-600">{lusakaTime.format(Date.parse(banner.startsAt))} to {lusakaTime.format(Date.parse(banner.endsAt))} CAT</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {banner.state === "DRAFT" && <>
                      <Button variant="outline" disabled={blocked} onClick={() => openEdit(banner)}>Edit draft</Button>
                      <Button disabled={blocked || editor?.id === banner.id || !data.assets.some((asset) => asset.key === banner.assetKey)} onClick={() => void send({ action: "publish", banner })}>Publish</Button>
                    </>}
                    {banner.state === "PUBLISHED" && <Button variant="outline" disabled={blocked} onClick={() => void send({ action: "pause", banner })}>Pause</Button>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      {viewSubmittedEdit && recovery?.submitted ? (
        <HomepageBannerEditor key="submitted-edit" banner={recovery.target} submitted={recovery.submitted.input}
          assets={recovery.submitted.asset ? [recovery.submitted.asset] : []}
          disabled saving={false} onClose={closeSubmittedEdit} />
      ) : editor === null && createHold ? (
        <HomepageBannerEditor key="submitted" banner={null} submitted={createHold.input} assets={createHold.asset ? [createHold.asset] : []}
          disabled saving={false} onClose={closeSubmittedDraft} />
      ) : editor !== undefined && (data || verificationDraft) && (
        <HomepageBannerEditor key={editor ? `${editor.id}:${editor.version}` : "new"} banner={editor} initialInput={verificationDraft?.input}
          assets={data?.assets ?? (verificationDraft?.asset ? [verificationDraft.asset] : [])}
          disabled={blocked || !data || editorIsStale} saving={saving} onSave={(input) => void send({ action: "save", banner: editor, input })}
          onClose={closeEditor} />
      )}
    </div>
  );
}
