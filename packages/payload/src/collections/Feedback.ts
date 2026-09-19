import type { CollectionConfig } from "payload";

const Feedback: CollectionConfig = {
  slug: "feedback",
  fields: [
    {
      name: "name",
      type: "text",
      required: true,
    },
    {
      name: "email",
      type: "text",
      required: true,
    },
    {
      name: "type",
      type: "select",
      options: [
        { label: "General Feedback", value: "general" },
        { label: "Bug Report", value: "bug" },
        { label: "Feature Request", value: "feature" },
        { label: "Advertisement inquiry", value: "advertisement" },
        { label: "Other", value: "other" },
      ],
      required: true,
    },
    {
      name: "message",
      type: "textarea",
      required: true,
    },
    {
      name: "rating",
      type: "number",
      required: true,
      validate: (val: any) => {
        if (val < 1 || val > 5) {
          return "Rating must be between 1 and 5";
        }
        return true;
      },
    },
  ],
};

export default Feedback;
