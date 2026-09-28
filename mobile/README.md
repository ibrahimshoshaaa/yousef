# Perfume ERP Android client (work in progress)

The mobile client calls the existing ERP API over HTTPS. It never connects to PostgreSQL directly. Login tokens are random, stored as SHA-256 hashes on the server, revocable, and held in Android secure storage.

This source currently covers login, account, and initial read-only lists. The web application remains the full-featured interface while the native screens and actions are built.

## Build prerequisites

Install Flutter and the Android SDK on the build machine. From this directory run `flutter create --platforms android --project-name perfume_erp .` once to generate standard Android project files, then `flutter pub get`, `flutter analyze`, and `flutter build apk --debug`.

Deploy the `MobileSession` migration and API routes before logging in. Do not point the Android client at a database or ship Shopify secrets with it. Use the same ERP account credentials as the web app.
