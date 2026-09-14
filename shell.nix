{ pkgs ? import (fetchTarball "https://github.com/NixOS/nixpkgs/archive/nixos-unstable.tar.gz") {
    config = {
      allowUnfree = true;
      android_sdk.accept_license = true;
    };
  }
}:
let
  androidComposition = pkgs.androidenv.composeAndroidPackages {
    platformVersions = [ "36" ];
    buildToolsVersions = [ "36.0.0" ];
    includeNDK = false;
    includeEmulator = false;
    includeSystemImages = false;
    includeSources = false;
  };
  androidSdk = androidComposition.androidsdk;
  libs = with pkgs; [
    glib
  ];
  pkgConfigPackages = (map (pkg: pkg.dev or pkg) libs);
  pkgConfigPath = pkgs.lib.concatStringsSep ":" [
    (pkgs.lib.makeSearchPath "lib/pkgconfig" pkgConfigPackages)
    (pkgs.lib.makeSearchPath "share/pkgconfig" pkgConfigPackages)
  ];
in
pkgs.mkShell {
  buildInputs = with pkgs; [
    nodejs_22
    androidSdk
  ];
  shellHook = ''
    export PKG_CONFIG_PATH="$GIMP_PREFIX/lib/pkgconfig:$GIMP_PREFIX/share/pkgconfig:${pkgConfigPath}:$PKG_CONFIG_PATH"
    export ANDROID_HOME="$SDK"
    export ANDROID_SDK_ROOT="$SDK"

    export PATH="$ANDROID_HOME/platform-tools:$PATH"
    export PATH="$ANDROID_HOME/cmdline-tools/latest/bin:$PATH"
  '';
  JAVA_HOME = "${pkgs.jdk21}";
}
