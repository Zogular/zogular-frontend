"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { ApiError } from "@/services/api";
import {
  adminAccessApi,
  adminAccessReasonSchema,
  type AdminAccessStatus,
} from "@/services/admin/access";

interface AdminAccessStatusDialogProps {
  target: AdminAccessStatus;
  targetName: string;
  blocked: boolean;
  onConfirmed: (status: AdminAccessStatus) => void;
  onRefreshRequired: () => void;
  onSessionExpired: () => void;
}

interface StatusFeedback {
  message: string;
  invalidReason?: boolean;
}

/** Confirms one explicit access decision; stale decisions must be dismissed and reviewed again. */
export function AdminAccessStatusDialog({
  target,
  targetName,
  blocked,
  onConfirmed,
  onRefreshRequired,
  onSessionExpired,
}: AdminAccessStatusDialogProps) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState<StatusFeedback | null>(null);
  const request = useRef<AbortController | null>(null);
  const reasonInput = useRef<HTMLTextAreaElement>(null);
  const reasonId = useId();
  const hintId = useId();
  const errorId = useId();
  const nextIsActive = !target.isActive;
  const action = nextIsActive ? "Restore access" : "Revoke access";
  const actionClassName = nextIsActive
    ? "bg-emerald-700 text-white hover:bg-emerald-800"
    : "bg-rose-700 text-white hover:bg-rose-800";

  useEffect(() => () => request.current?.abort(), []);

  function handleOpenChange(nextOpen: boolean) {
    if (request.current || (nextOpen && blocked)) return;
    if (nextOpen) {
      setReason("");
      setFeedback(null);
    }
    setOpen(nextOpen);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!open || blocked || request.current) return;

    const result = adminAccessReasonSchema.safeParse(reason);
    if (!result.success) {
      setFeedback({ message: "Enter a reason between 10 and 500 characters.", invalidReason: true });
      reasonInput.current?.focus();
      return;
    }

    // Lock synchronously so repeated events cannot send a second administrative decision.
    const controller = new AbortController();
    request.current = controller;
    setPending(true);
    setFeedback(null);

    try {
      const status = await adminAccessApi.updateStatus(target.id, nextIsActive, result.data, controller.signal);
      if (controller.signal.aborted) return;
      onConfirmed(status);
      setOpen(false);
    } catch (error) {
      if (controller.signal.aborted) return;
      const status = error instanceof ApiError ? error.status : null;
      if (status === 401) {
        onSessionExpired();
      } else if (status === 400) {
        setFeedback({
          message: "Use 10 to 500 characters of plain text. Do not include links, secrets, or raw data.",
          invalidReason: true,
        });
        reasonInput.current?.focus();
      } else {
        const message = status === 403
          ? "The server denied this change. Your permissions or the account status may have changed."
          : status === 404 || status === 409
            ? "This account changed before the decision could be applied."
            : "The server did not confirm whether access changed.";
        onRefreshRequired();
        setFeedback({ message: `${message} Dismiss this dialog and refresh admins before trying again.` });
      }
    } finally {
      request.current = null;
      if (!controller.signal.aborted) setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          type="button"
          aria-disabled={blocked || undefined}
          className={cn("w-full font-bold aria-disabled:cursor-not-allowed aria-disabled:opacity-50", actionClassName)}
        >
          {action}
        </Button>
      </DialogTrigger>
      <DialogContent
        showCloseButton={false}
        className="max-h-[calc(100dvh-2rem)] gap-4 overflow-y-auto overscroll-contain p-4 sm:p-6"
        onEscapeKeyDown={(event) => { if (request.current) event.preventDefault(); }}
        onInteractOutside={(event) => { if (request.current) event.preventDefault(); }}
      >
        <DialogHeader>
          <DialogTitle className="font-semibold">{action}</DialogTitle>
          <DialogDescription className="[overflow-wrap:anywhere]">
            {nextIsActive ? "Restore administrator access for " : "Revoke administrator access for "}
            <strong>{targetName}</strong>.
          </DialogDescription>
        </DialogHeader>
        <form className="min-w-0 space-y-4" noValidate onSubmit={handleSubmit}>
          <div className="space-y-2">
            <label htmlFor={reasonId} className="block font-semibold">Reason</label>
            <Textarea
              ref={reasonInput}
              id={reasonId}
              required
              value={reason}
              readOnly={pending || blocked}
              aria-invalid={feedback?.invalidReason || undefined}
              aria-describedby={feedback ? `${hintId} ${errorId}` : hintId}
              onChange={(event) => {
                setReason(event.target.value);
                if (feedback?.invalidReason) setFeedback(null);
              }}
              className="field-sizing-fixed min-h-24 resize-y"
            />
            <p id={hintId} className="text-xs text-muted-foreground">10 to 500 characters. Do not include links or secrets.</p>
            {feedback ? <p id={errorId} role="alert" className="text-sm text-rose-700">{feedback.message}</p> : null}
            {pending ? <p role="status" className="text-xs text-muted-foreground">Applying access change...</p> : null}
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="outline" className="min-h-11 sm:min-h-9" disabled={pending} onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending || blocked} className={cn("min-h-11 sm:min-h-9", actionClassName)}>
              {action}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
