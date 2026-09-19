"use client";
import type { LexicalBlockClientProps } from "@payloadcms/richtext-lexical";
import {
  BlockCollapsible,
  BlockEditButton,
  BlockRemoveButton,
} from "@payloadcms/richtext-lexical/client";
import { useFormFields } from "@payloadcms/ui";

export const MyBlockComponent: React.FC<LexicalBlockClientProps> = () => {
  const style = useFormFields(([fields]) => fields.style);

  return (
    <BlockCollapsible removeButton={false}>
      <div>Style: {(style?.value as string) ?? "none"}</div>
      <div>
        You can manually render the remove and edit buttons if you want to:
      </div>
      <div style={{ display: "flex" }}>
        <BlockEditButton />
        <BlockRemoveButton />
      </div>
    </BlockCollapsible>
  );
};
