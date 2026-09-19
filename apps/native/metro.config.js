// Learn more https://docs.expo.io/guides/customizing-metro
const { withRozenite } = require("@rozenite/metro");
const { getSentryExpoConfig } = require("@sentry/react-native/metro");
const { withUniwindConfig } = require("uniwind/metro");
// const { withFacetpack } = require("@ecrindigital/facetpack");
// const { FileStore } = require("@expo/metro/metro-cache");
const _path = require("node:path");
const os = require("node:os");

// biome-ignore lint/correctness/noGlobalDirnameFilename: we can't use import.meta.dirname
const config = getSentryExpoConfig(__dirname);

config.resolver.unstable_enablePackageExports = true;
config.maxWorkers = Math.max(1, Math.floor(os.cpus().length * 0.5));

// config.cacheStores = [
//   new FileStore({
//     root: path.join(__dirname, "node_modules", ".cache", "metro"),
//   }),
// ];

// Wrap with Uniwind first, then Rozenite
module.exports = withRozenite(
  withUniwindConfig(config, {
    cssEntryFile: "./src/global.css",
    dtsFile: "./src/uniwind-types.d.ts",
  }),
  { enabled: process.env.WITH_ROZENITE === "true" }
);
