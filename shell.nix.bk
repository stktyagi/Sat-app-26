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
  flutterVersion = "3.47.1";
  flutterSrc = pkgs.stdenv.mkDerivation rec {
    pname = "flutter-src";
    version = flutterVersion;

    src = pkgs.fetchurl {
      url = "https://storage.googleapis.com/flutter_infra_release/releases/stable/linux/flutter_linux_${version}-stable.tar.xz";
      hash = "sha256-odgWbAMJJny33JnxQk7s8IuGlGrTtQcjxvWZRZZK6kU=";
    };

    sourceRoot = "flutter";

    # nativeBuildInputs = [
    #   pkgs.autoPatchelfHook
    # ];
    #
    # buildInputs = with pkgs; [
    #   glib
    #   gtk3
    #   nss
    #   libGL
    #   libglvnd
    #
    #   libx11
    #   libxext
    #   libxrender
    #   libxrandr
    #   libxi
    #   libxcursor
    #   libxdamage
    #   libxtst
    # ];

    installPhase = ''
      mkdir -p $out
      cp -r . $out/
    '';
  };
in

pkgs.mkShell {
  packages = with pkgs; [
    flutter

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

    # export PATH="${flutter}/bin:$PATH"
    #
    # git config --global --add safe.directory "${flutter}"
  shellHook = ''
    export FLUTTER_ROOT="$PWD/.flutter-sdk"

    if [ ! -d "$FLUTTER_ROOT" ]; then
      echo "Initializing Flutter ${flutterVersion}..."

      mkdir -p "$FLUTTER_ROOT"
      cp -a ${flutterSrc}/. "$FLUTTER_ROOT/"

      chmod -R u+w "$FLUTTER_ROOT"
    fi

    export PATH="$FLUTTER_ROOT/bin:$PATH"

    if [ ! -d "$HOME/.config/shorebird" ]; then
      echo "Shorebird not found. Installing..."

      curl --proto '=https' --tlsv1.2 https://raw.githubusercontent.com/shorebirdtech/install/main/install.sh -sSf | bash

      echo "Shorebird installed."
    fi

    export PATH="$HOME/.config/shorebird/bin:$PATH"
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
    # export PATH="$HOME/.config/shorebird/bin/cache/flutter/91f8bd75076e9c740aa13cf67eb9ec1a093f68f5/bin:$PATH"
