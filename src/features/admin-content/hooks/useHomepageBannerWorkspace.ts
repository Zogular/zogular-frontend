"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/services/api";
import {
  adminContentApi,
  isHomepageBannerCsrfDenial,
  type AdminHomepageBanner,
  type HomepageBannerAsset,
  type HomepageBannerInput,
} from "@/services/admin/content";

type BannerWrite =
  | { action: "save"; banner: AdminHomepageBanner | null; input: HomepageBannerInput }
  | { action: "publish" | "pause"; banner: AdminHomepageBanner };

function statusOf(error: unknown) {
  return error instanceof ApiError ? error.status : undefined;
}

function rejectedWriteStatus(error: unknown) {
  return error instanceof ApiError && typeof error.details === "object" && error.details !== null
    && "status" in error.details && error.details.status === "fail"
    && "message" in error.details && typeof error.details.message === "string"
    ? error.status
    : undefined;
}

type BannerList = Awaited<ReturnType<typeof adminContentApi.listHomepageBanners>>;
type SubmittedBannerInput = { input: HomepageBannerInput; asset?: HomepageBannerAsset };
type BannerRecovery = {
  target: AdminHomepageBanner;
  reason: "conflict" | "missing" | "uncertain";
  submitted?: SubmittedBannerInput;
  reviewed?: AdminHomepageBanner;
};

function exactTarget(items: readonly AdminHomepageBanner[], id: string) {
  const matches = items.filter((item) => item.id === id);
  return matches.length === 1 ? matches[0] : undefined;
}

export function useHomepageBannerWorkspace(authority: string, expectedActor: string) {
  const queryClient = useQueryClient();
  const queryKey = ["admin", "homepage-banners", authority] as const;
  // undefined closes the editor; null opens a fresh draft.
  const [editor, setEditor] = useState<AdminHomepageBanner | null | undefined>();
  const [feedback, setFeedback] = useState("");
  const [accessLoss, setAccessLoss] = useState<"denied" | "refresh">();
  const [pending, setPending] = useState(false);
  const [saving, setSaving] = useState(false);
  const [checking, setChecking] = useState(false);
  const [notice, setNotice] = useState("");
  const [readNotice, setReadNotice] = useState("");
  const [createHold, setCreateHold] = useState<SubmittedBannerInput>();
  const [verificationDraft, setVerificationDraft] = useState<SubmittedBannerInput>();
  const [recovery, setRecovery] = useState<BannerRecovery>();
  const [viewSubmittedEdit, setViewSubmittedEdit] = useState(false);
  const active = useRef(true);
  const writeAbort = useRef<AbortController | null>(null);
  const locked = useRef({ denied: false, busy: false, create: false, recovery: false });
  useLayoutEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
      writeAbort.current?.abort();
    };
  }, []);

  function revokeAccess(reason: "denied" | "refresh" = "denied") {
    locked.current.denied = true;
    writeAbort.current?.abort();
    setAccessLoss(reason);
    setEditor(undefined);
    setCreateHold(undefined);
    setVerificationDraft(undefined);
    setRecovery(undefined);
    setViewSubmittedEdit(false);
    setFeedback("");
    setNotice("");
    setReadNotice("");
    queryClient.removeQueries({ queryKey, exact: true });
  }

  async function readList(signal?: AbortSignal) {
    try {
      return await adminContentApi.listHomepageBanners(signal);
    } catch (error) {
      if (active.current && !signal?.aborted && (statusOf(error) === 401 || statusOf(error) === 403)) revokeAccess();
      throw error;
    }
  }

  const list = useQuery({
    queryKey,
    queryFn: ({ signal }) => readList(signal),
    retry: false,
    gcTime: 0,
    enabled: !accessLoss,
  });

  const data = list.isError ? undefined : list.data;
  const blocked = pending || checking || list.isFetching || Boolean(recovery);
  const reviewed = recovery?.reviewed;
  const current = reviewed && data && exactTarget(data.items, reviewed.id);
  const canUseReviewed = Boolean(current && reviewed && current.version === reviewed.version && current.state === reviewed.state);
  const currentEditor = editor && data && exactTarget(data.items, editor.id);
  const editorIsStale = Boolean(editor && data && (!currentEditor || currentEditor.state !== "DRAFT" || currentEditor.version !== editor.version));

  async function send(request: BannerWrite) {
    const gate = locked.current;
    const creating = request.action === "save" && !request.banner;
    if (!active.current || gate.denied || gate.busy || gate.recovery || (creating && gate.create) || !data || list.isFetching) return;
    if (request.action === "save" && request.banner && editorIsStale) return;
    gate.busy = true;
    const controller = new AbortController();
    writeAbort.current = controller;
    // Capture the mounted actor before the shared client prepares CSRF.
    const context = { expectedActor, signal: controller.signal };
    const submitted = request.action === "save"
      ? { input: request.input, asset: data.assets.find((asset) => asset.key === request.input.assetKey) }
      : undefined;
    setPending(true);
    setSaving(request.action === "save");
    setFeedback("");
    setNotice("");
    try {
      if (request.action === "save") {
        if (request.banner) await adminContentApi.updateHomepageBanner(request.banner.id, request.banner.version, request.input, context);
        else await adminContentApi.createHomepageBanner(request.input, context);
      } else {
        await adminContentApi.changeHomepageBannerState(request.banner.id, request.banner.version, request.action, context);
      }
    } catch (error) {
      if (!active.current || gate.denied) return;
      const httpStatus = statusOf(error);
      const status = rejectedWriteStatus(error);
      if (isHomepageBannerCsrfDenial(error)) {
        if (request.action === "save") {
          setVerificationDraft(submitted);
          setEditor(request.banner);
        }
        setNotice(submitted
          ? "This request could not be verified. Your changes are still here. Review them before trying again."
          : "This request could not be verified. Review the banner before choosing another action.");
      } else if (httpStatus === 412 || httpStatus === 428) {
        revokeAccess("refresh");
      } else if (httpStatus === 401 || httpStatus === 403) {
        revokeAccess();
      } else if (status === 400 || status === 422) {
        setNotice("Banner details were not accepted. Check the image set, copy, and schedule.");
      } else if (request.banner) {
        setVerificationDraft(undefined);
        gate.recovery = true;
        setRecovery({
          target: request.banner, reason: status === 409 ? "conflict" : status === 404 ? "missing" : "uncertain", submitted,
        });
        setEditor(undefined);
        setViewSubmittedEdit(Boolean(submitted));
        setReadNotice("");
      } else if (status === 409 || status === 404) {
        setNotice("The draft was not accepted. Check the latest banners before trying again.");
      } else if (submitted) {
        // There is no server-issued ID to check. A matching list row cannot identify this create.
        gate.create = true;
        setVerificationDraft(undefined);
        setCreateHold(submitted);
      }
      return;
    } finally {
      writeAbort.current = null;
      gate.busy = false;
      if (active.current && !gate.denied) {
        setPending(false);
        setSaving(false);
      }
    }
    if (active.current && !gate.denied) {
      setVerificationDraft(undefined);
      setEditor(undefined);
      setFeedback(request.action === "save" ? "Draft saved." : request.action === "publish" ? "Banner publication saved." : "Banner paused.");
      void queryClient.invalidateQueries({ queryKey, exact: true });
    }
  }

  async function reload() {
    const gate = locked.current;
    if (!active.current || gate.denied || gate.busy) return;
    gate.busy = true;
    setChecking(true);
    setReadNotice("");
    if (recovery) setRecovery({ ...recovery, reviewed: undefined });
    try {
      // Start a new read after the failed write; do not accept cached or already-pending data.
      await queryClient.cancelQueries({ queryKey, exact: true });
      if (!active.current || gate.denied) return;
      const fresh = await queryClient.fetchQuery({
        queryKey, queryFn: ({ signal }) => readList(signal), staleTime: 0, retry: false, networkMode: "always",
      });
      if (!active.current || gate.denied || !recovery) return;
      const target = exactTarget(fresh.items, recovery.target.id);
      if (!target || target.version < recovery.target.version) {
        setReadNotice("The banner could not be verified in the latest list. It is still locked.");
        return;
      }
      setRecovery({ ...recovery, reviewed: target });
    } catch {
      if (active.current && !gate.denied) setReadNotice("The latest banners could not be checked.");
    } finally {
      gate.busy = false;
      if (active.current && !gate.denied) setChecking(false);
    }
  }

  function acceptReviewedBanner(edit = false) {
    if (!reviewed || locked.current.denied || locked.current.busy || list.isFetching) return;
    const latest = queryClient.getQueryData<BannerList>(queryKey);
    const target = latest && exactTarget(latest.items, reviewed.id);
    if (!target || target.version !== reviewed.version || target.state !== reviewed.state || (edit && target.state !== "DRAFT")) return;
    locked.current.recovery = false;
    setRecovery(undefined);
    setViewSubmittedEdit(false);
    setReadNotice("");
    setEditor(edit ? target : undefined);
  }

  function discardSubmittedEdit() {
    if (locked.current.denied || locked.current.busy) return;
    // Discarding the copy is not a target read or acknowledgment.
    setRecovery((value) => value && { ...value, submitted: undefined });
    setViewSubmittedEdit(false);
  }

  function openNewDraft() {
    if (locked.current.busy || locked.current.create || locked.current.recovery || locked.current.denied) return;
    setNotice("");
    setFeedback("");
    setVerificationDraft(undefined);
    setEditor(null);
  }

  function openEdit(banner: AdminHomepageBanner) {
    setNotice("");
    setFeedback("");
    setVerificationDraft(undefined);
    setEditor(banner);
  }

  function closeEditor() {
    setVerificationDraft(undefined);
    setNotice("");
    setEditor(undefined);
  }

  function openSubmittedDraft() {
    setViewSubmittedEdit(false);
    setEditor(null);
  }

  function openSubmittedEdit() {
    setEditor(undefined);
    setViewSubmittedEdit(true);
  }

  return {
    accessLoss, data, editor, editorIsStale, blocked, pending, checking, saving,
    listPending: list.isPending, listError: list.isError, listFetching: list.isFetching,
    createHold, recovery, reviewed, canUseReviewed, viewSubmittedEdit, verificationDraft,
    notice, readNotice, feedback,
    send, reload, acceptReviewedBanner, discardSubmittedEdit, openNewDraft, openEdit, closeEditor,
    openSubmittedDraft, openSubmittedEdit,
    closeSubmittedDraft: () => setEditor(undefined),
    closeSubmittedEdit: () => setViewSubmittedEdit(false),
  };
}
