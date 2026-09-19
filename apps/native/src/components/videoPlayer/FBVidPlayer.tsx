import { useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { WebView } from "react-native-webview";

const FacebookVideoPlayer = ({ videoUrl }) => {
  const webViewRef = useRef(null);
  const [playerState, setPlayerState] = useState("initializing");
  const [isReady, setIsReady] = useState(false);

  const embedHtml = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <title>Home</title>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width" />
  </head>
  <body>
    <script>
      var my_video_player;
      let fbReady = false;
      window.fbAsyncInit = function () {
        FB.init({
          appId: "756414145201391",
          xfbml: true,
          version: "v3.2",
        });
        // Get Embedded Video Player API Instance
        FB.Event.subscribe("xfbml.ready", function (msg) {
          if (msg.type === "video") {
            my_video_player = msg.instance;
            init(msg.instance);
          }
        });
      };

      function init(fb) {
        alert(fb);
        fb.play();
        fb.subscribe("startedPlaying", function (e) {
          console.log("playing: ");
        });
        fb.subscribe("paused", function (e) {
          console.log("paused: ");
        });
        fb.subscribe("finishedPlaying", function (e) {
          console.log("finished playing: ");
        });
        fb.subscribe("startedBuffering", function (e) {
          console.log("started buffering: ");
        });
        fb.subscribe("finishedBuffering", function (e) {
          console.log("finish buffering: ");
        });
        fb.subscribe("error", function (e) {
          console.log("error: ");
        });

        document
          .getElementById("playPauseBtn")
          .addEventListener("click", (e) => {
          alert("play")
            my_video_player.play();
          });
      }
    </script>
    <div id="fb-root"></div>
    <script
      async
      defer
      src="https://connect.facebook.net/en_US/sdk.js"
    ></script>

    <!-- Your embedded video player code -->
    <div
      class="fb-video"
      data-href="https://www.facebook.com/facebook/videos/10153231379946729/"
      data-width="500"
      data-allowfullscreen="true"
    ></div>
    <button type="button" id="playPauseBtn">play/pause</button>
  </body>
</html>

  `;

  const debugging = `
     // Debug
     console = new Object();
     console.log = function(log) {
       window.ReactNativeWebView.postMessage(log);
     };
     console.debug = console.log;
     console.info = console.log;
     console.warn = console.log;
     console.error = console.log;
     `;

  const handleMessage = (event) => {
    console.log(event.nativeEvent.data);
    const data = JSON.parse(event.nativeEvent.data);
    if (data.type === "playerReady") {
      setIsReady(true);
    } else if (data.type === "stateUpdate") {
      setPlayerState(data.state);
    }
  };

  const sendMessage = (message) => {
    webViewRef.current.postMessage(JSON.stringify(message));
  };

  const _play = () => sendMessage({ action: "play" });
  const _pause = () => sendMessage({ action: "pause" });
  const _seek = (time) => sendMessage({ action: "seek", time });

  return (
    <View style={styles.container}>
      <WebView
        allowsFullscreenVideo
        domStorageEnabled
        injectedJavaScript={debugging}
        javaScriptEnabled
        onMessage={handleMessage}
        ref={webViewRef}
        scalesPageToFit
        source={{ html: embedHtml }}
        startInLoadingState
        style={styles.webview}
      />
      <View style={styles.stateDisplay}>
        <Text>Player State: {playerState}</Text>
        <Text>Player Ready: {isReady ? "Yes" : "No"}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  webview: {
    flex: 1,
  },
  controls: {
    flexDirection: "row",
    justifyContent: "space-around",
    padding: 10,
  },
  stateDisplay: {
    padding: 10,
    alignItems: "center",
  },
});

export default FacebookVideoPlayer;
