import Constants from "expo-constants";

export const getBaseUrl = () => {
  const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "";
  // console.log("API_URL", API_URL);
  console.log("__DEV__", __DEV__);

  if (!__DEV__) {
    return API_URL;
  }

  const debuggerHost =
    Constants.expoGoConfig?.debuggerHost ??
    Constants.manifest2?.extra?.expoGo?.debuggerHost;
  const localhost = debuggerHost?.split(":")[0];

  if (!localhost) {
    throw new Error(
      "Failed to get localhost. Please point to your production server."
    );
  }

  return `http://${localhost}:9000`;
};

// console.log("getBaseUrl", getBaseUrl());
