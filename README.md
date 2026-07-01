# Fiber Studio

Native desktop app for the [Fiber Network](https://www.fiber.world/docs) on [Nervos CKB](https://nervos.org). Fiber Studio wraps the official [Fiber Network Node (`fnn`)](https://github.com/nervosnetwork/fiber) so you can run channels, send and receive payments, and manage your node without living in a terminal.

Built with [Tauri 2](https://v2.tauri.app/start/), [React 19](https://react.dev/), [Vite](https://vite.dev/), [TanStack Router](https://tanstack.com/router), and [Tailwind CSS 4](https://tailwindcss.com/).

> **Status:** Early development (v0.1.2). This repo is the ground-up v1 rebuild. The earlier prototype lives at [chukwuma619/fiber-desktop](https://github.com/chukwuma619/fiber-desktop).

## What Fiber Studio is

Fiber is CKB’s peer-to-peer payment and swap layer — channels, routing, invoices, and fast off-chain value movement. To use it, you run **fnn**, the official Fiber Network Node.

Fiber Studio does not replace `fnn` or fork the protocol. It is the interface for the same official node: install and run `fnn` locally, with guided setup and task-based flows instead of CLI-only workflows. Your CKB key file stays on disk; secrets stay in the OS keychain. It is not a hosted wallet.

## Features

### Implemented

- **Guided setup wizard** — choose mainnet or testnet, connect via official relays or a custom peer, pick a data directory, import a CKB key file, and set a wallet password
- **Node lifecycle** — start and stop `fnn`, view recent logs, and stop the node when the app exits
- **Home dashboard** — local balance, channel and peer counts, relay connectivity, channel liquidity, and recent activity
- **Wallet** — create and import invoices (with QR codes), receive payment status, send via invoice or keysend, payment history with route details
- **Channels** — open, list, monitor, and close channels; on-chain funding wallet balance
- **Network** — connect to public relays and custom peers, view relay and graph status
- **Settings** — node and wallet configuration, theme, data directory migration, network switch, password updates, in-app updates
- **In-app updates** — signed auto-updates; check on launch, manual check in Settings, install with progress feedback
- **Local-first security** — `fnn` runs on your machine; keys and passwords stay on your device (OS keychain for secrets)

## Download

Release builds are on [GitHub Releases](https://github.com/chukwuma619/fiber-studio/releases). Each release ships all platform bundle formats (unsigned until M3 app signing).

| OS | Download this file | Install |
|----|-------------------|---------|
| **macOS (Apple Silicon, M1/M2/M3)** | `Fiber Studio_*_aarch64.dmg` | Open the DMG, drag Fiber Studio to Applications. |
| **macOS (Intel)** | `Fiber Studio_*_x64.dmg` | Open the DMG, drag Fiber Studio to Applications. |
| **Windows** | `Fiber Studio_*_x64-setup.exe` (NSIS) or `Fiber Studio_*_x64_en-US.msi` | Run the setup wizard. |
| **Linux x64** | `Fiber Studio_*_amd64.AppImage`, `fiber-studio_*_amd64.deb`, or `fiber-studio-*-1.x86_64.rpm` | AppImage: `chmod +x "Fiber Studio_"*"_amd64.AppImage"` then run. Debian/Ubuntu: `sudo apt install ./fiber-studio_*_amd64.deb`. Fedora/RHEL: `sudo dnf install ./fiber-studio-*-1.x86_64.rpm`. |
| **Linux ARM64** | `Fiber Studio_*_aarch64.AppImage`, `fiber-studio_*_arm64.deb`, or `fiber-studio-*-1.aarch64.rpm` | Same as Linux x64, using the `aarch64` / `arm64` filenames. |

Download only the installer for your platform (`.dmg`, `-setup.exe`, `.msi`, `.AppImage`, `.deb`, or `.rpm`). Ignore `latest.json` and files like `*.app.tar.gz` — those are for in-app updates, not manual install.

### macOS: “Apple could not verify…” on first launch

Fiber Studio is not Apple-notarized yet (planned for M3). After you download from GitHub, macOS Gatekeeper may block the first launch and show **“Fiber Studio” Not Opened** with only **Done** and **Move to Bin**. The app is safe to run; macOS just does not recognize the developer yet.

**Do not click Move to Bin.**

1. Open the `.dmg` and drag **Fiber Studio** to **Applications** as usual.
2. Try opening the app once (double-click). Gatekeeper will block it — that is expected.
3. Open **System Settings → Privacy & Security**.
4. Scroll down. You should see a message about Fiber Studio being blocked, with **Open Anyway**.
5. Click **Open Anyway**, then confirm **Open**.

**Alternative (sometimes works on first launch):** In Finder, **right-click** Fiber Studio → **Open** → **Open** in the dialog.

After the first successful launch, macOS remembers your choice and you can open the app normally.

Windows SmartScreen may show a similar warning for unsigned builds — choose **More info → Run anyway**.

In-app updates use a separate Tauri signing key (not Apple/Windows code signing). After install, use **Settings → Updates** or wait for the launch prompt.

## Prerequisites

Install [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/) for your OS:

- System dependencies for your platform
- [Rust](https://www.rust-lang.org/tools/install)
- [Bun](https://bun.sh/) (or Node.js **20.19+** / **22.12+**)
- On Windows, use **Git Bash** for the commands below

## Development

```bash
git clone https://github.com/chukwuma619/fiber-studio.git
cd fiber-studio
bun install
bun run fetch-fnn    # download bundled fnn sidecar for your platform (required once)
bun run tauri dev
```

Fiber Studio bundles the official [fnn](https://github.com/nervosnetwork/fiber) binary (currently **v0.8.1**) as a Tauri sidecar. The `fetch-fnn` script downloads it from GitHub Releases into `src-tauri/binaries/` (gitignored). Run it before `tauri dev` or `tauri build`.

Supported sidecar targets: `aarch64-apple-darwin`, `x86_64-apple-darwin`, `x86_64-unknown-linux-gnu`, `aarch64-unknown-linux-gnu`, `x86_64-pc-windows-msvc`.

### Scripts

```bash
bun run dev              # frontend only (Vite)
bun run build            # production frontend build
bun run fetch-fnn        # download fnn sidecar for current platform
bun run fetch-fnn -- --all                    # all supported platforms
bun run fetch-fnn -- --triple aarch64-apple-darwin  # one platform (CI)
bun run version:bump patch   # bump patch | minor | major | x.y.z
bun run tauri dev        # run the desktop app in development
bun run tauri build      # production installers → src-tauri/target/release/bundle/
bun run generate-icons   # regenerate app icons from app-icon.svg
```

### Publishing a release

```bash
# Bump version (updates package.json + Cargo.toml; Tauri reads package.json)
bun run version:bump patch   # or minor | major | 0.2.0
git commit -am "chore: release v0.1.0"
git push origin main
git tag v0.1.0
git push origin v0.1.0
```

For local release builds, export the signing key before `tauri build` (`.env` files are not read by Tauri):

```bash
export TAURI_SIGNING_PRIVATE_KEY="$(cat src-tauri/.updater/fiber-studio.key)"
bun run fetch-fnn
bun run tauri build
```

Releases are unsigned (no Apple/Windows code signing yet). macOS CI builds use [ad-hoc signing](https://v2.tauri.app/distribute/sign/macos/#ad-hoc-signing) (`signingIdentity: "-"`) so downloaded `.app` bundles are not treated as damaged on Apple Silicon.

In-app updates use a separate Tauri updater key (`TAURI_SIGNING_PRIVATE_KEY`). The updater reads `latest.json` from GitHub Releases, so release tags must not be marked as GitHub prereleases — otherwise `releases/latest/download/latest.json` 404s and update checks fail.

## Project layout

```
fiber-studio/
├── src/                 # React UI (routes, components, lib)
│   ├── routes/          # TanStack Router file-based routes
│   ├── components/      # UI, setup wizard, home dashboard, layout, settings
│   └── lib/
│       ├── fnn/         # fnn client helpers, dashboard, node control
│       ├── setup/       # setup wizard state and storage
│       └── updates/     # in-app updater provider and preferences
├── src-tauri/           # Tauri shell (Rust)
│   ├── src/
│   │   ├── commands/    # Tauri invoke handlers (setup, node, dashboard)
│   │   └── fnn/         # fnn process manager, config, keychain, logs
│   ├── resources/       # fnn config templates (mainnet, testnet)
│   ├── binaries/        # fnn sidecar (gitignored; populated by fetch-fnn)
│   └── .updater/        # updater signing private key (gitignored)
├── shared/              # Shared data (e.g. relay definitions)
├── scripts/             # fetch-fnn, version-bump, and other build helpers
└── public/              # Static assets
```

## CI

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| **build** (`.github/workflows/build.yml`) | Push / PR to `main` | Frontend typecheck + build; cross-platform Tauri compile smoke test (no release) |
| **publish** (`.github/workflows/publish.yml`) | Tag push `v*`, or manual **workflow_dispatch** | Builds all bundle formats on macOS (arm64 + x64), Linux (x64 + arm64), and Windows; publishes GitHub Release, signed updater artifacts, and `latest.json` |

Repository secret **`TAURI_SIGNING_PRIVATE_KEY`** is required for publish and CI Tauri builds. GitHub Actions workflow permissions must allow **read and write** for releases.

## Related projects

- [nervosnetwork/fiber](https://github.com/nervosnetwork/fiber) — Fiber Network Node (`fnn`) and protocol implementation
- [chukwuma619/fiber-desktop](https://github.com/chukwuma619/fiber-desktop) — prototype this repo replaces
- [Fiber documentation](https://www.fiber.world/docs) — protocol and node guides
- [ckb-cli](https://github.com/nervosnetwork/ckb-cli) — CKB command-line tool (export keys, manage accounts)

## Contributing

Fiber Studio is under active development. Issues and PRs are welcome once contribution guidelines are published. For context on the v1 direction, see the [Fiber Desktop v1 proposal](https://talk.nervos.org/t/dis-fiber-desktop-v1-ground-up-rebuild-and-launch-fnn-desktop-app/10317) on Nervos Talk.
