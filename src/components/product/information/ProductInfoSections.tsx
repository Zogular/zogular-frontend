"use client";

import * as React from "react";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import type { ProductDetail } from "@/types/product";

type ProductInfoTab = "description" | "specs" | "box" | "delivery";

function Description({ productData }: { productData: ProductDetail }) {
  return <p className="text-sm leading-7 text-zinc-600">{productData.description}</p>;
}

function Specifications({ productData }: { productData: ProductDetail }) {
  if (productData.specs.length === 0) {
    return <p className="text-sm text-zinc-500">No additional specifications were provided.</p>;
  }

  return (
    <div className="grid grid-cols-1 gap-x-8 md:grid-cols-2">
      {productData.specs.map((spec) => (
        <div key={spec.label} className="flex justify-between gap-4 border-b border-zinc-100 py-2.5 text-sm">
          <span className="text-zinc-500">{spec.label}</span>
          <span className="text-right font-semibold text-zinc-900">{spec.value}</span>
        </div>
      ))}
    </div>
  );
}

function BoxItems({ productData }: { productData: ProductDetail }) {
  return (
    <ul className="list-disc space-y-1.5 pl-5 text-sm text-zinc-600 marker:text-[#009E49]">
      {productData.boxItems.map((item) => <li key={item}>{item}</li>)}
    </ul>
  );
}

function DeliveryAndReturns({ productData }: { productData: ProductDetail }) {
  return (
    <div className="space-y-2 text-sm leading-6 text-zinc-600">
      <p>{productData.shippingText}</p>
      <p>Return eligibility depends on the item condition and the reason reported after delivery.</p>
    </div>
  );
}

export function ProductInfoSections({ productData }: { productData: ProductDetail }) {
  const [activeTab, setActiveTab] = React.useState<ProductInfoTab>("description");
  const hasBoxItems = Boolean(productData.boxItems && productData.boxItems.length > 0);

  const availableTabs = React.useMemo(() => {
    const tabs: Array<{ label: string; value: ProductInfoTab }> = [
      { label: "Description", value: "description" },
      { label: "Specifications", value: "specs" },
    ];
    if (hasBoxItems) {
      tabs.push({ label: "What's Included", value: "box" });
    }
    tabs.push({ label: "Delivery & Returns", value: "delivery" });
    return tabs;
  }, [hasBoxItems]);

  const desktopContent = {
    description: <Description productData={productData} />,
    specs: <Specifications productData={productData} />,
    box: <BoxItems productData={productData} />,
    delivery: <DeliveryAndReturns productData={productData} />,
  } satisfies Record<ProductInfoTab, React.ReactNode>;

  return (
    <>
      <div className="overflow-hidden rounded-2xl border border-zinc-100 bg-white shadow-sm lg:hidden">
        <Accordion type="single" collapsible className="w-full" defaultValue="description">
          <AccordionItem value="description" className="border-b-zinc-100 px-3 sm:px-4">
            <AccordionTrigger className="min-h-11 py-2.5 text-sm font-bold text-zinc-900 hover:no-underline sm:py-3">Product Description</AccordionTrigger>
            <AccordionContent className="pb-3"><Description productData={productData} /></AccordionContent>
          </AccordionItem>
          <AccordionItem value="specs" className="border-b-zinc-100 px-3 sm:px-4">
            <AccordionTrigger className="min-h-11 py-2.5 text-sm font-bold text-zinc-900 hover:no-underline sm:py-3">Specifications</AccordionTrigger>
            <AccordionContent className="pb-3"><Specifications productData={productData} /></AccordionContent>
          </AccordionItem>
          {hasBoxItems ? (
            <AccordionItem value="box" className="border-b-zinc-100 px-3 sm:px-4">
              <AccordionTrigger className="min-h-11 py-2.5 text-sm font-bold text-zinc-900 hover:no-underline sm:py-3">What&apos;s in the Box</AccordionTrigger>
              <AccordionContent className="pb-3"><BoxItems productData={productData} /></AccordionContent>
            </AccordionItem>
          ) : null}
          <AccordionItem value="delivery" className="border-b-0 px-3 sm:px-4">
            <AccordionTrigger className="min-h-11 py-2.5 text-sm font-bold text-zinc-900 hover:no-underline sm:py-3">Delivery &amp; Returns</AccordionTrigger>
            <AccordionContent className="pb-3"><DeliveryAndReturns productData={productData} /></AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>

      <section className="hidden min-w-0 overflow-hidden rounded-2xl border border-zinc-200 bg-white p-4 lg:block">
        <div
          aria-label="Product information"
          className="hide-scrollbar flex max-w-full overflow-x-auto border-b border-zinc-100"
          role="tablist"
        >
          {availableTabs.map((tab) => {
            const isActive = activeTab === tab.value;
            return (
              <button
                key={tab.value}
                aria-controls={`product-info-panel-${tab.value}`}
                aria-selected={isActive}
                className={`shrink-0 border-b-2 px-2.5 py-3 text-xs font-semibold transition-colors ${
                  isActive
                    ? "border-[#009E49] text-[#007E3A]"
                    : "border-transparent text-zinc-500 hover:text-zinc-900"
                }`}
                id={`product-info-tab-${tab.value}`}
                onClick={() => setActiveTab(tab.value)}
                role="tab"
                type="button"
              >
                {tab.label}
              </button>
            );
          })}
        </div>
        <div
          aria-labelledby={`product-info-tab-${activeTab}`}
          className="px-2 py-4"
          id={`product-info-panel-${activeTab}`}
          role="tabpanel"
        >
          {desktopContent[activeTab]}
        </div>
      </section>
    </>
  );
}
