"use client";

import type { FormEvent } from "react";
import { useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowRight, Check, CheckCircle2, Eye, EyeOff, Loader2, Lock, Mail, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiError } from "@/services/api";
import { setupCustomerAccount } from "@/services/auth";
import { setupAdminAccount } from "@/services/admin/auth";

type AccountSetupAudience = "admin" | "customer";
type AccountClass = "STAFF" | "CUSTOMER";

const COPY: Record<AccountSetupAudience, {
  title: string;
  description: string;
  emailLabel: string;
  emailPlaceholder: string;
  missingTokenHelp: string;
  loginHref: string;
  loginLabel: string;
  successCopy: string;
}> = {
  admin: {
    title: "Activate Administrator Account",
    description: "Create your permanent password to complete staff onboarding.",
    emailLabel: "Administrator email",
    emailPlaceholder: "admin@zogular.com",
    missingTokenHelp: "Use the complete invitation link from your administrator, or contact a Super Administrator.",
    loginHref: "/admin/login",
    loginLabel: "Go to Admin Sign In",
    successCopy: "Your staff account is ready. Redirecting to admin sign in…",
  },
  customer: {
    title: "Activate your Zogular account",
    description: "Create a secure password to start shopping on Zogular.",
    emailLabel: "Email address",
    emailPlaceholder: "you@example.com",
    missingTokenHelp: "Use the complete activation link from your Zogular email, or contact support for a new invitation.",
    loginHref: "/auth/login",
    loginLabel: "Go to Sign In",
    successCopy: "Your account is ready. Redirecting to sign in…",
  },
};

function destinationFor(accountClass: AccountClass): string {
  return accountClass === "STAFF" ? "/admin/login" : "/auth/login";
}

type InvitationFragment = Readonly<{ token: string; email: string }>;

const EMPTY_INVITATION_FRAGMENT: InvitationFragment = Object.freeze({ token: "", email: "" });
let invitationFragmentSnapshot: InvitationFragment | undefined;
let invitationFragmentSubscribers = 0;

function readInvitationFragment(): InvitationFragment {
  if (invitationFragmentSnapshot) return invitationFragmentSnapshot;
  if (typeof window === "undefined") return EMPTY_INVITATION_FRAGMENT;

  const values = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  invitationFragmentSnapshot = Object.freeze({
    token: values.get("token")?.trim() ?? "",
    email: values.get("email")?.trim().toLowerCase() ?? "",
  });
  return invitationFragmentSnapshot;
}

function subscribeToInvitationFragment(): () => void {
  // Capture before scrubbing. The fragment never reaches the server and is
  // held only in component memory for this one account-setup page lifecycle.
  readInvitationFragment();
  if (window.location.hash) {
    window.history.replaceState(null, document.title, window.location.pathname);
  }

  invitationFragmentSubscribers += 1;
  return () => {
    invitationFragmentSubscribers -= 1;
    queueMicrotask(() => {
      if (invitationFragmentSubscribers === 0) invitationFragmentSnapshot = undefined;
    });
  };
}

function useInvitationFragment() {
  const invitation = useSyncExternalStore(
    subscribeToInvitationFragment,
    readInvitationFragment,
    () => EMPTY_INVITATION_FRAGMENT,
  );
  const [emailOverride, setEmailOverride] = useState<string | null>(null);

  return {
    token: invitation.token,
    email: emailOverride ?? invitation.email,
    setEmail: setEmailOverride,
  };
}

/**
 * Shared public activation form. It accepts no target role or destination:
 * backend response data from the consumed invitation selects the login route.
 */
export function AccountSetupContent({ audience }: { audience: AccountSetupAudience }) {
  const router = useRouter();
  const statusRef = useRef<HTMLDivElement | null>(null);
  const emailId = useId();
  const passwordId = useId();
  const confirmPasswordId = useId();
  const copy = COPY[audience];
  const { token, email, setEmail } = useInvitationFragment();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const requirements = useMemo(() => [
    ["At least 8 characters", password.length >= 8],
    ["At least 1 uppercase letter", /[A-Z]/.test(password)],
    ["At least 1 lowercase letter", /[a-z]/.test(password)],
    ["At least 1 number", /[0-9]/.test(password)],
    ["At least 1 special character", /[^A-Za-z0-9]/.test(password)],
    ["Passwords match", password.length > 0 && password === confirmPassword],
  ] as const, [password, confirmPassword]);
  const allRequirementsMet = requirements.every(([, met]) => met);

  useEffect(() => {
    if (errorMessage) statusRef.current?.focus();
  }, [errorMessage]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    if (!token) {
      setErrorMessage("Activation token is missing. Please use the complete invitation link.");
      return;
    }
    if (!email.trim() || !allRequirementsMet) {
      setErrorMessage("Enter your invitation email and meet every password requirement.");
      return;
    }

    setIsSubmitting(true);
    try {
      const input = { token, email: email.trim(), password, confirmPassword };
      const result = audience === "admin"
        ? await setupAdminAccount(input)
        : await setupCustomerAccount(input);
      setIsSuccess(true);
      toast.success(result.message || "Account setup completed successfully.");
      window.setTimeout(() => router.replace(destinationFor(result.accountClass)), 1_500);
    } catch (error) {
      setErrorMessage(
        error instanceof ApiError
          ? error.message
          : "Account activation failed. Check your details or request a new invitation.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center bg-[#efe5d6] p-4 text-[#171a16] sm:p-6">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,#fff8ec_0%,#efe5d6_75%)]" />
      <section className="relative w-full max-w-md overflow-hidden rounded-3xl border border-[#b88746]/30 bg-[#fff8ec] shadow-2xl shadow-[#063b29]/10">
        <header className="bg-[#063b29] px-6 py-8 text-center text-white sm:px-8">
          <BrandLogo variant="dark" className="mb-4 justify-center" imageClassName="h-10 w-auto" priority />
          <h1 className="text-xl font-black tracking-tight sm:text-2xl">{copy.title}</h1>
          <p className="mt-2 text-sm text-emerald-100/80">{copy.description}</p>
        </header>
        <div className="space-y-6 p-6 sm:p-8">
          {!token ? (
            <div className="space-y-6">
              <div role="alert" className="rounded-2xl border border-amber-300/60 bg-amber-50 p-5 text-amber-950">
                <ShieldAlert className="mb-3 h-5 w-5 text-amber-600" />
                <p className="text-sm font-bold">Activation Token Required</p>
                <p className="mt-2 text-xs leading-relaxed">{copy.missingTokenHelp}</p>
              </div>
              <Button asChild className="h-12 w-full rounded-2xl bg-[#063b29] font-bold text-[#fff8ec] hover:bg-[#075b36]">
                <Link href={copy.loginHref}>{copy.loginLabel}<ArrowRight className="ml-2 h-4 w-4" /></Link>
              </Button>
            </div>
          ) : isSuccess ? (
            <div className="space-y-4 py-4 text-center">
              <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-700" />
              <h2 className="text-lg font-bold text-[#063b29]">Account activated</h2>
              <p className="text-sm text-[#5f625a]">{copy.successCopy}</p>
              <Loader2 className="mx-auto h-5 w-5 animate-spin text-[#075b36]" />
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5" noValidate>
              {errorMessage ? <div ref={statusRef} tabIndex={-1} role="alert" aria-live="polite" className="flex gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-xs font-semibold text-red-800"><AlertCircle className="h-4 w-4 shrink-0" />{errorMessage}</div> : null}
              <label className="block space-y-1.5" htmlFor={emailId}><span className="text-xs font-bold uppercase tracking-wider text-[#5f625a]">{copy.emailLabel}</span><span className="relative block"><Mail className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-400" /><Input id={emailId} type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder={copy.emailPlaceholder} autoComplete="email" className="h-12 rounded-2xl border-[#b88746]/30 bg-white pl-11" /></span></label>
              <PasswordInput id={passwordId} label="New password" value={password} onChange={setPassword} visible={showPassword} onToggle={() => setShowPassword((value) => !value)} />
              <PasswordInput id={confirmPasswordId} label="Confirm password" value={confirmPassword} onChange={setConfirmPassword} visible={showConfirmPassword} onToggle={() => setShowConfirmPassword((value) => !value)} />
              <ul className="grid grid-cols-1 gap-2 rounded-2xl border border-[#b88746]/20 bg-[#f6eedf]/60 p-4 text-xs sm:grid-cols-2">
                {requirements.map(([label, met]) => <li key={label} className={met ? "flex items-center gap-2 text-[#075b36]" : "flex items-center gap-2 text-zinc-500"}><span className={met ? "flex h-4 w-4 items-center justify-center rounded-full bg-[#075b36] text-white" : "h-4 w-4 rounded-full border border-zinc-300 bg-white"}>{met ? <Check className="h-2.5 w-2.5" /> : null}</span>{label}</li>)}
              </ul>
              <Button type="submit" disabled={isSubmitting || !allRequirementsMet} className="h-12 w-full rounded-2xl bg-[#063b29] font-bold text-[#fff8ec] hover:bg-[#075b36]">{isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Activating…</> : <>Activate account<ArrowRight className="ml-2 h-4 w-4" /></>}</Button>
              <Link href={copy.loginHref} className="block text-center text-xs font-semibold text-[#5f625a] underline-offset-4 hover:text-[#063b29] hover:underline">Already activated? Sign in</Link>
            </form>
          )}
        </div>
      </section>
    </main>
  );
}

function PasswordInput({ id, label, value, onChange, visible, onToggle }: { id: string; label: string; value: string; onChange: (value: string) => void; visible: boolean; onToggle: () => void }) {
  return <label className="block space-y-1.5" htmlFor={id}><span className="text-xs font-bold uppercase tracking-wider text-[#5f625a]">{label}</span><span className="relative block"><Lock className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-400" /><Input id={id} type={visible ? "text" : "password"} value={value} onChange={(event) => onChange(event.target.value)} autoComplete="new-password" className="h-12 rounded-2xl border-[#b88746]/30 bg-white pl-11 pr-12" /><button type="button" aria-label={visible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`} onClick={onToggle} className="absolute right-2 top-1/2 h-8 w-8 -translate-y-1/2 text-zinc-500">{visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></span></label>;
}
