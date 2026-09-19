import { useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import WebView from "react-native-webview";

function extractTweetId(input: string): string | undefined {
  if (!input) {
    return;
  }

  const trimmed = input.trim();

  if (/^\d+$/.test(trimmed)) {
    return trimmed;
  }

  try {
    const url = new URL(trimmed);
    const pathParts = url.pathname.split("/").filter(Boolean);
    if (
      url.hostname.includes("twitter.com") ||
      url.hostname.includes("x.com")
    ) {
      const statusIndex = pathParts.indexOf("status");
      if (statusIndex !== -1 && pathParts[statusIndex + 1]) {
        return pathParts[statusIndex + 1];
      }
    }
  } catch {
    // Invalid URL
  }

  return;
}

export function TwitterEmbed({
  tweetId,
  theme = "light",
}: {
  tweetId: string;
  theme?: string;
}) {
  const [webViewHeight, setWebViewHeight] = useState(200);

  const tweetIdValue = extractTweetId(tweetId);

  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0"
        />
        <script
          async
          src="https://platform.twitter.com/widgets.js"
          charset="utf-8"
        ></script>
        <script>
          window.addEventListener("DOMContentLoaded", function () {
            const observer = new MutationObserver(function (mutations) {
              const iframe = document.querySelector('#twitter-widget-0');
              if (iframe && iframe.style.height) {
                const height = parseInt(iframe.style.height);
                window.ReactNativeWebView.postMessage(height.toString());
              }
            });

            observer.observe(document.body, {
              childList: true,
              subtree: true,
              attributes: true,
              attributeFilter: ['style']
            });
          });
        </script>
      </head>
      <body style="margin: 0; padding: 0; background-color: transparent">
        <blockquote class="twitter-tweet" data-theme="${theme}">
          <a href="https://twitter.com/i/status/${tweetIdValue}"></a>
        </blockquote>
      </body>
    </html>
    `;

  if (!tweetIdValue) {
    return null;
  }

  return (
    <View style={[styles.container, { height: (webViewHeight ?? 200) + 25 }]}>
      <WebView
        onMessage={(event) => {
          const height = Number.parseInt(event.nativeEvent.data, 10);
          setWebViewHeight(height);
        }}
        renderLoading={() => (
          <View style={styles.loading}>
            <ActivityIndicator size="small" />
          </View>
        )}
        scrollEnabled={false}
        source={{ html: htmlContent }}
        startInLoadingState={true}
        style={styles.webview}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
  },
  webview: {
    backgroundColor: "transparent",
  },
  loading: {
    height: 200,
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
});
