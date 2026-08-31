"use client";

import { createElement, useEffect } from "react";
import { useRouter } from "next/navigation";
import { CornerDownLeft } from "lucide-react";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@/components/ui/command";
import { getAdminShellIcon } from "../config/admin-shell-icons";
import type { AdminShellNavigationGroup } from "../lib/admin-shell-model";

export function isEditableAdminCommandTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || Boolean(target.closest("input, textarea, select, [contenteditable='true']"));
}

export function AdminCommandMenu({
  groups,
  open,
  onOpenChange,
}: {
  groups: readonly AdminShellNavigationGroup[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      const usesCommandKey = event.metaKey || event.ctrlKey;
      if (
        event.key.toLowerCase() !== "k" ||
        !usesCommandKey ||
        event.altKey ||
        event.shiftKey ||
        isEditableAdminCommandTarget(event.target)
      ) {
        return;
      }

      event.preventDefault();
      onOpenChange(!open);
    };

    document.addEventListener("keydown", handleShortcut);
    return () => document.removeEventListener("keydown", handleShortcut);
  }, [onOpenChange, open]);

  const navigate = (href: string) => {
    onOpenChange(false);
    router.push(href);
  };

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Navigate admin"
      description="Search the admin pages available to you."
      className="border-[#b887464d] bg-[#fff8ec] text-[#171a16] shadow-2xl sm:max-w-xl"
    >
      <Command className="bg-[#fff8ec] text-[#171a16]">
        <CommandInput autoFocus placeholder="Search admin pages" aria-label="Search admin pages" />
        <CommandList className="max-h-[min(24rem,60vh)] p-1.5">
          <CommandEmpty>No available admin page matches.</CommandEmpty>
          {groups.map((group) => (
            <CommandGroup key={group.id} heading={group.label}>
              {group.destinations.map((destination) => {
                const icon = getAdminShellIcon(destination.id);
                return (
                  <CommandItem
                    key={destination.id}
                    value={`${group.label} ${destination.label}`}
                    onSelect={() => navigate(destination.href)}
                    className="min-h-11 cursor-pointer px-3 data-selected:bg-[#f6eedf]"
                  >
                    {createElement(icon, {
                      "aria-hidden": true,
                      className: "text-[#075b36]",
                    })}
                    <span>{destination.label}</span>
                    <CommandShortcut aria-hidden="true">
                      <CornerDownLeft />
                    </CommandShortcut>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          ))}
        </CommandList>
      </Command>
    </CommandDialog>
  );
}
