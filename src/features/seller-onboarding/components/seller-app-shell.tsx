"use client";

import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { AlertCircle, Loader2, PanelLeftClose, RefreshCw, Store } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useSaveSellerOnboarding, useStartSellerOnboarding } from "../hooks/use-save-seller-onboarding";
import { useSellerOnboarding } from "../hooks/use-seller-onboarding";
import { useSubmitSellerOnboarding } from "../hooks/use-submit-seller-onboarding";
import { useUploadSellerDocument } from "../hooks/use-upload-seller-document";
import type {
  SellerOnboardingDocumentConfig,
  SellerOnboardingFormValues,
  SellerOnboardingViewModel,
} from "../types/seller-onboarding.types";
import {
  formValuesToVendorApplicationInput,
  validateSellerOnboardingForSubmit,
} from "../utils/seller-onboarding-validation";
import { MobileSellerApplication } from "./mobile-seller-application";
import { SellerApplicationHero } from "./seller-application-hero";
import { SellerApplicationWorkspace } from "./seller-application-workspace";
import { SellerOnboardingNotice } from "./seller-onboarding-notice";
import { SellerSidebar } from "./seller-sidebar";

type UploadingDocumentState = Partial<
  Record<SellerOnboardingDocumentConfig["key"], { uploading: boolean; progress: number; error?: string }>
>;

function getApplicationResetKey(viewModel?: SellerOnboardingViewModel | null) {
  if (!viewModel?.application) return "no-application";
  const { id, status, updatedAt } = viewModel.application;
  return [id, status, updatedAt ?? ""].join(":");
}

function getLockedApplicationMessage(viewModel?: SellerOnboardingViewModel | null) {
  if (viewModel?.status === "SUBMITTED") return "Your application is already under review.";
  if (viewModel?.status === "APPROVED") return "Your seller account is already approved.";
  return "This application cannot be changed right now.";
}

export function SellerAppShell() {
  const onboardingQuery = useSellerOnboarding();
  const saveMutation = useSaveSellerOnboarding();
  const startMutation = useStartSellerOnboarding();
  const uploadMutation = useUploadSellerDocument();
  const submitMutation = useSubmitSellerOnboarding(onboardingQuery.data);
  const [openSection, setOpenSection] = useState("identity");
  const [uploadingDocuments, setUploadingDocuments] = useState<UploadingDocumentState>({});
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const lastFormResetKeyRef = useRef<string | null>(null);
  const suppressFormResetRef = useRef(false);

  const form = useForm<SellerOnboardingFormValues>({
    defaultValues: onboardingQuery.data?.formValues,
  });

  useEffect(() => {
    if (!onboardingQuery.data) return;
    const nextResetKey = getApplicationResetKey(onboardingQuery.data);
    if (lastFormResetKeyRef.current === nextResetKey) return;

    lastFormResetKeyRef.current = nextResetKey;

    // After a document upload the draft-save changes updatedAt, which
    // changes the reset key. The refetch can arrive before the DB write
    // is fully visible, returning stale data without the new URL.
    // Skip the blind form.reset so we don't wipe the URL that was just
    // set via form.setValue. The form already holds the correct value.
    if (suppressFormResetRef.current) {
      suppressFormResetRef.current = false;
      return;
    }

    form.reset(onboardingQuery.data.formValues);
    setOpenSection(onboardingQuery.data.firstIncompleteSectionId);
  }, [form, onboardingQuery.data]);

  useEffect(() => {
    if (!mobileSidebarOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileSidebarOpen]);

  const viewModel = onboardingQuery.data;
  const isSaving = saveMutation.isPending;
  const isSubmitting = submitMutation.isPending;
  const isUploading = uploadMutation.isPending || Object.values(uploadingDocuments).some((item) => item?.uploading);
  const disabled = !viewModel?.canEdit || isSubmitting;

  const currentPayload = () => formValuesToVendorApplicationInput(form.getValues());

  const scrollToSection = (sectionId?: string) => {
    const target = sectionId ?? viewModel?.firstIncompleteSectionId ?? "identity";
    setOpenSection(target);
    setMobileSidebarOpen(false);
    window.requestAnimationFrame(() => {
      document.getElementById(target)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const handleSave = async () => {
    try {
      suppressFormResetRef.current = true;
      await saveMutation.mutateAsync(currentPayload());
    } catch {
      suppressFormResetRef.current = false;
      // The mutation hook owns seller-facing error copy.
    }
  };

  const handleSubmit = async () => {
    const values = form.getValues();
    const result = validateSellerOnboardingForSubmit(values);

    if (!result.success) {
      const firstIssue = result.error.issues[0];
      for (const issue of result.error.issues) {
        const field = issue.path[0];
        if (typeof field === "string") {
          form.setError(field as keyof SellerOnboardingFormValues, { message: issue.message });
        }
      }
      toast.error(firstIssue?.message ?? "Please finish the missing items first.");
      scrollToSection(viewModel?.firstIncompleteSectionId);
      return;
    }

    if (viewModel && !viewModel.canEdit) {
      toast.error(viewModel.submitDisabledReason);
      scrollToSection(viewModel.firstIncompleteSectionId);
      return;
    }

    try {
      suppressFormResetRef.current = true;
      await saveMutation.mutateAsync(currentPayload());
      await submitMutation.mutateAsync();
    } catch {
      suppressFormResetRef.current = false;
      // The mutation hooks own seller-facing error copy.
    }
  };

  const blockDocumentUpload = (
    config: SellerOnboardingDocumentConfig,
    targetViewModel?: SellerOnboardingViewModel | null,
  ) => {
    const message = getLockedApplicationMessage(targetViewModel);
    setUploadingDocuments((current) => ({
      ...current,
      [config.key]: {
        uploading: false,
        progress: 0,
        error: message,
      },
    }));
    toast.info(message);
  };

  const ensureDocumentUploadAllowed = async (config: SellerOnboardingDocumentConfig) => {
    if (!viewModel?.canEdit) {
      blockDocumentUpload(config, viewModel);
      return false;
    }

    const latest = await onboardingQuery.refetch();
    const latestViewModel = latest.data;

    if (!latestViewModel?.canEdit) {
      blockDocumentUpload(config, latestViewModel);
      return false;
    }

    return true;
  };

  const handleSelectDocument = async (config: SellerOnboardingDocumentConfig, file: File | null) => {
    if (!file) return;

    if (!(await ensureDocumentUploadAllowed(config))) return;

    setUploadingDocuments((current) => ({
      ...current,
      [config.key]: { uploading: true, progress: 0 },
    }));

    try {
      const result = await uploadMutation.mutateAsync({
        file,
        config,
        payload: currentPayload(),
        onProgress: (progress) => {
          setUploadingDocuments((current) => ({
            ...current,
            [config.key]: { uploading: true, progress },
          }));
        },
      });

      form.setValue(config.field, result.uploaded.url, { shouldDirty: true });
      suppressFormResetRef.current = true;
      setUploadingDocuments((current) => ({
        ...current,
        [config.key]: { uploading: false, progress: 100 },
      }));
    } catch (error) {
      setUploadingDocuments((current) => ({
        ...current,
        [config.key]: {
          uploading: false,
          progress: 0,
          error: error instanceof Error ? error.message : "Upload failed. Please try again.",
        },
      }));
    }
  };

  let shellContent: React.ReactNode = null;

  if (onboardingQuery.isLoading) {
    shellContent = <SellerOnboardingLoading />;
  } else if (onboardingQuery.isError) {
    shellContent = (
      <SellerOnboardingError
        onRetry={() => void onboardingQuery.refetch()}
        message="We couldn't load your application. Please try again."
      />
    );
  } else if (!viewModel) {
    shellContent = null;
  } else if (!viewModel.hasApplication) {
    shellContent = (
      <SellerOnboardingEmpty
        starting={startMutation.isPending}
        onStart={() => void startMutation.mutateAsync()}
      />
    );
  } else {
    shellContent = (
      <>
        <SellerOnboardingNotice viewModel={viewModel} onContinue={() => scrollToSection()} />
        <SellerApplicationHero
          viewModel={viewModel}
          onContinue={() => scrollToSection()}
          onSave={() => void handleSave()}
          saving={isSaving}
        />
        <SellerApplicationWorkspace
          viewModel={viewModel}
          register={form.register}
          errors={form.formState.errors}
          watch={form.watch}
          setValue={form.setValue}
          disabled={disabled}
          uploadingDocuments={uploadingDocuments}
          onSelectDocument={handleSelectDocument}
          onSave={() => void handleSave()}
          onSubmit={() => void handleSubmit()}
          saving={isSaving}
          submitting={isSubmitting}
          uploading={isUploading}
        />
      </>
    );
  }

  if (viewModel?.hasApplication) {
    return (
      <>
        <div className="hidden text-[#1F1A14] lg:block">
          {shellContent}
        </div>
        <MobileSidebarDrawer
          open={mobileSidebarOpen}
          onClose={() => setMobileSidebarOpen(false)}
          viewModel={viewModel}
        />
        <MobileSellerApplication
          viewModel={viewModel}
          register={form.register}
          errors={form.formState.errors}
          watch={form.watch}
          setValue={form.setValue}
          disabled={disabled}
          openSection={openSection}
          onOpenSectionChange={setOpenSection}
          uploadingDocuments={uploadingDocuments}
          onSelectDocument={handleSelectDocument}
          onContinue={() => scrollToSection()}
          onSave={() => void handleSave()}
          onSubmit={() => void handleSubmit()}
          saving={isSaving}
          submitting={isSubmitting}
          uploading={isUploading}
          menuOpen={mobileSidebarOpen}
          onToggleMenu={() => setMobileSidebarOpen((current) => !current)}
        />
      </>
    );
  }

  return <div className="min-h-screen bg-[#F7F4EE] p-4 lg:p-8">{shellContent}</div>;
}

function SellerOnboardingLoading() {
  return (
    <div className="mx-auto max-w-3xl rounded-[30px] border border-[#E9E1D6] bg-[#FFFCF8] p-6 shadow-[0_22px_60px_rgba(31,26,20,0.07)]">
      <div className="flex items-center gap-3">
        <Loader2 className="h-5 w-5 animate-spin text-[#0EA85B]" />
        <p className="text-sm font-black text-[#1F1A14]">Loading your application...</p>
      </div>
      <div className="mt-5 space-y-3">
        <div className="h-20 rounded-3xl bg-[#FBF6EE]" />
        <div className="h-32 rounded-3xl bg-[#FBF6EE]" />
      </div>
    </div>
  );
}

function SellerOnboardingError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="mx-auto max-w-3xl rounded-[30px] border border-[#E9E1D6] bg-[#FFFCF8] p-6 shadow-[0_22px_60px_rgba(31,26,20,0.07)]">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#FBE9E4] text-[#A5442E]">
          <AlertCircle className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-lg font-black text-[#1F1A14]">{message}</h1>
          <p className="mt-1 text-sm font-medium leading-6 text-[#6F6A62]">Check your connection or sign in again.</p>
        </div>
      </div>
      <Button type="button" onClick={onRetry} className="mt-5 h-11 rounded-2xl bg-[#09281C] px-5 font-black text-white">
        <RefreshCw className="mr-2 h-4 w-4" />
        Try again
      </Button>
    </div>
  );
}

function SellerOnboardingEmpty({
  starting,
  onStart,
}: {
  starting: boolean;
  onStart: () => void;
}) {
  return (
    <div className="mx-auto max-w-3xl rounded-[32px] border border-[#E9E1D6] bg-[linear-gradient(135deg,#FFFCF8,#F5EAD5)] p-7 shadow-[0_30px_80px_rgba(31,26,20,0.1)]">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#E9F8EF] text-[#0A7A42]">
        <Store className="h-5 w-5" />
      </div>
      <h1 className="mt-5 text-3xl font-black tracking-tight text-[#1F1A14]">Let&apos;s get your shop set up.</h1>
      <p className="mt-3 max-w-xl text-sm font-semibold leading-6 text-[#6F6A62]">
        Start your seller application, save your progress, and come back anytime.
      </p>
      <Button type="button" onClick={onStart} disabled={starting} className="mt-6 h-11 rounded-2xl bg-[#09281C] px-5 font-black text-white">
        {starting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        {starting ? "Starting..." : "Start application"}
      </Button>
    </div>
  );
}

function MobileSidebarDrawer({
  open,
  onClose,
  viewModel,
}: {
  open: boolean;
  onClose: () => void;
  viewModel: SellerOnboardingViewModel;
}) {
  return (
    <div
      className={cn(
        "fixed inset-0 z-50 bg-[#09281C]/55 transition-opacity duration-300 lg:hidden",
        open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0",
      )}
      aria-hidden={!open}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close menu"
        className="absolute inset-0"
      />
      <div
        className={cn(
          "relative h-full w-[86vw] max-w-[320px] bg-[#09281C] shadow-[0_30px_80px_rgba(9,40,28,0.26)] transition-transform duration-300",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close menu"
          className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10 text-white backdrop-blur hover:bg-white/16"
        >
          <PanelLeftClose className="h-4.5 w-4.5" />
        </button>
        <SellerSidebar viewModel={viewModel} className="h-full overflow-hidden pr-10" />
      </div>
    </div>
  );
}
