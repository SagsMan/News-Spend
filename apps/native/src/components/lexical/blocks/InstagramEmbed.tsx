import { useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import WebView from "react-native-webview";
import { Text } from "#/components/heroui/text";

function extractPostId(input: string): string | undefined {
  if (!input) {
    return;
  }
  const trimmed = input.trim();
  try {
    const url = new URL(trimmed);
    if (url.hostname.includes("instagram.com")) {
      const pathParts = url.pathname.split("/").filter(Boolean);
      for (const type of ["p", "reel", "tv"]) {
        const idx = pathParts.indexOf(type);
        if (idx !== -1 && pathParts[idx + 1]) {
          return `${type}/${pathParts[idx + 1]}`;
        }
      }
    }
  } catch {}
}

const INJECTED_JS = `
  (function() {
    var attempts = 0;
    var interval = setInterval(function() {
      var el = document.querySelector('.instagram-media');
      var h = document.documentElement.scrollHeight;
      attempts++;
      if ((el && el.offsetHeight > 200) || attempts > 30) {
        clearInterval(interval);
        window.ReactNativeWebView.postMessage(String(h));
      }
    }, 300);
  })();
  true;
`;

function buildHtml(postId: string) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no, user-scalable=no" />
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { background: transparent; overflow: hidden; }
    .instagram-media {
      min-width: unset !important;
      width: 100% !important;
      max-width: 100% !important;
    }
  </style>
</head>
<body>
  <blockquote
    class="instagram-media"
    data-instgrm-permalink="https://www.instagram.com/${postId}/"
    data-instgrm-version="14"
    style="width:100%;"
  ></blockquote>
  <script async src="https://www.instagram.com/embed.js"></script>
</body>
</html>`;
}

export function InstagramEmbed({
  postUrl,
  caption,
}: {
  postUrl: string;
  caption?: string;
}) {
  const [webViewHeight, setWebViewHeight] = useState(480);
  const [isLoaded, setIsLoaded] = useState(false);
  const postId = extractPostId(postUrl);

  if (!postId) {
    return null;
  }

  return (
    <View className="my-3 w-full">
      <View
        className="w-full overflow-hidden"
        style={{ height: webViewHeight }}
      >
        {isLoaded ? null : (
          <View className="absolute inset-0 h-120 items-center justify-center">
            <ActivityIndicator size="small" />
          </View>
        )}
        <WebView
          domStorageEnabled
          injectedJavaScript={INJECTED_JS}
          javaScriptEnabled
          mixedContentMode="always"
          onMessage={(event) => {
            const height = Number.parseInt(event.nativeEvent.data, 10);
            if (height > 100) {
              setWebViewHeight(height);
              setIsLoaded(true);
            }
          }}
          originWhitelist={["*"]}
          scrollEnabled={false}
          source={{ html: buildHtml(postId) }}
          style={[styles.webview, !isLoaded && styles.hidden]}
        />
      </View>
      {caption && (
        <Text className="px-4 pt-2 text-center text-gray-50">{caption}</Text>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  webview: {
    flex: 1,
    backgroundColor: "transparent",
  },
  hidden: {
    opacity: 0,
  },
});
