#!/bin/bash
set -e

export ANDROID_HOME=/opt/android-sdk
export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64

# Setup SDK
mkdir -p $ANDROID_HOME/cmdline-tools
cp -r /tmp/cmdline-tools-tmp/cmdline-tools $ANDROID_HOME/cmdline-tools/latest 2>/dev/null || true
echo "SDK tools at: $ANDROID_HOME/cmdline-tools/latest/bin/"
ls $ANDROID_HOME/cmdline-tools/latest/bin/

# Accept licenses
yes | $ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager --licenses 2>/dev/null || true

# Install platform and build tools
$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager 'platforms;android-34' 'build-tools;34.0.0'
echo "=== SDK SETUP COMPLETE ==="

# Build APK
cd /root/square15management/android

# Copy foreground icons (same as ic_launcher but used by adaptive icon)
for density in mdpi hdpi xhdpi xxhdpi xxxhdpi; do
  cp "app/src/main/res/mipmap-${density}/ic_launcher.png" "app/src/main/res/mipmap-${density}/ic_launcher_foreground.png" 2>/dev/null || true
done

# Create local.properties
echo "sdk.dir=$ANDROID_HOME" > local.properties

# Generate debug keystore
keytool -genkey -v \
  -keystore app/debug.keystore \
  -storepass android \
  -alias androiddebugkey \
  -keypass android \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000 \
  -dname "CN=Square 15, OU=Dev, O=Square15, L=Johannesburg, ST=Gauteng, C=ZA" 2>/dev/null || true

# Install gradle wrapper
gradle wrapper --gradle-version 8.5 2>/dev/null || {
  echo "Gradle not found, downloading wrapper..."
  wget -q https://services.gradle.org/distributions/gradle-8.5-bin.zip -O /tmp/gradle.zip
  mkdir -p /opt/gradle
  unzip -qo /tmp/gradle.zip -d /opt/gradle
  export PATH="/opt/gradle/gradle-8.5/bin:$PATH"
  gradle wrapper --gradle-version 8.5
}

chmod +x gradlew

# Build debug APK
./gradlew assembleDebug --no-daemon

# Copy APK to public directory and download directory
cp app/build/outputs/apk/debug/app-debug.apk /root/square15management/public/square15-app.apk
cp app/build/outputs/apk/debug/app-debug.apk /var/www/downloads/square15-app.apk
echo "=== APK BUILD COMPLETE ==="
ls -la /root/square15management/public/square15-app.apk
ls -la /var/www/downloads/square15-app.apk
