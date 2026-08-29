const m = require('module');
const orig = m._load;
m._load = function(request, parent, isMain) {
  if (request === 'react-native') {
    return { Platform: { OS: 'ios' }, NativeModules: {}, NativeEventEmitter: class {} };
  }
  return orig(request, parent, isMain);
};
try {
  const auth = require('@react-native-firebase/auth');
  console.log("KEYS:", Object.keys(auth));
} catch (e) {
  console.log(e);
}
