# App icon & splash source images

`@capacitor/assets` generates every iOS icon/splash size from the source files
in this folder. Drop these three files here, then run `npm run assets:generate`.

| File | Size | Notes |
|------|------|-------|
| `icon.png` | 1024×1024 | **Trophy mark only**, centered on `#16191D`. No transparency, no rounded corners — iOS applies its own mask. The full "RallyPot" wordmark is unreadable at icon size, so crop to just the trophy. |
| `splash.png` | 2732×2732 | Full logo lockup (trophy + wordmark) centered on a `#16191D` field. Keep the logo within the center ~⅓ — iOS crops the edges on different aspect ratios. |
| `splash-dark.png` | 2732×2732 | Same as `splash.png` (the app is dark-only). |

## Generate

```bash
npm run assets:generate
```

This writes into `ios/App/App/Assets.xcassets` (`AppIcon.appiconset` + `Splash.imageset`)
and runs `cap sync ios`.

## Important: these are NATIVE assets

The app icon and splash ship inside the iOS app bundle — they do **not** update
via the Vercel web deploy. After regenerating you must rebuild the iOS app in
Xcode and install it on the device (or submit a new build to App Store Connect)
to see the new icon/splash.
