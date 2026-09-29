"""Add the network permission to Flutter's generated release manifest.

Flutter's generated debug manifest grants INTERNET, but its main manifest does not.
Release builds need it explicitly for the ERP API.
"""
from pathlib import Path

manifest = Path("android/app/src/main/AndroidManifest.xml")
contents = manifest.read_text()
permission = '<uses-permission android:name="android.permission.INTERNET" />'
if permission not in contents:
    if "<application" not in contents:
        raise SystemExit("Android manifest has no application element")
    contents = contents.replace("<application", f"{permission}\n    <application", 1)
    manifest.write_text(contents)
if contents.count('android.permission.INTERNET') != 1:
    raise SystemExit("Expected exactly one Android INTERNET permission")
