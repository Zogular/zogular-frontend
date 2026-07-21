import * as React from "react";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import type { ProductDetail } from "@/types/product";

export function ProductInfoSections({ productData }: { productData: ProductDetail }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-100 bg-white shadow-sm animate-in fade-in slide-in-from-bottom-4 fill-mode-both duration-500 [animation-delay:600ms]">
      <Accordion type="single" collapsible className="w-full" defaultValue="description">
        <AccordionItem value="description" className="border-b-zinc-100 px-4">
          <AccordionTrigger className="py-4 text-sm font-bold text-zinc-900 hover:no-underline">Product Description</AccordionTrigger>
          <AccordionContent className="pb-4 text-sm leading-relaxed text-zinc-600">{productData.description}</AccordionContent>
        </AccordionItem>
        <AccordionItem value="specs" className="border-b-zinc-100 px-4">
          <AccordionTrigger className="py-4 text-sm font-bold text-zinc-900 hover:no-underline">Specifications</AccordionTrigger>
          <AccordionContent className="pb-4 text-sm text-zinc-600">
            <div className="grid grid-cols-1 gap-2">
              {productData.specs.map((spec) => (
                <div key={spec.label} className="flex justify-between border-b border-zinc-50/50 py-2">
                  <span className="text-zinc-500">{spec.label}</span>
                  <span className="text-right font-medium text-zinc-900">{spec.value}</span>
                </div>
              ))}
            </div>
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="box" className="border-b-0 px-4">
          <AccordionTrigger className="py-4 text-sm font-bold text-zinc-900 hover:no-underline">What&apos;s in the Box</AccordionTrigger>
          <AccordionContent className="pb-4 text-sm text-zinc-600">
            <ul className="list-disc space-y-1.5 pl-5 marker:text-[#009E49]">
              {productData.boxItems.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
