import type {
  PartnerContent,
  PromoImage,
  PromoVideoSource,
} from "@news-spend-media/payload/types";

export type AdCarouselRef = {
  play: () => void;
  pause: () => void;
  isPlaying: () => boolean;
};

export type AdCarouselProps = {
  item: PartnerContent;
};

export type CarouselItemData = {
  layout?: (PromoVideoSource | PromoImage)[] | null | undefined;
  id?: string | null | undefined;
};
