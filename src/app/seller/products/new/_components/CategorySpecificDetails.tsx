"use client";

import { Layers3 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { type ProductAttributeInput } from "@/services/categories-api";
import { type CategoryDetailField, type CategoryDetailGroup } from "../_lib/category-detail-fields";

export type CategoryFieldValue = ProductAttributeInput;

type CategorySpecificDetailsProps = {
  group: CategoryDetailGroup;
  values: CategoryFieldValue[];
  onChange: (field: CategoryDetailField, value: string) => void;
};

function valueForField(values: CategoryFieldValue[], field: CategoryDetailField) {
  return values.find((item) => item.attributeId === field.attributeId)?.value ?? "";
}

export function CategorySpecificDetails({ group, values, onChange }: CategorySpecificDetailsProps) {
  return (
    <section className="rounded-3xl border border-white/70 bg-white/75 p-4 shadow-[0_18px_50px_rgba(15,23,42,0.08)] ring-1 ring-zinc-900/3 backdrop-blur-2xl md:p-6">
      <div className="mb-4 flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/70 bg-linear-to-br from-white to-emerald-50 text-[#009E49] shadow-inner">
          <Layers3 className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <h2 className="text-sm font-black uppercase tracking-wider text-zinc-950">{group.title}</h2>
          <p className="mt-1 text-xs font-semibold leading-relaxed text-zinc-500">{group.description}</p>
        </div>
      </div>

      {group.reviewNote ? (
        <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50/80 p-3 text-xs font-bold leading-relaxed text-amber-800">
          {group.reviewNote}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {group.fields.map((field) => {
          const valueIndex = values
            .filter((item) => item.value.trim())
            .findIndex((item) => item.attributeId === field.attributeId);
          return (
            <CategoryDetailInput
              key={field.id}
              field={field}
              value={valueForField(values, field)}
              onChange={onChange}
              targetId={valueIndex >= 0 ? `product-attribute-${valueIndex}` : undefined}
            />
          );
        })}
      </div>
    </section>
  );
}

function CategoryDetailInput({
  field,
  value,
  onChange,
  targetId,
}: {
  field: CategoryDetailField;
  value: string;
  onChange: (field: CategoryDetailField, value: string) => void;
  targetId?: string;
}) {
  const marker = field.required ? <span className="text-rose-500">*</span> : null;
  const inputClassName = "h-11 rounded-xl border-zinc-200 bg-white/80 text-sm shadow-inner focus-visible:ring-[#009E49]";

  if (field.type === "select") {
    return (
      <label className="space-y-1.5">
        <span className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-zinc-500">{field.label} {marker}</span>
        <select
          id={targetId}
          value={value}
          onChange={(event) => onChange(field, event.target.value)}
          className="h-11 w-full rounded-xl border border-zinc-200 bg-white/80 px-3 text-sm font-medium text-zinc-900 shadow-inner outline-none focus-visible:ring-2 focus-visible:ring-[#009E49]"
        >
          <option value="">Select</option>
          {(field.options ?? []).map((option) => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
      </label>
    );
  }

  if (field.type === "textarea") {
    return (
      <label className="space-y-1.5 md:col-span-2">
        <span className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-zinc-500">{field.label} {marker}</span>
        <textarea
          id={targetId}
          value={value}
          onChange={(event) => onChange(field, event.target.value)}
          placeholder={field.placeholder}
          className="min-h-24 w-full resize-y rounded-xl border border-zinc-200 bg-white/80 p-3 text-sm font-medium shadow-inner outline-none focus-visible:ring-2 focus-visible:ring-[#009E49]"
        />
      </label>
    );
  }

  return (
    <label className="space-y-1.5">
      <span className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-zinc-500">{field.label} {marker}</span>
      <Input
        id={targetId}
        type={field.type === "date" ? "date" : field.type}
        value={value}
        onChange={(event) => onChange(field, event.target.value)}
        placeholder={field.placeholder}
        className={inputClassName}
      />
    </label>
  );
}
