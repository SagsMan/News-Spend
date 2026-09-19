import type { Access } from "payload";

import type { Admin } from "../payload-types";

export const hasRole =
  (role: Admin["role"]): Access =>
  ({ req: { user } }) =>
    user?.role === role;

export const adminOnly: Access = hasRole("super-admin");
