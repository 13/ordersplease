# Play Store Distribution (Trusted Web Activity)

This guide walks through packaging Orders, Please as a Trusted Web Activity (TWA) for distribution on Google Play.

A TWA is a wrapper that loads the web app (hosted at https://13.github.io/ordersplease/) in a full-screen Android view without browser UI. Bubblewrap automates most of the process.

## Prerequisites

Before starting, install:
- **Node.js** 18+
- **JDK 17** (required for the Android build toolchain)
- **Android SDK** — Bubblewrap's init prompt will guide you through this if it's not already installed

## Step 1: Install Bubblewrap CLI

```bash
npm i -g @bubblewrap/cli
```

## Step 2: Initialize the TWA project

Run Bubblewrap's init command. You can point it at either the live manifest or the local one:

```bash
bubblewrap init --manifest https://13.github.io/ordersplease/manifest.webmanifest
```

Or use the checked-in configuration:

```bash
bubblewrap init --manifest ./twa-manifest.json
```

The interactive prompt will ask for:
- App name, package name, launcher name
- Icons and theme colors (these are already defined in `twa-manifest.json`)
- Android SDK location (if not found automatically)

This creates a local `bubblewrap.json` configuration file (do not commit this to the repo).

## Step 3: Generate and back up the keystore

Bubblewrap generates a signing keystore during init. This keystore is required for all future builds and Play Store updates.

**Backup the keystore immediately:**
- Look for `android.keystore` in the directory where you ran `bubblewrap init`
- Store it in a safe, encrypted location — losing it means you cannot update the app on Play Store

## Step 4: Extract the SHA256 fingerprint

The Android Asset Links verification requires your app's signing certificate fingerprint. Extract it:

```bash
keytool -list -v -keystore android.keystore -alias android
```

This outputs detailed key information. Find the line starting with `SHA256:` and copy the full fingerprint (hex string after the colon).

## Step 5: Add the fingerprint to assetlinks.json

1. Open `public/.well-known/assetlinks.json`
2. Replace `REPLACE_WITH_SHA256_FINGERPRINT` with the SHA256 value from Step 4
3. Commit and push to GitHub

```bash
git add public/.well-known/assetlinks.json
git commit -m "chore: add android asset links fingerprint"
git push
```

Wait for the GitHub Pages deployment to finish (check Actions tab). The `assetlinks.json` must be live at `https://13.github.io/ordersplease/.well-known/assetlinks.json` before testing, or Android will show the browser UI.

## Step 6: Build the app

Once the asset links are deployed, build the signed APK/AAB:

```bash
bubblewrap build
```

This creates:
- `app-release-signed.aab` (Android App Bundle for Play Store, preferred)
- `app-release-signed.apk` (standalone APK for direct install, useful for testing)

## Step 7: Test on device

Test the TWA locally first:

```bash
adb install app-release-signed.apk
```

Open the app on your test device. Verify:
- No browser address bar or chrome visible (asset links verified ✓)
- Navigation works in-app
- Permissions prompt if needed (location, camera, etc.)

If the browser UI shows, the asset links verification failed — go back to Step 5 and verify the fingerprint matches.

## Step 8: Upload to Google Play

1. Create a new app in [Google Play Console](https://play.google.com/console)
2. Fill in the app details (name, description, category, content rating)
3. Upload the `app-release-signed.aab` to Production or Testing track
4. Complete the app listing:
   - Add screenshots (minimum 2)
   - Write the app description
   - Set the content rating
   - Mark country availability
5. Review and publish (or submit for review if you're a new developer)

## Troubleshooting

**Browser UI shows instead of full-screen:**
- Asset links verification failed
- Ensure `assetlinks.json` is deployed at `https://13.github.io/ordersplease/.well-known/assetlinks.json`
- Verify the SHA256 fingerprint in the file matches your keystore (Step 4)
- Clear the app cache and reinstall

**Build fails with Android SDK errors:**
- Run `bubblewrap init` again to let it auto-detect the SDK
- Or set `ANDROID_HOME` environment variable to your SDK location

**Lost the keystore:**
- You cannot update the existing app on Play Store without it
- You must publish as a new app with a new package ID
- Always back up keystores immediately after generation
