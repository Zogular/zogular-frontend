export type AdminCategoryRecord = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  parentId: string | null;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  _count: {
    children: number;
    products: number;
    attributes: number;
  };
};

export type AdminCategoryTreeNode = AdminCategoryRecord & {
  children: AdminCategoryTreeNode[];
};

export type AdminCategoryPayload = {
  name: string;
  slug?: string;
  description?: string;
  icon?: string;
  parentId?: string | null;
  isActive?: boolean;
  sortOrder?: number;
};
