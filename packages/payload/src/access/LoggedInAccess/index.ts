import type { User } from "@news-spend-media/payload/payload-types";
import type { FieldAccess, TypeWithID } from "payload";

export const LoggedInAccess: FieldAccess<TypeWithID, User> = ({
  req: { user },
}) => Boolean(user);
