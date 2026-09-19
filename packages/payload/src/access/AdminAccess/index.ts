import type { User } from "@news-spend-media/payload/payload-types";
import type { FieldAccess, TypeWithID } from "payload";

export const AdminAccess: FieldAccess<TypeWithID, User> = ({ req: { user } }) =>
  user?.role === "admin";
