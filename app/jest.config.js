module.exports = {
  preset: "jest-expo",
  transformIgnorePatterns: [
    "node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|@tanstack/react-query)"
  ],
  moduleNameMapper: {
    "^react-native/setup-env$": "<rootDir>/jest-setup.js",
    "^@/(.*)$": "<rootDir>/src/$1",
    "^test-renderer$": "react-test-renderer"
  }
};
