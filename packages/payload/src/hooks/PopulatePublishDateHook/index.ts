import type { CollectionBeforeChangeHook } from "payload";

export const PopulatePublishDateHook: CollectionBeforeChangeHook = ({
  data,
}) => {
  if (data.publishedDate) {
    return;
  }

  return {
    ...data,
    publishedDate: new Date(),
  };
};
