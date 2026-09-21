"use client";

/**
 * @file CategoryIconPickerModal.tsx
 * @module features/admin-categories/components
 * @description
 * Searchable, accessible modal dialog for selecting marketplace category icons.
 * Replaces hardcoded icon arrays with an organized catalog of vetted Lucide icons
 * categorized by business departments with instant search across names and keywords.
 */

import React, { useMemo, useRef, useState } from "react";
import {
  Apple,
  Bath,
  Battery,
  Bed,
  Car,
  Camera,
  Coffee,
  Cog,
  Cpu,
  Crown,
  Dumbbell,
  Flower2,
  FolderTree,
  Footprints,
  Fuel,
  Glasses,
  Hammer,
  HeartPulse,
  Lamp,
  Laptop,
  Pill,
  Plug,
  Radio,
  Refrigerator,
  Scissors,
  Search,
  Shirt,
  ShoppingBasket,
  Smartphone,
  Sofa,
  Sparkles,
  Sprout,
  Sun,
  Tractor,
  Trees,
  Tv,
  UtensilsCrossed,
  Watch,
  Wheat,
  Wrench,
  X,
  Zap,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export interface CategoryIconDefinition {
  value: string;
  label: string;
  department: string;
  keywords: string[];
  Icon: React.ComponentType<{ className?: string }>;
}

export const CATEGORY_ICON_CATALOG: CategoryIconDefinition[] = [
  // Electronics & Power
  { value: "smartphone", label: "Smartphone", department: "Electronics & Power", keywords: ["phone", "mobile", "android", "iphone", "cell"], Icon: Smartphone },
  { value: "laptop", label: "Laptop & PC", department: "Electronics & Power", keywords: ["computer", "pc", "macbook", "notebook"], Icon: Laptop },
  { value: "tv", label: "Television & Audio", department: "Electronics & Power", keywords: ["tv", "screen", "display", "monitor"], Icon: Tv },
  { value: "camera", label: "Camera & Photo", department: "Electronics & Power", keywords: ["photo", "dslr", "video", "lens"], Icon: Camera },
  { value: "radio", label: "Radio & Sound", department: "Electronics & Power", keywords: ["audio", "speaker", "sound", "broadcast"], Icon: Radio },
  { value: "cpu", label: "Computer Components", department: "Electronics & Power", keywords: ["processor", "chip", "ram", "motherboard", "hardware"], Icon: Cpu },
  { value: "battery", label: "Battery & Storage", department: "Electronics & Power", keywords: ["power", "lithium", "solar storage", "cells", "inverter"], Icon: Battery },
  { value: "sun", label: "Solar Energy", department: "Electronics & Power", keywords: ["solar", "panels", "clean power", "renewable", "inverter"], Icon: Sun },
  { value: "zap", label: "Electrical & Grid", department: "Electronics & Power", keywords: ["electricity", "power", "energy", "voltage", "current"], Icon: Zap },
  { value: "plug", label: "Cables & Adapters", department: "Electronics & Power", keywords: ["charger", "cable", "cord", "socket", "wire"], Icon: Plug },

  // Fashion & Apparel
  { value: "shirt", label: "Clothing & Shirts", department: "Fashion & Apparel", keywords: ["clothes", "tshirt", "tops", "wear"], Icon: Shirt },
  { value: "footprints", label: "Footwear & Shoes", department: "Fashion & Apparel", keywords: ["shoes", "boots", "sneakers", "sandals"], Icon: Footprints },
  { value: "watch", label: "Watches & Clocks", department: "Fashion & Apparel", keywords: ["time", "smartwatch", "jewelry", "accessory"], Icon: Watch },
  { value: "glasses", label: "Eyewear", department: "Fashion & Apparel", keywords: ["sunglasses", "spectacles", "optics", "shades"], Icon: Glasses },
  { value: "crown", label: "Luxury & Jewelry", department: "Fashion & Apparel", keywords: ["gold", "silver", "rings", "necklaces", "premium"], Icon: Crown },
  { value: "scissors", label: "Tailoring & Fabrics", department: "Fashion & Apparel", keywords: ["textiles", "materials", "sewing", "chitenge"], Icon: Scissors },

  // Home & Living
  { value: "sofa", label: "Living & Furniture", department: "Home & Living", keywords: ["couch", "chair", "lounge", "seating"], Icon: Sofa },
  { value: "bed", label: "Bedroom & Bedding", department: "Home & Living", keywords: ["mattress", "linen", "blankets", "sleep"], Icon: Bed },
  { value: "refrigerator", label: "Home Appliances", department: "Home & Living", keywords: ["fridge", "freezer", "kitchen appliances", "cooling"], Icon: Refrigerator },
  { value: "lamp", label: "Lighting & Lamps", department: "Home & Living", keywords: ["light", "bulbs", "led", "fixtures", "lantern"], Icon: Lamp },
  { value: "utensils-crossed", label: "Kitchen & Dining", department: "Home & Living", keywords: ["cookware", "pots", "pans", "dishes", "cutlery"], Icon: UtensilsCrossed },
  { value: "bath", label: "Bathroom & Sanitary", department: "Home & Living", keywords: ["plumbing", "shower", "fixtures", "tiles"], Icon: Bath },

  // Groceries & Essentials
  { value: "shopping-basket", label: "Groceries & Market", department: "Groceries & Essentials", keywords: ["food", "supermarket", "provisions", "daily"], Icon: ShoppingBasket },
  { value: "apple", label: "Fresh Fruits & Produce", department: "Groceries & Essentials", keywords: ["vegetables", "fruit", "fresh", "market"], Icon: Apple },
  { value: "coffee", label: "Beverages & Tea", department: "Groceries & Essentials", keywords: ["drink", "coffee", "tea", "juice", "water"], Icon: Coffee },
  { value: "wheat", label: "Grains & Cereals", department: "Groceries & Essentials", keywords: ["mealie meal", "maize", "flour", "rice", "corn"], Icon: Wheat },

  // Health, Beauty & Fitness
  { value: "heart-pulse", label: "Health & Wellness", department: "Health, Beauty & Fitness", keywords: ["medical", "clinic", "first aid", "vital"], Icon: HeartPulse },
  { value: "pill", label: "Pharmacy & Medicine", department: "Health, Beauty & Fitness", keywords: ["drugs", "supplements", "vitamins", "prescriptions"], Icon: Pill },
  { value: "sparkles", label: "Beauty & Cosmetics", department: "Health, Beauty & Fitness", keywords: ["makeup", "skincare", "perfume", "fragrance"], Icon: Sparkles },
  { value: "flower-2", label: "Personal Care & Hair", department: "Health, Beauty & Fitness", keywords: ["hair", "lotion", "soap", "body wash", "organic"], Icon: Flower2 },
  { value: "dumbbell", label: "Sports & Fitness", department: "Health, Beauty & Fitness", keywords: ["gym", "weights", "workout", "exercise", "training"], Icon: Dumbbell },

  // Automotive, Hardware & Tools
  { value: "car", label: "Automotive & Spares", department: "Automotive & Hardware", keywords: ["vehicles", "auto parts", "tires", "batteries", "accessories"], Icon: Car },
  { value: "wrench", label: "Tools & Maintenance", department: "Automotive & Hardware", keywords: ["repair", "equipment", "spanner", "mechanic"], Icon: Wrench },
  { value: "hammer", label: "Building & Construction", department: "Automotive & Hardware", keywords: ["hardware", "materials", "cement", "timber"], Icon: Hammer },
  { value: "cog", label: "Machinery & Industrial", department: "Automotive & Hardware", keywords: ["gears", "industrial", "motors", "pumps"], Icon: Cog },
  { value: "fuel", label: "Oils & Lubricants", department: "Automotive & Hardware", keywords: ["oil", "grease", "petrol", "fluids", "coolant"], Icon: Fuel },

  // Agriculture & Farming
  { value: "sprout", label: "Seeds & Seedlings", department: "Agriculture & Farming", keywords: ["plants", "farming", "crops", "gardening"], Icon: Sprout },
  { value: "tractor", label: "Farm Machinery", department: "Agriculture & Farming", keywords: ["agriculture", "plow", "harvester", "farming equipment"], Icon: Tractor },
  { value: "trees", label: "Forestry & Agro", department: "Agriculture & Farming", keywords: ["timber", "plants", "horticulture"], Icon: Trees },
];

export interface CategoryIconPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedIcon: string;
  onSelectIcon: (iconValue: string) => void;
}

export function CategoryIconPickerModal({
  isOpen,
  onClose,
  selectedIcon,
  onSelectIcon,
}: CategoryIconPickerModalProps) {
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeDepartment, setActiveDepartment] = useState<string>("all");

  const departments = useMemo(() => {
    const set = new Set<string>();
    CATEGORY_ICON_CATALOG.forEach((item) => set.add(item.department));
    return Array.from(set);
  }, []);

  const handleClose = () => {
    // Clear transient picker state on close so every new category edit starts
    // with the complete icon catalogue without a synchronous effect update.
    setSearchQuery("");
    setActiveDepartment("all");
    onClose();
  };

  const filteredIcons = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return CATEGORY_ICON_CATALOG.filter((item) => {
      if (activeDepartment !== "all" && item.department !== activeDepartment) {
        return false;
      }
      if (!query) return true;
      const matchesLabel = item.label.toLowerCase().includes(query);
      const matchesValue = item.value.toLowerCase().includes(query);
      const matchesKeywords = item.keywords.some((kw) => kw.toLowerCase().includes(query));
      return matchesLabel || matchesValue || matchesKeywords;
    });
  }, [activeDepartment, searchQuery]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent
        showCloseButton={false}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          searchInputRef.current?.focus();
        }}
        className="flex h-[min(90vh,740px)] w-full max-w-3xl flex-col overflow-hidden rounded-[2rem] border border-[color-mix(in_srgb,var(--admin-copper-muted)_30%,transparent)] bg-[#fff8ec] text-stone-900 shadow-2xl"
      >
        {/* Header */}
        <header className="flex items-center justify-between border-b border-[color-mix(in_srgb,var(--admin-copper-muted)_22%,transparent)] bg-[#fff8ec]/95 px-5 py-4 backdrop-blur-md">
          <DialogHeader className="gap-1">
            <DialogTitle className="text-base font-black tracking-tight text-[var(--admin-canopy-deep)]">
              Select Category Icon
            </DialogTitle>
            <DialogDescription className="text-[11px] font-medium text-[var(--admin-ink-soft)]">
              Choose an icon that best represents this category across the marketplace
            </DialogDescription>
          </DialogHeader>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close icon picker"
            className="flex size-11 items-center justify-center rounded-xl text-stone-600 hover:bg-stone-200 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#075b36]"
          >
            <X className="size-4" />
          </button>
        </header>

        {/* Search & Department Filters */}
        <div className="border-b border-stone-200 bg-white/70 p-4 space-y-3">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-stone-400" />
            <Input
              ref={searchInputRef}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search icons (e.g., phone, solar, shoes, battery, groceries)..."
              className="h-11 rounded-xl border-stone-300 bg-white pl-10 pr-9 text-xs font-semibold focus-visible:ring-[#075b36]"
            />
            {searchQuery ? (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                aria-label="Clear search"
                className="absolute right-2.5 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-lg text-stone-400 hover:bg-stone-100 hover:text-stone-700"
              >
                <X className="size-3.5" />
              </button>
            ) : null}
          </div>

          {/* Department Pills */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[11px]">
            <button
              type="button"
              onClick={() => setActiveDepartment("all")}
              className={cn(
                "rounded-lg px-2.5 py-1 font-bold transition-all",
                activeDepartment === "all"
                  ? "bg-[#063b29] text-[#fff8ec] shadow-xs"
                  : "bg-stone-100 text-stone-600 hover:bg-stone-200"
              )}
            >
              All ({CATEGORY_ICON_CATALOG.length})
            </button>
            {departments.map((dept) => {
              const isSelected = activeDepartment === dept;
              return (
                <button
                  key={dept}
                  type="button"
                  onClick={() => setActiveDepartment(dept)}
                  className={cn(
                    "rounded-lg px-2.5 py-1 font-bold transition-all",
                    isSelected
                      ? "bg-[#063b29] text-[#fff8ec] shadow-xs"
                      : "bg-stone-100 text-stone-600 hover:bg-stone-200"
                  )}
                >
                  {dept}
                </button>
              );
            })}
          </div>
        </div>

        {/* Icon Grid */}
        <div className="flex-1 overflow-y-auto p-4 scrollbar-thin">
          {/* Option for No Icon */}
          <div className="mb-4">
            <button
              type="button"
              onClick={() => {
                onSelectIcon("");
                handleClose();
              }}
              className={cn(
                "flex items-center gap-3 rounded-2xl border p-3 text-left transition-all w-full",
                selectedIcon === ""
                  ? "border-[#075b36] bg-[#075b36]/10 ring-1 ring-[#075b36]"
                  : "border-stone-200 bg-white/70 hover:border-stone-300 hover:bg-white"
              )}
            >
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-stone-100 text-stone-500">
                <FolderTree className="size-5" />
              </div>
              <div>
                <span className="block text-xs font-black text-stone-900">No Custom Icon</span>
                <span className="text-[11px] text-stone-500">Use default folder hierarchy symbol</span>
              </div>
            </button>
          </div>

          {filteredIcons.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-xs font-bold text-stone-600">No icons match &quot;{searchQuery}&quot;</p>
              <p className="mt-1 text-[11px] text-stone-500">Try searching for a synonym or clear your query.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
              {filteredIcons.map(({ value, label, department, Icon }) => {
                const isSelected = selectedIcon === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => {
                      onSelectIcon(value);
                      handleClose();
                    }}
                    className={cn(
                      "group flex flex-col items-center justify-center rounded-2xl border p-3 text-center transition-all min-h-[96px]",
                      isSelected
                        ? "border-[#075b36] bg-[#075b36]/10 ring-2 ring-[#075b36] shadow-sm"
                        : "border-stone-200 bg-white/70 hover:border-[#075b36]/40 hover:bg-white"
                    )}
                  >
                    <div
                      className={cn(
                        "flex size-11 items-center justify-center rounded-xl transition-colors",
                        isSelected
                          ? "bg-[#063b29] text-[#fff8ec]"
                          : "bg-stone-100 text-stone-700 group-hover:bg-[#fff8ec] group-hover:text-[#063b29]"
                      )}
                    >
                      <Icon className="size-5" />
                    </div>
                    <span className="mt-2 text-xs font-black text-stone-900 line-clamp-1">
                      {label}
                    </span>
                    <span className="text-[9px] font-medium text-stone-500 line-clamp-1">
                      {department}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <footer className="flex items-center justify-end border-t border-stone-200 bg-stone-50 px-5 py-3">
          <button
            type="button"
            onClick={handleClose}
            className="min-h-11 rounded-xl px-5 text-xs font-bold text-stone-700 hover:bg-stone-200 transition-colors"
          >
            Cancel
          </button>
        </footer>
      </DialogContent>
    </Dialog>
  );
}
