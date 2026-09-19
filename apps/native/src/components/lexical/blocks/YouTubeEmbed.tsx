import { useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  StyleSheet,
  Text,
  View,
} from "react-native";
import YoutubeIframe from "react-native-youtube-iframe";

function extractVideoId(input: string): string | undefined {
  if (!input) {
    return;
  }
  try {
    const url = new URL(input.trim());
    if (url.hostname.includes("youtu.be")) {
      return url.pathname.slice(1).split("/")[0];
    }
    if (url.hostname.includes("youtube.com")) {
      const parts = url.pathname.split("/").filter(Boolean);
      const shortsIdx = parts.indexOf("shorts");
      if (shortsIdx !== -1 && parts[shortsIdx + 1]) {
        return parts[shortsIdx + 1];
      }
      return (
        url.searchParams.get("v") ??
        url.searchParams.get("video_id") ??
        (parts[0] === "embed" ? parts[1] : undefined)
      );
    }
  } catch {}
}

const screenWidth = Dimensions.get("window").width;
const videoHeight = Math.round(screenWidth * (9 / 16));

export function YouTubeEmbed({
  videoUrl,
  caption,
}: {
  videoUrl: string;
  caption?: string;
}) {
  const [isReady, setIsReady] = useState(false);
  const videoId = extractVideoId(videoUrl);

  if (!videoId) {
    return null;
  }

  return (
    <View style={styles.container}>
      {!isReady && (
        <View style={[styles.loading, { height: videoHeight }]}>
          <ActivityIndicator size="small" />
        </View>
      )}
      <YoutubeIframe
        // width={screenWidth}
        height={videoHeight}
        onReady={() => setIsReady(true)}
        videoId={videoId}
      />
      {caption && <Text style={styles.caption}>{caption}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: "100%", marginVertical: 12 },
  loading: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  caption: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    marginTop: 8,
    paddingHorizontal: 16,
  },
});
