# Pendy

Personal task management app built with React + Vite + Supabase. Runs as a PWA on web, and optionally inside a native desktop wrapper via Tauri v2.

## Development

```bash
pnpm install
pnpm dev        # starts Vite dev server on http://localhost:5173/pendy/
```

## Tests

```bash
pnpm test:run   # run all tests (Vitest)
```

## Desktop build (experimental)

The native wrapper uses [Tauri v2](https://tauri.app) and is **optional** — the PWA continues to work independently. It adds native badge support on KDE Plasma and other Linux desktops.

### System dependencies (Arch / CachyOS)

```bash
sudo pacman -S \
  webkit2gtk-4.1 \
  libsoup3 \
  base-devel \
  gtk3 \
  librsvg
```

### Install Rust

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
rustup default stable
```

Restart the shell so `cargo` and `rustc` are on `$PATH`.

### Run in development mode

```bash
pnpm tauri:dev
```

This starts the Vite dev server and opens a native window pointing to it. The `isTauri()` helper returns `true` inside this window, so the frontend emits a `set-app-badge` event that Rust receives and forwards as a Unity Launcher Entry D-Bus signal, instead of using the browser Badging API.

### Build a production binary

```bash
pnpm tauri:build
```

Produces an AppImage under `src-tauri/target/release/bundle/appimage/`.

On Arch / CachyOS the bundler may fail with `Strip call failed ... unknown type [0x13] section .relr.dyn`. The cause is that the `linuxdeploy` AppImage shipped by Tauri carries an older `strip` that doesn't understand modern relative-relocation sections produced by current system libraries. Workaround: skip the strip step.

```bash
NO_STRIP=true pnpm tauri:build
```

The resulting AppImage is ~5% larger but otherwise identical. CI runners on Ubuntu 22.04 don't need this flag.

### Audio in the AppImage

`tauri.conf.json` sets `bundle.linux.appimage.bundleMediaFramework: true`, which embeds GStreamer plugins inside the AppImage (~60 MB extra). Without it, WebKit2GTK inside the sandboxed bundle can't reach the host's GStreamer and sounds fall back to silent.

On first launch you'll see many `GStreamer-WARNING External plugin loader failed` lines in stderr — this is cosmetic. The `gst-plugin-scanner` helper isn't on PATH inside the bundle, so plugins load in-process. First sound may take 10-15s; subsequent launches are fast.

### Installing the AppImage on KDE

Easiest path with auto-integration into the menu, icon registration, and badge association:

```bash
yay -S appimagelauncher    # or paru -S appimagelauncher
mkdir -p ~/Applications
mv path/to/Pendy_<version>_amd64.AppImage ~/Applications/
~/Applications/Pendy_<version>_amd64.AppImage   # first run prompts "Integrate?"
```

Click **Integrate and run**. AppImageLauncher creates a `.desktop` entry, extracts the icon to the system icon theme, and (importantly) sets `StartupWMClass=Pendy` so the badge signal associates with the window. The Rust badge code discovers this `.desktop` basename automatically at runtime.

### Activating badge indicators in KDE Plasma Task Manager

By default, KDE Plasma shows badges from applications that emit the Unity Launcher Entry D-Bus signal. If the badge does not appear:

1. Right-click the Task Manager panel → **Configure Icons-Only Task Manager**.
2. Enable **"Show progress and status information in task buttons"** (also called **"Show indicators"**).
3. Click **OK**.

The badge count reflects tasks and habits pending for today, matching what the Today view shows.

## Releases

Linux AppImage binaries are produced automatically by `.github/workflows/release.yml` when a version tag is pushed:

```bash
# Bump version in package.json and src-tauri/tauri.conf.json first, then:
git tag v0.x.y
git push --tags
```

GitHub Actions builds the AppImage on `ubuntu-22.04` and uploads it to a **draft** release. Open the draft on GitHub, write the release notes, and publish it manually — `https://github.com/juanmanuellosada/pendy/releases/latest` will then redirect to it, feeding the "Descargar para Linux" button in Settings → Aplicación.

macOS and Windows are not built by CI yet; their Rust implementations exist as stubs.
