"use client";

import { AlertTriangle, CheckCircle2, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { CategoryFieldValue } from "./CategorySpecificDetails";
import type { CategorySelection } from "../_lib/category-selection";

export type CategoryChangeImpact = {
  selection: CategorySelection;
  retained: CategoryFieldValue[];
  movedToManual: CategoryFieldValue[];
  schemaUnavailable: boolean;
};

type CategoryChangeConfirmationDialogProps = {
  impact: CategoryChangeImpact | null;
  onCancel: () => void;
  onConfirm: () => void;
};

export function CategoryChangeConfirmationDialog({
  impact,
  onCancel,
  onConfirm,
}: CategoryChangeConfirmationDialogProps) {
  return (
    <Dialog open={Boolean(impact)} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="max-h-[calc(100svh-2rem)] overflow-y-auto rounded-2xl border border-amber-100 bg-white p-5 sm:max-w-lg">
        <DialogHeader>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
            <AlertTriangle className="h-5 w-5" aria-hidden="true" />
          </div>
          <DialogTitle className="pt-2 text-lg font-black text-zinc-950">Change product category?</DialogTitle>
          <DialogDescription className="leading-6 text-zinc-600">
            {impact ? `Review how existing details will be preserved before switching to ${impact.selection.leafName}.` : "Review how existing details will be preserved."}
          </DialogDescription>
        </DialogHeader>

        {impact ? (
          <div className="space-y-3" aria-live="polite">
            <ImpactRow
              icon={<CheckCircle2 className="h-4 w-4" aria-hidden="true" />}
              title={`${impact.retained.length} retained in governed fields`}
              values={impact.retained}
              tone="green"
            />
            <ImpactRow
              icon={<FileText className="h-4 w-4" aria-hidden="true" />}
              title={`${impact.movedToManual.length} preserved as manual specifications`}
              values={impact.movedToManual}
              tone="amber"
            />
            {impact.schemaUnavailable ? (
              <p className="rounded-xl border border-red-100 bg-red-50 p-3 text-xs font-semibold leading-5 text-red-700">
                The new category fields could not be loaded. Existing values will stay in manual specifications, and review submission will remain blocked until the category fields load.
              </p>
            ) : null}
          </div>
        ) : null}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel} className="h-10 rounded-xl">Keep current category</Button>
          <Button type="button" onClick={onConfirm} className="h-10 rounded-xl bg-[#009E49] text-white hover:bg-[#00853d]">Apply category change</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ImpactRow({
  icon,
  title,
  values,
  tone,
}: {
  icon: React.ReactNode;
  title: string;
  values: CategoryFieldValue[];
  tone: "green" | "amber";
}) {
  const color = tone === "green" ? "border-emerald-100 bg-emerald-50 text-emerald-800" : "border-amber-100 bg-amber-50 text-amber-800";
  return (
    <div className={`rounded-xl border p-3 ${color}`}>
      <p className="flex items-center gap-2 text-xs font-black">{icon}{title}</p>
      {values.length ? <p className="mt-1 text-xs font-semibold leading-5">{values.map((value) => value.name).join(", ")}</p> : null}
    </div>
  );
}
