import type { CollectionConfig } from "payload";

import { autoHideReportedContent } from "../hooks/contentReport/autoHideReportedContent";
import { notifyAdminsOnReport } from "../hooks/contentReport/notifyAdmins";

export const ContentReport: CollectionConfig = {
  slug: "contentReports",
  admin: {
    useAsTitle: "reason",
    defaultColumns: ["reportedItem", "reason", "status", "reportedBy"],
  },
  fields: [
    {
      name: "type",
      type: "select",
      defaultValue: "report",
      index: true,
      options: [
        { label: "Content Report", value: "report" },
        { label: "User Block", value: "block" },
        { label: "Content Filter Rejection", value: "filterRejection" },
      ],
      admin: {
        description:
          "How this record was created. Blocks and filter rejections are recorded for visibility and are not actionable reports. Records created before this field existed have no value and are inferred from their details text.",
      },
    },
    {
      name: "reason",
      type: "select",
      required: true,
      options: [
        { label: "Spam or Advertising", value: "spam" },
        { label: "Harassment or Bullying", value: "harassment" },
        { label: "Hate Speech or Discrimination", value: "hate-speech" },
        { label: "Misinformation", value: "misinformation" },
        { label: "Personal Information", value: "personal-info" },
        { label: "Explicit or Inappropriate Content", value: "inappropriate" },
        { label: "Off-Topic", value: "off-topic" },
        { label: "Trolling or Deliberate Provocation", value: "trolling" },
        { label: "Illegal Activity", value: "illegal" },
        { label: "Other", value: "other" },
      ],
    },
    {
      name: "additionalDetails",
      type: "textarea",
    },
    {
      name: "reportedItem",
      type: "relationship",
      relationTo: ["comments", "news"],
      admin: {
        description:
          "The reported content. Optional: not set for user-level actions (e.g. blocking).",
      },
    },
    {
      name: "reportedBy",
      type: "relationship",
      relationTo: "users",
      required: true,
      admin: {
        readOnly: true,
      },
    },
    {
      name: "status",
      type: "select",
      defaultValue: "pending",
      options: [
        { label: "Pending", value: "pending" },
        { label: "Under Review", value: "reviewing" },
        { label: "Resolved", value: "resolved" },
        { label: "Dismissed", value: "dismissed" },
      ],
    },
    {
      name: "moderatorNotes",
      type: "textarea",
    },
    {
      name: "resolution",
      type: "select",
      options: [
        { label: "No Action Needed", value: "noAction" },
        { label: "Warning Issued", value: "warning" },
        { label: "Content Removed", value: "removed" },
        { label: "User Suspended", value: "suspended" },
        { label: "User Banned", value: "banned" },
      ],
    },
    {
      name: "resolvedBy",
      type: "relationship",
      relationTo: "admins",
      admin: {
        readOnly: true,
      },
    },
    {
      name: "resolvedAt",
      type: "date",
      admin: {
        readOnly: true,
      },
    },
  ],
  hooks: {
    afterChange: [autoHideReportedContent, notifyAdminsOnReport],
    beforeChange: [
      ({ data, req }) => {
        if (data.status === "resolved" && !data.resolvedAt) {
          data.resolvedAt = new Date().toISOString();
          data.resolvedBy = req.user?.id;
        }
        return data;
      },
    ],
  },
};
