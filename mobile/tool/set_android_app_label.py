"""Brand the generated Android host without committing Flutter-generated files."""

from pathlib import Path


manifest = Path("android/app/src/main/AndroidManifest.xml")
source = manifest.read_text(encoding="utf-8")
updated = source.replace('android:label="perfume_erp"', 'android:label="Auraic"')
if updated == source and 'android:label="Auraic"' not in source:
    raise SystemExit("Android app label was not found in generated manifest")
manifest.write_text(updated, encoding="utf-8")
