# Perfume ERP Android client (work in progress)

The mobile client calls the existing ERP API over HTTPS. It never connects to PostgreSQL directly. Login tokens are random, stored as SHA-256 hashes on the server, revocable, and held in Android secure storage.

The Android screens call the existing services for orders, stock, expenses, returns, recipes, reports and Shopify sync. Continue validating workflows on a test store before using the client for real sales. OAuth installation/connection runs in the browser; the mobile screen links to the web Shopify settings.

## Build prerequisites

Install Flutter and the Android SDK on the build machine. From this directory run `flutter create --platforms android --project-name perfume_erp .` once to generate standard Android project files, then `flutter pub get`, `flutter analyze --no-fatal-infos`, `flutter test`, and `flutter build apk --release --split-per-abi`. The Android workflow uploads separate ARM64 and ARM32 APKs; install the ARM64 build on a modern 64-bit phone. These release-mode test builds use the generated Android project's debug signing key. Set up a persistent private release signing key before distributing updates outside testing.

For a preview backend, pass `--dart-define=API_BASE_URL=https://your-preview-domain` to `flutter run` or `flutter build apk`. Production defaults to `https://yousef-beryl.vercel.app`.

Deploy the `MobileSession` migration and API routes before logging in. Do not point the Android client at a database or ship Shopify secrets with it. Use the same ERP account credentials as the web app.
