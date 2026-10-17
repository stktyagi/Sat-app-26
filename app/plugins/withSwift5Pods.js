const { withPodfile } = require('@expo/config-plugins');

const ANCHOR = `      :ccache_enabled => ccache_enabled?(podfile_properties),
    )
`;

// Xcode 27 builds pods in Swift 6 language mode by default, and many third-party pods
// (react-native-video, RNScreens, react-native-easebuzz-sdk, ...) fail strict concurrency checks.
// The app target keeps its own Swift version; only the Pods project is pinned to Swift 5.
const SNIPPET = `
    # Build all pods in Swift 5 language mode (Xcode 27 defaults to Swift 6 and pods fail strict concurrency checks).
    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |build_configuration|
        build_configuration.build_settings['SWIFT_VERSION'] = '5.0'
      end
    end
`;

module.exports = (config) =>
  withPodfile(config, (config) => {
    const contents = config.modResults.contents;
    if (!contents.includes(ANCHOR)) {
      throw new Error(
        'withSwift5Pods: could not find the react_native_post_install block in the Podfile. The Expo template may have changed.'
      );
    }
    if (!contents.includes("installer.pods_project.targets.each")) {
      config.modResults.contents = contents.replace(ANCHOR, ANCHOR + SNIPPET);
    }
    return config;
  });
