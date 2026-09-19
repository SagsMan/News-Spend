import type { CollectionConfig } from "payload";

const VerificationOTP: CollectionConfig = {
  slug: "verification-otp",
  admin: {
    hidden: process.env.NODE_ENV === "production",
  },
  fields: [
    {
      name: "otp",
      type: "number",
      required: true,
    },
    {
      name: "token",
      type: "text",
      required: true,
    },
    {
      name: "userId",
      type: "number",
      required: true,
    },
    {
      name: "createdAt",
      type: "date",
      defaultValue: () => new Date().toISOString(),
    },
  ],
};

export default VerificationOTP;
