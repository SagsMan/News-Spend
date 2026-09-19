import type { UploadField } from "payload";
import { deepMerge } from "payload";

export type MediaFieldOverrides = {
  mediaOverrides?: Partial<UploadField>;
};

type MediaField = (overrides?: MediaFieldOverrides) => [UploadField];

export const mediaField: MediaField = (overrides = {}) => {
  const { mediaOverrides = {} } = overrides;

  const mediaField = deepMerge<UploadField>(
    {
      label: "Media",
      name: "media",
      relationTo: "media",
      type: "upload",
    },
    mediaOverrides
  );

  return [mediaField];
};
