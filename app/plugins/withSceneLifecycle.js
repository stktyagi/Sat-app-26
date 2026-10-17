const fs = require('fs');
const path = require('path');
const {
  withAppDelegate,
  withDangerousMod,
  withInfoPlist,
  withXcodeProject,
} = require('@expo/config-plugins');

const SCENE_DELEGATE_FILE = 'SceneDelegate.swift';

const SCENE_DELEGATE_SOURCE = `internal import Expo

@objc(SceneDelegate)
class SceneDelegate: ExpoAppSceneDelegate {
  // Extension point for config plugins.
}
`;

function withSceneManifest(config) {
  return withInfoPlist(config, (config) => {
    config.modResults.UIApplicationSceneManifest = {
      UIApplicationSupportsMultipleScenes: false,
      UISceneConfigurations: {
        UIWindowSceneSessionRoleApplication: [
          {
            UISceneConfigurationName: 'Default Configuration',
            UISceneDelegateClassName: '$(PRODUCT_MODULE_NAME).SceneDelegate',
          },
        ],
      },
    };
    return config;
  });
}

function withSceneDelegateFile(config) {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const dir = path.join(
        config.modRequest.platformProjectRoot,
        config.modRequest.projectName
      );
      fs.writeFileSync(path.join(dir, SCENE_DELEGATE_FILE), SCENE_DELEGATE_SOURCE);
      return config;
    },
  ]);
}

function withSceneDelegateTarget(config) {
  return withXcodeProject(config, (config) => {
    const project = config.modResults;
    const filePath = path.join(config.modRequest.projectName, SCENE_DELEGATE_FILE);
    if (!project.hasFile(filePath)) {
      const groupKey = project.findPBXGroupKey({ name: config.modRequest.projectName });
      project.addSourceFile(
        filePath,
        { target: project.getFirstTarget().uuid },
        groupKey
      );
    }
    return config;
  });
}

function withAppDelegateForScenes(config) {
  return withAppDelegate(config, (config) => {
    let src = config.modResults.contents;

    src = src.replace(
      /class AppDelegate: ExpoAppDelegate \{/,
      'class AppDelegate: ExpoAppDelegate, ExpoReactNativeFactoryProvider {'
    );
    src = src.replace(
      /#if os\(iOS\) \|\| os\(tvOS\)\n\s*window = UIWindow[\s\S]*?#endif\n/,
      ''
    );

    if (!src.includes('FirebaseApp.configure()')) {
      src = src.replace(
        /(didFinishLaunchingWithOptions launchOptions: \[UIApplication\.LaunchOptionsKey: Any\]\? = nil\n\s*\) -> Bool \{\n)/,
        '$1    FirebaseApp.configure()\n'
      );
    }

    if (!src.includes('ExpoReactNativeFactoryProvider {') || src.includes('window = UIWindow(')) {
      throw new Error(
        'withSceneLifecycle: could not update AppDelegate.swift for the scene lifecycle. The Expo template may have changed.'
      );
    }

    config.modResults.contents = src;
    return config;
  });
}

module.exports = (config) => {
  config = withSceneManifest(config);
  config = withSceneDelegateFile(config);
  config = withSceneDelegateTarget(config);
  config = withAppDelegateForScenes(config);
  return config;
};
