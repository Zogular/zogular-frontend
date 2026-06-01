"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, Building2, Loader2, Save, Send, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { SellerTrustChecklist } from "@/components/seller/SellerTrustChecklist";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SellerStatusNotice } from "@/components/seller/SellerStatusNotice";
import { useSellerApplication } from "@/components/seller/SellerApplicationContext";
import { getCurrentUser } from "@/services/auth";
import {
  createVendorApplication,
  getEmptyVendorApplication,
  submitMyVendorApplication,
  updateMyVendorApplication,
} from "@/services/vendor-application";
import type { AuthUser } from "@/types/auth";
import type { VendorApplicationInput } from "@/types/seller";

function toFormState(input: VendorApplicationInput = getEmptyVendorApplication()): VendorApplicationInput {
  return {
    ...getEmptyVendorApplication(input.sellerType ?? "INDIVIDUAL"),
    ...input,
    productCategories: input.productCategories ?? [],
  };
}

export default function SellerOnboardingPage() {
  return (
    <Suspense fallback={<OnboardingFallback />}>
      <SellerOnboardingContent />
    </Suspense>
  );
}

function SellerOnboardingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { application, loading, setApplication } = useSellerApplication();
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [form, setForm] = useState<VendorApplicationInput>(toFormState());
  const [isCreatingDraft, setIsCreatingDraft] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const startImmediately = searchParams.get("start") === "1";
  const sellerType = form.sellerType ?? "INDIVIDUAL";
  const canEdit = !application || application.status === "DRAFT" || application.status === "NEEDS_INFO";
  const isRegisteredBusiness = sellerType === "REGISTERED_BUSINESS";
  const phoneVerificationAvailable = currentUser?.phoneVerifiedAt !== undefined;
  const emailVerified = Boolean(currentUser?.emailVerified);
  const phoneVerified = Boolean(currentUser?.phoneVerifiedAt);

  useEffect(() => {
    if (!application) {
      setForm(toFormState());
      return;
    }

    setForm(
      toFormState({
        sellerType: application.sellerType,
        ownerFullName: application.ownerFullName,
        storeName: application.storeName,
        legalBusinessName: application.legalBusinessName,
        businessAddress: application.businessAddress,
        district: application.district,
        businessPhone: application.businessPhone,
        businessEmail: application.businessEmail,
        productCategories: application.productCategories,
        nrcNumber: application.nrcNumber,
        nrcFrontUrl: application.nrcFrontUrl,
        nrcBackUrl: application.nrcBackUrl,
        shopPhotoUrl: application.shopPhotoUrl,
        pacraNumber: application.pacraNumber,
        pacraDocumentUrl: application.pacraDocumentUrl,
        tpin: application.tpin,
        payoutProvider: application.payoutProvider,
        payoutPhone: application.payoutPhone,
        payoutAccountName: application.payoutAccountName,
      }),
    );
  }, [application]);

  useEffect(() => {
    let active = true;

    getCurrentUser()
      .then((user) => {
        if (!active) return;
        setCurrentUser(user);
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (loading || application || !startImmediately || isCreatingDraft) return;

    let active = true;
    setIsCreatingDraft(true);

    createVendorApplication({ sellerType: "INDIVIDUAL" })
      .then((created) => {
        if (!active) return;
        setApplication(created);
        setForm(
          toFormState({
            sellerType: created.sellerType,
          }),
        );
      })
      .catch((error) => {
        if (!active) return;
        toast.error(error instanceof Error ? error.message : "Failed to start seller onboarding.");
      })
      .finally(() => {
        if (active) setIsCreatingDraft(false);
      });

    return () => {
      active = false;
    };
  }, [application, isCreatingDraft, loading, setApplication, startImmediately]);

  const categoriesValue = useMemo(() => (form.productCategories ?? []).join(", "), [form.productCategories]);

  const updateField = (key: keyof VendorApplicationInput, value: string | string[]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const normalizePayload = (): VendorApplicationInput => ({
    sellerType,
    ownerFullName: form.ownerFullName?.trim() ?? "",
    storeName: form.storeName?.trim() ?? "",
    legalBusinessName: form.legalBusinessName?.trim() ?? "",
    businessAddress: form.businessAddress?.trim() ?? "",
    district: form.district?.trim() ?? "",
    businessPhone: form.businessPhone?.trim() ?? "",
    businessEmail: form.businessEmail?.trim().toLowerCase() ?? "",
    productCategories: form.productCategories?.filter(Boolean) ?? [],
    nrcNumber: form.nrcNumber?.trim() ?? "",
    nrcFrontUrl: form.nrcFrontUrl?.trim() ?? "",
    nrcBackUrl: form.nrcBackUrl?.trim() ?? "",
    shopPhotoUrl: form.shopPhotoUrl?.trim() ?? "",
    pacraNumber: form.pacraNumber?.trim() ?? "",
    pacraDocumentUrl: form.pacraDocumentUrl?.trim() ?? "",
    tpin: form.tpin?.trim() ?? "",
    payoutProvider: form.payoutProvider?.trim() ?? "",
    payoutPhone: form.payoutPhone?.trim() ?? "",
    payoutAccountName: form.payoutAccountName?.trim() ?? "",
  });

  const ensureDraftApplication = async () => {
    if (application) return application;

    const created = await createVendorApplication({
      sellerType,
    });
    setApplication(created);
    return created;
  };

  const handleSaveDraft = async () => {
    try {
      setIsSaving(true);
      await ensureDraftApplication();
      const saved = await updateMyVendorApplication(normalizePayload());
      setApplication(saved);
      toast.success("Seller application draft saved.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save seller application.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmit = async () => {
    if (!emailVerified) {
      toast.error("Verify your email before submitting the seller application.");
      router.push(
        currentUser?.email
          ? `/auth/check-email?email=${encodeURIComponent(currentUser.email)}&next=${encodeURIComponent("/seller/onboarding")}`
          : "/auth/check-email",
      );
      return;
    }

    if (!phoneVerified) {
      toast.error(
        phoneVerificationAvailable
          ? "Verify your phone before submitting the seller application."
          : "Backend follow-up: /user/me does not expose phoneVerifiedAt yet, so the frontend cannot confirm phone trust.",
      );
      router.push("/seller/verify-phone");
      return;
    }

    try {
      setIsSubmitting(true);
      await ensureDraftApplication();
      const saved = await updateMyVendorApplication(normalizePayload());
      setApplication(saved);
      const submitted = await submitMyVendorApplication();
      setApplication(submitted);
      toast.success("Seller application submitted for review.");
      router.push("/seller/status");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to submit seller application.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading || isCreatingDraft) {
    return (
      <div className="rounded-3xl border border-zinc-200 bg-white/85 p-6 text-sm font-semibold text-zinc-500 shadow-sm">
        Loading seller onboarding...
      </div>
    );
  }

  if (application && !canEdit) {
    return (
      <div className="mx-auto max-w-4xl space-y-5">
        <SellerStatusNotice application={application} />
        <section className="rounded-[2rem] border border-zinc-200 bg-white/90 p-6 shadow-[0_24px_60px_rgba(15,23,42,0.08)] backdrop-blur-xl md:p-8">
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-zinc-500">Seller Application</p>
          <h1 className="mt-2 text-2xl font-black tracking-tight text-zinc-950">This seller application is not editable right now.</h1>
          <p className="mt-3 text-sm font-medium leading-6 text-zinc-600">
            Draft and needs-info applications can be updated here. Once the application is submitted or moves into a restricted review state, use the status page to track what happens next.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link href="/seller/status">
              <Button className="h-11 rounded-xl bg-[#009E49] px-5 font-bold text-white hover:bg-[#00853d]">
                View seller status
              </Button>
            </Link>
            <Link href="/seller">
              <Button variant="outline" className="h-11 rounded-xl border-zinc-200 bg-white px-5 font-bold">
                Back to seller hub
              </Button>
            </Link>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      {application ? <SellerStatusNotice application={application} compact /> : null}

      <section className="overflow-hidden rounded-[2rem] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(255,255,255,0.82))] shadow-[0_24px_60px_rgba(15,23,42,0.08)] backdrop-blur-xl">
        <div className="border-b border-zinc-200/70 bg-[radial-gradient(circle_at_top,rgba(0,158,73,0.14),transparent_60%)] px-6 py-6 md:px-8">
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#009E49]">Seller Onboarding</p>
          <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div className="max-w-2xl">
              <h1 className="text-2xl font-black tracking-tight text-zinc-950 md:text-3xl">Build your ZOGULAR seller application.</h1>
              <p className="mt-2 text-sm font-medium leading-6 text-zinc-600">
                Start with identity and business details, add the payout destination you want us to use later, then submit the application for trust review.
              </p>
            </div>
            <div className="rounded-2xl border border-zinc-200 bg-white/80 px-4 py-3 text-sm font-semibold text-zinc-700 shadow-sm">
              Status: <span className="font-black text-zinc-950">{application?.status ?? "No draft yet"}</span>
            </div>
          </div>
        </div>

        <div className="grid gap-6 p-6 md:p-8 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-6">
            <FormSection
              icon={<ShieldCheck className="h-4 w-4" />}
              title="Seller identity"
              description="Choose the seller profile that matches how you will trade on ZOGULAR."
            >
              <div className="grid gap-3 md:grid-cols-2">
                <SellerTypeCard
                  active={sellerType === "INDIVIDUAL"}
                  title="Individual seller"
                  description="Best for informal sellers, solo founders, and small operators starting without full business registration."
                  onClick={() => updateField("sellerType", "INDIVIDUAL")}
                />
                <SellerTypeCard
                  active={sellerType === "REGISTERED_BUSINESS"}
                  title="Registered business"
                  description="Best for established businesses with PACRA registration and formal tax identity."
                  onClick={() => updateField("sellerType", "REGISTERED_BUSINESS")}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Owner full name" required>
                  <Input value={form.ownerFullName ?? ""} onChange={(event) => updateField("ownerFullName", event.target.value)} placeholder="e.g. Chola Banda" className="h-11 rounded-xl border-zinc-200 bg-white" />
                </Field>
                <Field label="Store name" required>
                  <Input value={form.storeName ?? ""} onChange={(event) => updateField("storeName", event.target.value)} placeholder="e.g. Cairo Mobile House" className="h-11 rounded-xl border-zinc-200 bg-white" />
                </Field>
                <Field label="Business phone" required>
                  <Input value={form.businessPhone ?? ""} onChange={(event) => updateField("businessPhone", event.target.value)} placeholder="+260 97 123 4567" className="h-11 rounded-xl border-zinc-200 bg-white" />
                </Field>
                <Field label="Business email" required>
                  <Input value={form.businessEmail ?? ""} onChange={(event) => updateField("businessEmail", event.target.value)} placeholder="seller@example.com" className="h-11 rounded-xl border-zinc-200 bg-white" />
                </Field>
              </div>
            </FormSection>

            <FormSection
              icon={<Building2 className="h-4 w-4" />}
              title="Business footprint"
              description="Tell us where you operate and what categories you plan to sell."
            >
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="District" required>
                  <Input value={form.district ?? ""} onChange={(event) => updateField("district", event.target.value)} placeholder="e.g. Lusaka" className="h-11 rounded-xl border-zinc-200 bg-white" />
                </Field>
                <Field label="Product categories" required hint="Use commas to separate planned categories.">
                  <Input
                    value={categoriesValue}
                    onChange={(event) =>
                      updateField(
                        "productCategories",
                        event.target.value
                          .split(",")
                          .map((item) => item.trim())
                          .filter(Boolean),
                      )
                    }
                    placeholder="e.g. Phones, Accessories, Beauty"
                    className="h-11 rounded-xl border-zinc-200 bg-white"
                  />
                </Field>
                <div className="md:col-span-2">
                  <Field label="Business address" required>
                    <Textarea value={form.businessAddress ?? ""} onChange={(event) => updateField("businessAddress", event.target.value)} placeholder="Physical address, market, road, or shop location" className="min-h-24 rounded-2xl border-zinc-200 bg-white" />
                  </Field>
                </div>
              </div>
            </FormSection>

            <FormSection
              icon={<ShieldCheck className="h-4 w-4" />}
              title="Identity documents"
              description="Cloudinary upload is paused in this phase, so add the current document URLs manually or paste placeholder links."
            >
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="NRC number" required>
                  <Input value={form.nrcNumber ?? ""} onChange={(event) => updateField("nrcNumber", event.target.value)} placeholder="123456/78/1" className="h-11 rounded-xl border-zinc-200 bg-white" />
                </Field>
                <Field label="Shop photo URL" hint="Optional for now.">
                  <Input value={form.shopPhotoUrl ?? ""} onChange={(event) => updateField("shopPhotoUrl", event.target.value)} placeholder="https://..." className="h-11 rounded-xl border-zinc-200 bg-white" />
                </Field>
                <Field label="NRC front URL" required>
                  <Input value={form.nrcFrontUrl ?? ""} onChange={(event) => updateField("nrcFrontUrl", event.target.value)} placeholder="https://..." className="h-11 rounded-xl border-zinc-200 bg-white" />
                </Field>
                <Field label="NRC back URL" required>
                  <Input value={form.nrcBackUrl ?? ""} onChange={(event) => updateField("nrcBackUrl", event.target.value)} placeholder="https://..." className="h-11 rounded-xl border-zinc-200 bg-white" />
                </Field>
              </div>
            </FormSection>

            {isRegisteredBusiness ? (
              <FormSection
                icon={<Building2 className="h-4 w-4" />}
                title="Registered business details"
                description="Formal business sellers should add the registered business identity now."
              >
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Legal business name" required>
                    <Input value={form.legalBusinessName ?? ""} onChange={(event) => updateField("legalBusinessName", event.target.value)} placeholder="e.g. Banda Trading Limited" className="h-11 rounded-xl border-zinc-200 bg-white" />
                  </Field>
                  <Field label="PACRA number" required>
                    <Input value={form.pacraNumber ?? ""} onChange={(event) => updateField("pacraNumber", event.target.value)} placeholder="PACRA registration number" className="h-11 rounded-xl border-zinc-200 bg-white" />
                  </Field>
                  <Field label="PACRA document URL" required>
                    <Input value={form.pacraDocumentUrl ?? ""} onChange={(event) => updateField("pacraDocumentUrl", event.target.value)} placeholder="https://..." className="h-11 rounded-xl border-zinc-200 bg-white" />
                  </Field>
                  <Field label="TPIN" hint="Optional in this phase.">
                    <Input value={form.tpin ?? ""} onChange={(event) => updateField("tpin", event.target.value)} placeholder="Taxpayer identification number" className="h-11 rounded-xl border-zinc-200 bg-white" />
                  </Field>
                </div>
              </FormSection>
            ) : null}

            <FormSection
              icon={<ShieldCheck className="h-4 w-4" />}
              title="Payout destination"
              description="This does not trigger payout automation yet. It simply records where the seller expects funds later."
            >
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Payout provider" required>
                  <Input value={form.payoutProvider ?? ""} onChange={(event) => updateField("payoutProvider", event.target.value)} placeholder="e.g. MTN Mobile Money" className="h-11 rounded-xl border-zinc-200 bg-white" />
                </Field>
                <Field label="Payout phone" required>
                  <Input value={form.payoutPhone ?? ""} onChange={(event) => updateField("payoutPhone", event.target.value)} placeholder="+260 96 000 0000" className="h-11 rounded-xl border-zinc-200 bg-white" />
                </Field>
                <div className="md:col-span-2">
                  <Field label="Payout account name" hint="Optional in this phase.">
                    <Input value={form.payoutAccountName ?? ""} onChange={(event) => updateField("payoutAccountName", event.target.value)} placeholder="Name registered on the payout destination" className="h-11 rounded-xl border-zinc-200 bg-white" />
                  </Field>
                </div>
              </div>
            </FormSection>
          </div>

          <aside className="space-y-4">
            <SellerTrustChecklist
              user={currentUser}
              phoneVerificationAvailable={phoneVerificationAvailable}
              compact
            />

            <div className="rounded-[1.75rem] border border-zinc-200 bg-white/85 p-5 shadow-sm">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-zinc-500">Checklist</p>
              <h2 className="mt-2 text-lg font-black tracking-tight text-zinc-950">What the review team expects</h2>
              <div className="mt-4 space-y-3">
                <ChecklistItem label="Accurate seller identity and contact details" />
                <ChecklistItem label="Real NRC document links for the seller" />
                <ChecklistItem label="Clear store and business footprint in Lusaka" />
                <ChecklistItem label="Planned product categories and payout destination" />
                {isRegisteredBusiness ? <ChecklistItem label="PACRA evidence for registered businesses" /> : null}
              </div>
            </div>

            <div className="rounded-[1.75rem] border border-zinc-200 bg-white/85 p-5 shadow-sm">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-zinc-500">Actions</p>
              <div className="mt-4 space-y-3">
                <Button onClick={handleSaveDraft} disabled={isSaving || isSubmitting} variant="outline" className="h-11 w-full rounded-xl border-zinc-200 bg-white font-bold">
                  {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  Save progress
                </Button>
                <Button onClick={handleSubmit} disabled={isSaving || isSubmitting} className="h-11 w-full rounded-xl bg-[#009E49] font-bold text-white hover:bg-[#00853d]">
                  {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                  Submit application
                </Button>
                <Link href="/seller/status">
                  <Button variant="ghost" className="h-10 w-full rounded-xl font-bold text-zinc-600 hover:bg-zinc-100">
                    View seller status
                  </Button>
                </Link>
              </div>
            </div>

            <div className="rounded-[1.75rem] border border-amber-200 bg-amber-50/90 p-5 shadow-sm">
              <p className="flex items-center gap-2 text-sm font-black text-amber-950">
                <AlertCircle className="h-4 w-4" />
                Trust and safety note
              </p>
              <p className="mt-3 text-sm font-medium leading-6 text-amber-800">
                Seller approval is separate from product approval. Even after this application becomes approved, each product still has to pass product review before it can go live.
              </p>
            </div>
          </aside>
        </div>
      </section>
    </div>
  );
}

function OnboardingFallback() {
  return (
    <div className="rounded-3xl border border-zinc-200 bg-white/85 p-6 text-sm font-semibold text-zinc-500 shadow-sm">
      Loading seller onboarding...
    </div>
  );
}

function FormSection({
  title,
  description,
  icon,
  children,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[1.75rem] border border-zinc-200 bg-white/85 p-5 shadow-sm md:p-6">
      <div className="mb-5 flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-zinc-200 bg-zinc-50 text-[#009E49]">
          {icon}
        </div>
        <div>
          <h2 className="text-lg font-black tracking-tight text-zinc-950">{title}</h2>
          <p className="mt-1 text-sm font-medium leading-6 text-zinc-600">{description}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

function Field({
  label,
  children,
  required = false,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  required?: boolean;
  hint?: string;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-[11px] font-black uppercase tracking-[0.18em] text-zinc-500">
        {label}
        {required ? " *" : ""}
      </span>
      {children}
      {hint ? <span className="block text-xs font-medium text-zinc-500">{hint}</span> : null}
    </label>
  );
}

function SellerTypeCard({
  active,
  title,
  description,
  onClick,
}: {
  active: boolean;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-[1.5rem] border p-4 text-left transition-all ${
        active
          ? "border-[#009E49]/30 bg-[#009E49]/8 shadow-sm"
          : "border-zinc-200 bg-zinc-50/70 hover:border-zinc-300 hover:bg-white"
      }`}
    >
      <p className="text-sm font-black text-zinc-950">{title}</p>
      <p className="mt-2 text-sm font-medium leading-6 text-zinc-600">{description}</p>
    </button>
  );
}

function ChecklistItem({ label }: { label: string }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-zinc-100 bg-zinc-50/80 px-4 py-3">
      <div className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-[#009E49]/10 text-[#009E49]">
        <ShieldCheck className="h-3.5 w-3.5" />
      </div>
      <p className="text-sm font-medium leading-6 text-zinc-700">{label}</p>
    </div>
  );
}
