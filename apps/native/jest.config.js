/** @type {import('jest').Config} */
module.exports = {
  preset: "jest-expo",
  setupFiles: ["./jest.setup.tsx"],
  moduleNameMapper: {
    // The workspace hoists a second React (root 19.2.8) alongside this app's
    // own (19.2.3), and react-test-renderer resolves the hoisted one. A
    // component rendered under RTL then calls hooks on a different React
    // instance than the renderer installed, so the dispatcher is null and the
    // first useState throws. Pin every specifier to the copy that matches
    // react-test-renderer.
    "^react$": "<rootDir>/../../node_modules/react",
    "^react/(.*)$": "<rootDir>/../../node_modules/react/$1",
    "^react-native-keyboard-controller$":
      "react-native-keyboard-controller/jest",
    "^heroui-native$": "<rootDir>/src/__mocks__/heroui-native.tsx",
    "^heroui-native/(.*)$": [
      "<rootDir>/src/__mocks__/heroui-native/$1.tsx",
      "<rootDir>/src/__mocks__/heroui-native.tsx",
    ],
  },
};
