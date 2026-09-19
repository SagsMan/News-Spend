import type {
  AdsBlock,
  InstagramEmbedBlock,
  News,
  ReadAlsoBlock,
  TwitterPostBlock,
  YouTubeEmbedBlock,
} from "@news-spend-media/payload/types";
import { View } from "react-native";
import BannerAds from "#/components/Ads/BannerAds";
import { InstagramEmbed } from "#/components/lexical/blocks/InstagramEmbed";
import { TwitterEmbed } from "#/components/lexical/blocks/TwitterEmbed";
import { YouTubeEmbed } from "#/components/lexical/blocks/YouTubeEmbed";
import ReadAlso from "./blocks/read-also";
import type { BlockRenderers } from "./types";

export const defaultBlockRenders: BlockRenderers<{
  ads: AdsBlock;
  instagramEmbed: InstagramEmbedBlock;
  readAlso: ReadAlsoBlock;
  twitterEmbed: TwitterPostBlock;
  youtubeEmbed: YouTubeEmbedBlock;
}> = {
  ads: (props) => (
    <View className="my-3 items-center justify-center">
      <BannerAds size={props.fields.type} />
    </View>
  ),
  instagramEmbed: (props) => (
    <InstagramEmbed
      caption={props.fields.caption ?? ""}
      postUrl={props.fields.postUrl}
    />
  ),
  readAlso: (props) => <ReadAlso news={props.fields.news as News} />,
  twitterEmbed: (props) => <TwitterEmbed tweetId={props.fields.tweetId} />,
  youtubeEmbed: (props) => (
    <YouTubeEmbed
      caption={props.fields.caption ?? ""}
      videoUrl={props.fields.videoUrl}
    />
  ),
};
