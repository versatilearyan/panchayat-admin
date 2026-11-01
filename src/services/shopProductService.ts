/** Shop products on the backend: /api/v1/admin/shop/products. Every call needs a token. */
import { ENDPOINTS } from "../config/api";
import { apiRequest, unwrap } from "../lib/api";
import type { ShopCategory } from "./shopCategoryService";

export type ShopProduct = {
  id: number | string;
  categoryId: ShopCategory["id"];
  categoryName?: string | null;
  name: string;
  description: string | null;
  price: number;
  rarity: string | null;
  assetUrl: string | null;
  displayOrder: number;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
};

/** Body for create (the category must exist and be active) and update. */
export type ProductInput = {
  categoryId: ShopCategory["id"];
  name: string;
  description: string;
  price: number;
  rarity: string;
  assetUrl: string;
  displayOrder: number;
};

const base = ENDPOINTS.shopProducts;
const id$ = (id: ShopProduct["id"]) => encodeURIComponent(String(id));

export const shopProductService = {
  /** Every product, including ones taken off sale. */
  list: async () => unwrap<ShopProduct[]>(await apiRequest(base)) ?? [],
  get: async (id: ShopProduct["id"]) => unwrap<ShopProduct>(await apiRequest(`${base}/${id$(id)}`)),
  listByCategory: async (categoryId: ShopCategory["id"]) => unwrap<ShopProduct[]>(await apiRequest(`${base}/category/${id$(categoryId)}`)) ?? [],
  create: async (input: ProductInput) => unwrap<ShopProduct>(await apiRequest(base, { method: "POST", body: input })),
  update: async (id: ShopProduct["id"], input: ProductInput) => unwrap<ShopProduct>(await apiRequest(`${base}/${id$(id)}`, { method: "PUT", body: input })),
  setActive: async (id: ShopProduct["id"], active: boolean) => unwrap<ShopProduct>(await apiRequest(`${base}/${id$(id)}/status`, { method: "PATCH", body: { active } })),
};
