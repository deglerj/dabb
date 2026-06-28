import { ConfigPlugin, withGradleProperties } from 'expo/config-plugins';

const withAndroidGradleProperties: ConfigPlugin = (config) =>
  withGradleProperties(config, (config) => {
    const props = config.modResults;
    const settings = [
      { key: 'org.gradle.daemon', value: 'false' },
      { key: 'org.gradle.java.installations.auto-download', value: 'false' },
      { key: 'org.gradle.java.installations.fromEnv', value: 'JAVA_HOME' },
    ];
    for (const { key, value } of settings) {
      const idx = props.findIndex((p) => p.type === 'property' && 'key' in p && p.key === key);
      if (idx !== -1) {
        props.splice(idx, 1);
      }
      props.push({ type: 'property', key, value });
    }
    return config;
  });

export default withAndroidGradleProperties;
