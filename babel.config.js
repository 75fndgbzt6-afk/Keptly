module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // Required so Reanimated worklets are compiled to run on the UI thread.
    // Must be listed last among plugins.
    plugins: ['react-native-reanimated/plugin'],
  };
};
