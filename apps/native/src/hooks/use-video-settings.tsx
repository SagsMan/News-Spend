import NetInfo from "@react-native-community/netinfo";
import { useEffect, useState } from "react";
import { Alert } from "react-native";

import { storage } from "#/utils/storage";

type Settings = {
  wifiOnlyVideo: boolean;
  autoClearCache: boolean;
  dataSaver: boolean;
  autoClearDays: number;
  autoClearThresholdMB: number;
};

type VideoQuality = {
  resolution: string;
  bitrate: number;
  label: string;
};

export const useVideoSettings = () => {
  const [networkState, setNetworkState] = useState<{
    isWifi: boolean;
    isConnected: boolean;
    type: string;
  }>({
    isWifi: false,
    isConnected: false,
    type: "unknown",
  });

  const [settings, setSettings] = useState<Settings>({
    wifiOnlyVideo: false,
    autoClearCache: false,
    dataSaver: false,
    autoClearDays: 7,
    autoClearThresholdMB: 100,
  });

  useEffect(() => {
    loadSettings();
    checkNetworkState();

    const unsubscribe = NetInfo.addEventListener((state) => {
      setNetworkState({
        isConnected: state.isConnected ?? false,
        isWifi: state.type === "wifi",
        type: state.type || "unknown",
      });
    });

    return () => unsubscribe();
  }, [loadSettings, checkNetworkState]);

  const checkNetworkState = async () => {
    try {
      const state = await NetInfo.fetch();
      setNetworkState({
        isConnected: state.isConnected ?? false,
        isWifi: state.type === "wifi",
        type: state.type || "unknown",
      });
    } catch (e) {
      console.error("Error getting network state:", e);
    }
  };

  const loadSettings = () => {
    try {
      const value = storage.getString("video_settings");
      if (value) {
        setSettings(JSON.parse(value));
      }
    } catch (e) {
      console.error("Error loading settings:", e);
    }
  };

  const canPlayVideo = (): boolean => {
    if (!networkState.isConnected) {
      Alert.alert("No Internet", "Please check your connection");
      return false;
    }

    if (settings.wifiOnlyVideo && !networkState.isWifi) {
      Alert.alert(
        "WiFi Only",
        "Video playback is restricted to WiFi. Switch to WiFi to watch."
      );
      return false;
    }

    return true;
  };

  // Should auto-play be enabled?
  const shouldAutoPlay = (): boolean => {
    const isOnMobileData = networkState.isConnected && !networkState.isWifi;

    // Disable auto-play on mobile data when data saver is on
    if (settings.dataSaver && isOnMobileData) {
      return false;
    }

    return true;
  };

  // Get buffer configuration for video
  const getBufferConfig = () => {
    const isOnMobileData = networkState.isConnected && !networkState.isWifi;

    if (settings.dataSaver && isOnMobileData) {
      // Minimal buffering for data saving
      return {
        minBufferMs: 5000, // 5 seconds
        maxBufferMs: 15_000, // 15 seconds
        bufferForPlaybackMs: 1000,
        bufferForPlaybackAfterRebufferMs: 2000,
      };
    }

    // Standard buffering
    return {
      minBufferMs: 15_000, // 15 seconds
      maxBufferMs: 50_000, // 50 seconds
      bufferForPlaybackMs: 2500,
      bufferForPlaybackAfterRebufferMs: 5000,
    };
  };

  // Should prefetch content?
  const shouldPrefetch = (): boolean => {
    const isOnMobileData = networkState.isConnected && !networkState.isWifi;
    return !(settings.dataSaver && isOnMobileData);
  };

  return {
    canPlayVideo,
    shouldAutoPlay,
    getBufferConfig,
    shouldPrefetch,
    isWifi: networkState.isWifi,
    isConnected: networkState.isConnected,
    isDataSaverActive:
      settings.dataSaver && !networkState.isWifi && networkState.isConnected,
    settings,
  };
};
