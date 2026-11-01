/** Shop categories on the backend: /api/v1/admin/shop/categories. Every call needs a token. */
import { ENDPOINTS } from "../config/api";
import { apiRequest, unwrap } from "../lib/api";

export type ShopCategory = {
  id: number | string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  displayOrder: number;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
};

/** Body for create (CreateCategoryRequest) and update (UpdateCategoryRequest). */
export type CategoryInput = { name: string; description: string; imageUrl: string; displayOrder: number };

const base = ENDPOINTS.shopCategories;
const id$ = (id: ShopCategory["id"]) => encodeURIComponent(String(id));

export const shopCategoryService = {
  list: async () => unwrap<ShopCategory[]>(await apiRequest(base)) ?? [],
  get: async (id: ShopCategory["id"]) => unwrap<ShopCategory>(await apiRequest(`${base}/${id$(id)}`)),
  create: async (input: CategoryInput) => unwrap<ShopCategory>(await apiRequest(base, { method: "POST", body: input })),
  update: async (id: ShopCategory["id"], input: CategoryInput) => unwrap<ShopCategory>(await apiRequest(`${base}/${id$(id)}`, { method: "PUT", body: input })),
  setActive: async (id: ShopCategory["id"], active: boolean) => unwrap<ShopCategory>(await apiRequest(`${base}/${id$(id)}/status`, { method: "PATCH", body: { active } })),
};
