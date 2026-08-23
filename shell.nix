{ pkgs ? import <nixpkgs> {
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
in

pkgs.mkShell {
  packages = with pkgs; [
    flutter
    dart

    androidSdk
    jdk21

    go
    gopls
    gotools

    nodejs
    firebase-tools

    rsync
  ];

  JAVA_HOME = "${pkgs.jdk21}";

  shellHook = ''
    SDK="$PWD/.android-sdk"

    if [ ! -d "$SDK" ]; then
      echo "Initializing local Android SDK..."
      mkdir -p "$SDK"

      rsync -a \
        --chmod=ugo+w \
        "${androidSdk}/libexec/android-sdk/" \
        "$SDK/"
    fi

    export ANDROID_HOME="$SDK"
    export ANDROID_SDK_ROOT="$SDK"

    export PATH="$ANDROID_HOME/platform-tools:$PATH"
    export PATH="$ANDROID_HOME/cmdline-tools/latest/bin:$PATH"

    echo "Android SDK: $ANDROID_HOME"
    echo "Flutter:     $(flutter --version | head -n 1)"
    echo "Dart:        $(dart --version 2>&1)"
    echo "Go:          $(go version)"
    echo "Node:        $(node --version)"
    echo "Firebase:    $(firebase --version)"
    echo "Java:        $(java --version 2>&1 | head -n 1)"
  '';
}
