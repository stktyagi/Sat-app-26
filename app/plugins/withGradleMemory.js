const { withGradleProperties, AndroidConfig } = require('@expo/config-plugins');

module.exports = function withGradleMemory(config) {
  return withGradleProperties(config, (config) => {
    config.modResults = AndroidConfig.BuildProperties.updateAndroidBuildProperty(
      config.modResults,
      'org.gradle.jvmargs',
      '-Xmx4096m -XX:MaxMetaspaceSize=1024m'
    );
    return config;
  });
};
