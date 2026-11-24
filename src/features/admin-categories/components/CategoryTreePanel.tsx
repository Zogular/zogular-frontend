"use client";

/**
 * @file CategoryTreePanel.tsx
 * @module features/admin-categories/components
 * @description
 * Tactile category hierarchy tree panel with interactive search filtering,
 * active/inactive status badges, product density indicators, quick-add subcategory triggers,
 * ARIA tree accessibility roles, arrow keyboard traversal, search Escape clearing,
 * and permission presentation gating.
 */

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  FolderTree,
  Plus,
  Search,
  SlidersHorizontal,
  X,
  Pencil,
  Trash2,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DeleteCategoryConfirmationDialog } from "./DeleteCategoryConfirmationDialog";
import {
  CATEGORY_ICON_CATALOG,
} from "./CategoryIconPickerModal";
import type {
  AdminCategoryRecord,
  AdminCategoryTreeNode,
} from "../types";

const TREE_SCROLL_STORAGE_KEY = "zogular:admin:category-tree-scroll";

export interface CategoryTreePanelProps {
  tree: AdminCategoryTreeNode[];
  categories: AdminCategoryRecord[];
  selectedCategoryId: string | null;
  onSelectCategory: (categoryId: string) => void;
  onCreateRoot: () => void;
  onCreateChild: (parentId: string) => void;
  onEditCategory: (category: AdminCategoryRecord) => void;
  onDeleteCategory?: (categoryId: string) => Promise<void> | void;
  isLoading?: boolean;
  canManageCategories?: boolean;
}

export function CategoryTreePanel({
  tree,
  categories,
  selectedCategoryId,
  onSelectCategory,
  onCreateRoot,
  onCreateChild,
  onEditCategory,
  onDeleteCategory,
  isLoading = false,
  canManageCategories = true,
}: CategoryTreePanelProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [userToggledNodeIds, setUserToggledNodeIds] = useState<Record<string, boolean>>({});
  const [categoryToDelete, setCategoryToDelete] = useState<AdminCategoryRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  // Compute ancestors of selected category
  const selectedAncestorIds = useMemo(() => {
    const set = new Set<string>();
    if (!selectedCategoryId) return set;
    let current = categories.find((c) => c.id === selectedCategoryId);
    while (current?.parentId) {
      set.add(current.parentId);
      current = categories.find((c) => c.id === current?.parentId);
    }
    return set;
  }, [selectedCategoryId, categories]);

  // Restore container scroll position
  useEffect(() => {
    const savedY = window.sessionStorage.getItem(TREE_SCROLL_STORAGE_KEY);
    if (savedY && containerRef.current) {
      const parsed = Number(savedY);
      if (Number.isFinite(parsed)) {
        containerRef.current.scrollTop = parsed;
      }
    }
  }, [tree]);

  const handleScroll = () => {
    if (containerRef.current) {
      window.sessionStorage.setItem(
        TREE_SCROLL_STORAGE_KEY,
        String(Math.round(containerRef.current.scrollTop)),
      );
    }
  };

  const toggleExpand = (nodeId: string, event?: React.MouseEvent) => {
    event?.stopPropagation();
    setUserToggledNodeIds((prev) => {
      const isCurrentlyExpanded = prev[nodeId] ?? selectedAncestorIds.has(nodeId);
      return {
        ...prev,
        [nodeId]: !isCurrentlyExpanded,
      };
    });
  };

  // Filter tree nodes recursively based on searchQuery
  const filteredTree = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return tree;

    function filterNode(node: AdminCategoryTreeNode): AdminCategoryTreeNode | null {
      const matchesSelf =
        node.name.toLowerCase().includes(query) ||
        node.slug.toLowerCase().includes(query);

      const matchingChildren: AdminCategoryTreeNode[] = [];
      for (const child of node.children) {
        const filteredChild = filterNode(child);
        if (filteredChild) matchingChildren.push(filteredChild);
      }

      if (matchesSelf || matchingChildren.length > 0) {
        return {
          ...node,
          children: matchingChildren,
        };
      }
      return null;
    }

    return tree.map(filterNode).filter((node): node is AdminCategoryTreeNode => node !== null);
  }, [tree, searchQuery]);

  // Flatten visible nodes for keyboard traversal
  const visibleNodes = useMemo(() => {
    const flat: Array<{ id: string; node: AdminCategoryTreeNode; hasChildren: boolean; isExpanded: boolean }> = [];
    const isSearching = Boolean(searchQuery.trim());

    function walk(node: AdminCategoryTreeNode) {
      const hasChildren = Boolean(node.children && node.children.length > 0);
      const isExpanded =
        isSearching || (userToggledNodeIds[node.id] ?? selectedAncestorIds.has(node.id));

      flat.push({ id: node.id, node, hasChildren, isExpanded });
      if (hasChildren && isExpanded) {
        node.children.forEach(walk);
      }
    }

    filteredTree.forEach(walk);
    return flat;
  }, [filteredTree, searchQuery, selectedAncestorIds, userToggledNodeIds]);

  // Handle keyboard navigation for the tree
  const handleTreeKeyDown = (e: React.KeyboardEvent) => {
    if (!selectedCategoryId || visibleNodes.length === 0) return;
    const currentIndex = visibleNodes.findIndex((item) => item.id === selectedCategoryId);
    if (currentIndex === -1) return;

    const currentItem = visibleNodes[currentIndex];

    switch (e.key) {
      case "ArrowDown": {
        e.preventDefault();
        const nextIndex = Math.min(currentIndex + 1, visibleNodes.length - 1);
        onSelectCategory(visibleNodes[nextIndex].id);
        break;
      }
      case "ArrowUp": {
        e.preventDefault();
        const prevIndex = Math.max(currentIndex - 1, 0);
        onSelectCategory(visibleNodes[prevIndex].id);
        break;
      }
      case "ArrowRight": {
        e.preventDefault();
        if (currentItem.hasChildren) {
          if (!currentItem.isExpanded) {
            toggleExpand(currentItem.id);
          } else if (currentIndex + 1 < visibleNodes.length) {
            onSelectCategory(visibleNodes[currentIndex + 1].id);
          }
        }
        break;
      }
      case "ArrowLeft": {
        e.preventDefault();
        if (currentItem.hasChildren && currentItem.isExpanded) {
          toggleExpand(currentItem.id);
        } else {
          // Jump to parent if at child
          const parentCategory = categories.find((c) => c.id === currentItem.node.parentId);
          if (parentCategory) {
            onSelectCategory(parentCategory.id);
          }
        }
        break;
      }
      case "Home": {
        e.preventDefault();
        onSelectCategory(visibleNodes[0].id);
        break;
      }
      case "End": {
        e.preventDefault();
        onSelectCategory(visibleNodes[visibleNodes.length - 1].id);
        break;
      }
    }
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      setSearchQuery("");
      searchInputRef.current?.blur();
    }
  };

  const handleConfirmDelete = async (categoryId: string) => {
    if (!onDeleteCategory) return;
    try {
      setIsDeleting(true);
      await onDeleteCategory(categoryId);
      setCategoryToDelete(null);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-[1.8rem] border border-[color-mix(in_srgb,var(--admin-copper-muted)_26%,transparent)] bg-[linear-gradient(180deg,#fffdfa_0%,#faf4ea_100%)] shadow-[0_16px_40px_rgba(6,59,41,0.06)]">
      {/* Panel Header */}
      <div className="border-b border-[color-mix(in_srgb,var(--admin-copper-muted)_20%,transparent)] bg-[#fff8ec]/70 px-4 py-3.5 backdrop-blur-md">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-xl bg-[#063b29] text-[#fff8ec] shadow-sm">
              <FolderTree className="size-4" />
            </div>
            <div>
              <h2 className="text-xs font-black uppercase tracking-[0.16em] text-[var(--admin-canopy-deep)]">
                Marketplace Taxonomy
              </h2>
              <p className="text-[11px] font-medium text-[var(--admin-ink-soft)]">
                {categories.length} categories cataloged
              </p>
            </div>
          </div>

          {canManageCategories ? (
            <Button
              type="button"
              size="sm"
              onClick={onCreateRoot}
              className="h-8 rounded-xl bg-[#075b36] px-3 text-[11px] font-black uppercase tracking-[0.12em] text-[#fff8ec] shadow-sm hover:bg-[#063b29]"
            >
              <Plus className="mr-1 size-3.5" />
              Root
            </Button>
          ) : (
            <span
              title="Requires manage_categories permission"
              className="rounded-lg bg-stone-200 px-2 py-1 text-[10px] font-bold text-stone-500 cursor-not-allowed"
            >
              Read-Only
            </span>
          )}
        </div>

        {/* Search Bar with Escape Shortcut */}
        <div className="relative mt-3">
          <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-stone-400" />
          <Input
            ref={searchInputRef}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            placeholder="Search taxonomy (press Esc to clear)..."
            className="h-9 rounded-xl border-[color-mix(in_srgb,var(--admin-copper-muted)_30%,transparent)] bg-white/90 pl-8.5 pr-8 text-xs font-medium text-stone-900 placeholder:text-stone-400 focus-visible:ring-1 focus-visible:ring-[#075b36]"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              aria-label="Clear taxonomy filter"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Tree Content Container */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        onKeyDown={handleTreeKeyDown}
        tabIndex={0}
        role="tree"
        aria-label="Marketplace category taxonomy tree"
        className="flex-1 overflow-y-auto p-3 scrollbar-none [&::-webkit-scrollbar]:hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-[#075b36]/30"
      >
        {isLoading ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
            <div className="size-6 animate-spin rounded-full border-2 border-[#075b36] border-t-transparent" />
            <p className="text-xs font-semibold text-[var(--admin-ink-soft)]">
              Loading hierarchy...
            </p>
          </div>
        ) : filteredTree.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-stone-300/80 bg-white/50 p-6 text-center">
            <p className="text-xs font-bold text-stone-600">
              {searchQuery ? "No matching categories" : "No categories found"}
            </p>
            <p className="mt-1 text-[11px] text-stone-500">
              {searchQuery
                ? `No nodes match "${searchQuery}". Press Esc to clear.`
                : "Create the first root category to activate product schemas."}
            </p>
            {searchQuery ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setSearchQuery("")}
                className="mt-3 h-8 rounded-xl text-xs font-bold"
              >
                Clear Search (Esc)
              </Button>
            ) : canManageCategories ? (
              <Button
                type="button"
                size="sm"
                onClick={onCreateRoot}
                className="mt-3 h-8 rounded-xl bg-[#075b36] text-xs font-bold text-white hover:bg-[#063b29]"
              >
                <Plus className="mr-1 size-3" />
                Create Root Category
              </Button>
            ) : null}
          </div>
        ) : (
          <div className="space-y-1">
            {filteredTree.map((node) => (
              <TreeNodeItem
                key={node.id}
                node={node}
                depth={0}
                selectedCategoryId={selectedCategoryId}
                selectedAncestorIds={selectedAncestorIds}
                userToggledNodeIds={userToggledNodeIds}
                isSearching={Boolean(searchQuery.trim())}
                onToggleExpand={toggleExpand}
                onSelectCategory={onSelectCategory}
                onCreateChild={onCreateChild}
                onEditCategory={onEditCategory}
                onInitiateDelete={setCategoryToDelete}
                canManageCategories={canManageCategories}
              />
            ))}
          </div>
        )}
      </div>

      {/* Delete Category Confirmation Dialog */}
      <DeleteCategoryConfirmationDialog
        isOpen={Boolean(categoryToDelete)}
        category={categoryToDelete}
        onClose={() => setCategoryToDelete(null)}
        onConfirm={handleConfirmDelete}
        isDeleting={isDeleting}
      />
    </div>
  );
}

interface TreeNodeItemProps {
  node: AdminCategoryTreeNode;
  depth: number;
  selectedCategoryId: string | null;
  selectedAncestorIds: Set<string>;
  userToggledNodeIds: Record<string, boolean>;
  isSearching: boolean;
  onToggleExpand: (nodeId: string, event?: React.MouseEvent) => void;
  onSelectCategory: (categoryId: string) => void;
  onCreateChild: (parentId: string) => void;
  onEditCategory: (category: AdminCategoryRecord) => void;
  onInitiateDelete: (category: AdminCategoryRecord) => void;
  canManageCategories?: boolean;
}

function TreeNodeItem({
  node,
  depth,
  selectedCategoryId,
  selectedAncestorIds,
  userToggledNodeIds,
  isSearching,
  onToggleExpand,
  onSelectCategory,
  onCreateChild,
  onEditCategory,
  onInitiateDelete,
  canManageCategories = true,
}: TreeNodeItemProps) {
  const isSelected = selectedCategoryId === node.id;
  const hasChildren = Boolean(node.children && node.children.length > 0);

  const isExpanded =
    isSearching || (userToggledNodeIds[node.id] ?? selectedAncestorIds.has(node.id));

  const categoryIconDef = useMemo(() => {
    if (!node.icon) return null;
    return CATEGORY_ICON_CATALOG.find((item) => item.value === node.icon) ?? null;
  }, [node.icon]);

  return (
    <div
      role="treeitem"
      aria-expanded={hasChildren ? isExpanded : undefined}
      aria-selected={isSelected}
      tabIndex={isSelected ? 0 : -1}
      className="select-none focus:outline-none"
    >
      <div
        onClick={() => onSelectCategory(node.id)}
        style={{ paddingLeft: `${Math.max(depth * 14 + 6, 6)}px` }}
        className={cn(
          "group relative flex items-center justify-between rounded-xl py-1.5 pr-2 transition-all duration-150 cursor-pointer",
          isSelected
            ? "bg-[#063b29] text-[#fff8ec] shadow-sm font-semibold ring-1 ring-[#063b29]"
            : "text-stone-800 hover:bg-[#f6eedf]/80"
        )}
      >
        {/* Left: Expand Chevron + Icon + Name */}
        <div className="flex min-w-0 items-center gap-1.5">
          {hasChildren ? (
            <button
              type="button"
              aria-label={isExpanded ? "Collapse category" : "Expand category"}
              onClick={(e) => onToggleExpand(node.id, e)}
              className={cn(
                "flex size-5 shrink-0 items-center justify-center rounded hover:bg-black/10 transition-colors",
                isSelected ? "text-[#fff8ec]" : "text-stone-500"
              )}
            >
              {isExpanded ? (
                <ChevronDown className="size-3.5" />
              ) : (
                <ChevronRight className="size-3.5" />
              )}
            </button>
          ) : (
            <span className="size-5 shrink-0" />
          )}

          {categoryIconDef ? (
            <categoryIconDef.Icon
              className={cn(
                "size-3.5 shrink-0",
                isSelected ? "text-[#fff8ec]" : "text-[#075b36]"
              )}
            />
          ) : null}

          <div className="truncate text-xs font-semibold tracking-tight">
            {node.name}
          </div>

          {!node.isActive && (
            <span
              className={cn(
                "ml-1 shrink-0 rounded px-1.5 py-0.2 text-[9px] font-black uppercase tracking-wider",
                isSelected
                  ? "bg-amber-400/30 text-amber-200"
                  : "bg-stone-200 text-stone-600"
              )}
            >
              Hidden
            </span>
          )}
        </div>

        {/* Right: Badges & Quick Actions */}
        <div className="flex shrink-0 items-center gap-1 pl-1">
          {/* Attributes count badge */}
          {node._count.attributes > 0 && (
            <span
              title={`${node._count.attributes} custom attributes configured`}
              className={cn(
                "flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[10px] font-bold",
                isSelected
                  ? "bg-emerald-800/80 text-emerald-200"
                  : "bg-emerald-100 text-emerald-800"
              )}
            >
              <SlidersHorizontal className="size-2.5" />
              {node._count.attributes}
            </span>
          )}

          {/* Product count */}
          {node._count.products > 0 && (
            <span
              title={`${node._count.products} cataloged products`}
              className={cn(
                "rounded-md px-1.5 py-0.5 text-[10px] font-medium",
                isSelected
                  ? "bg-stone-800/80 text-stone-300"
                  : "bg-stone-100 text-stone-600"
              )}
            >
              {node._count.products}p
            </span>
          )}

          {/* Quick Action Buttons (gated by canManageCategories) */}
          {canManageCategories && (
            <div
              className={cn(
                "flex items-center gap-0.5 transition-opacity",
                isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
              )}
            >
              <button
                type="button"
                title="Add Subcategory"
                onClick={(e) => {
                  e.stopPropagation();
                  onCreateChild(node.id);
                }}
                className={cn(
                  "flex size-6 items-center justify-center rounded-lg hover:scale-105 active:scale-95 transition-transform",
                  isSelected
                    ? "bg-[#fff8ec]/20 text-[#fff8ec] hover:bg-[#fff8ec]/30"
                    : "bg-stone-200/80 text-stone-700 hover:bg-stone-300"
                )}
              >
                <Plus className="size-3" />
              </button>
              <button
                type="button"
                title="Edit Category Details"
                onClick={(e) => {
                  e.stopPropagation();
                  onEditCategory(node);
                }}
                className={cn(
                  "flex size-6 items-center justify-center rounded-lg hover:scale-105 active:scale-95 transition-transform",
                  isSelected
                    ? "bg-[#fff8ec]/20 text-[#fff8ec] hover:bg-[#fff8ec]/30"
                    : "bg-stone-200/80 text-stone-700 hover:bg-stone-300"
                )}
              >
                <Pencil className="size-2.5" />
              </button>
              <button
                type="button"
                title="Delete Category"
                onClick={(e) => {
                  e.stopPropagation();
                  onInitiateDelete(node);
                }}
                className={cn(
                  "flex size-6 items-center justify-center rounded-lg hover:scale-105 active:scale-95 transition-transform",
                  isSelected
                    ? "bg-[#fff8ec]/20 text-rose-300 hover:bg-rose-500/40 hover:text-white"
                    : "bg-stone-200/80 text-rose-600 hover:bg-rose-100 hover:text-rose-700"
                )}
              >
                <Trash2 className="size-2.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Render children if expanded */}
      {hasChildren && isExpanded && (
        <div role="group" className="relative mt-0.5 space-y-0.5">
          {/* Connecting hairline guide */}
          <div
            className="absolute bottom-2 top-1 border-l border-stone-300/60"
            style={{ left: `${Math.max(depth * 14 + 15, 15)}px` }}
          />
          {node.children.map((child) => (
            <TreeNodeItem
              key={child.id}
              node={child}
              depth={depth + 1}
              selectedCategoryId={selectedCategoryId}
              selectedAncestorIds={selectedAncestorIds}
              userToggledNodeIds={userToggledNodeIds}
              isSearching={isSearching}
              onToggleExpand={onToggleExpand}
              onSelectCategory={onSelectCategory}
              onCreateChild={onCreateChild}
              onEditCategory={onEditCategory}
              onInitiateDelete={onInitiateDelete}
              canManageCategories={canManageCategories}
            />
          ))}
        </div>
      )}
    </div>
  );
}
