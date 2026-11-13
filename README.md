# Fiber Studio

Native desktop app for the [Fiber Network](https://www.fiber.world/docs) on [Nervos CKB](https://nervos.org). Fiber Studio wraps the official [Fiber Network Node (`fnn`)](https://github.com/nervosnetwork/fiber) so you can run channels, send and receive CKB and UDT payments, pay Bitcoin Lightning invoices via a Cross-Chain Hub (CCH), and manage your node without living in a terminal.

It does not replace `fnn` or fork the protocol. `fnn` runs on your machine; CKB keys stay on disk and secrets stay in the OS keychain. For Lightning, the app is a CCH client — you set a hub JSON-RPC URL; it does not run LND or the hub. It is not a hosted wallet.

Site: [getfiberstudio.com](https://www.getfiberstudio.com/).

## Repository

| Path | What |
|------|------|
| [`app/`](./app) | Tauri desktop app (UI, Rust shell, bundled `fnn`) |
| [`website/`](./website) | Next.js marketing site |
| [`.github/workflows/`](./.github/workflows) | CI build and release publish |

## Features

- Guided setup (testnet; mainnet is shown but not available yet), node start/stop, and logs
- Home dashboard, CKB and UDT balances, channels, peers, and channel neighborhood
- Fiber invoices and keysend, plus Lightning pay and receive through a CCH hub
- Settings, in-app updates, and `fnn` migration when the bundled node requires it
- Signed installers: Apple Developer ID (macOS), Authenticode (Windows), Linux AppImage / deb / rpm

Using the app (channels, direct vs multi-hop payments, Lightning): [Get started](https://www.getfiberstudio.com/get-started) and [FAQ](https://www.getfiberstudio.com/faq). Protocol: [Fiber docs](https://www.fiber.world/docs).

## Download

Installers are on [GitHub Releases](https://github.com/chukwuma619/fiber-studio/releases). Download only the file for your platform. `latest.json` and `*.app.tar.gz` are for in-app updates.

| OS | File |
|----|------|
| macOS (Apple Silicon) | `Fiber Studio_*_aarch64.dmg` |
| macOS (Intel) | `Fiber Studio_*_x64.dmg` |
| Windows | `Fiber Studio_*_x64-setup.exe` or `Fiber Studio_*_x64_en-US.msi` |
| Linux x64 | `.AppImage`, `.deb`, or `.rpm` (`amd64` / `x86_64`) |
| Linux ARM64 | `.AppImage`, `.deb`, or `.rpm` (`aarch64` / `arm64`) |

macOS: open the DMG and drag Fiber Studio to Applications. If Gatekeeper blocks an unnotarized build, use **System Settings → Privacy & Security → Open Anyway** (or right-click the app → **Open**). Do not choose Move to Bin.

Windows SmartScreen may warn for a new publisher even on a signed build: **More info → Run anyway**.

Linux AppImage: `chmod +x` the file, then run it. Debian/Ubuntu: `sudo apt install ./fiber-studio_*_amd64.deb`. Fedora/RHEL: `sudo dnf install ./fiber-studio-*-1.x86_64.rpm`. Use the `arm64` / `aarch64` names on ARM.

After install, updates are in **Settings → Updates**.

## Development

[Tauri prerequisites](https://v2.tauri.app/start/prerequisites/), [Rust](https://www.rust-lang.org/tools/install), and [Bun](https://bun.sh/) (or Node.js 20.19+ / 22.12+). On Windows, use Git Bash for the commands below.

### Desktop app

```bash
git clone https://github.com/chukwuma619/fiber-studio.git
cd fiber-studio/app
bun install
bun run fetch-fnn    # bundled fnn sidecar (currently v0.10.0); required once
bun run tauri dev
```

`fetch-fnn` downloads official `fnn` into `app/src-tauri/binaries/` (gitignored). Targets: `aarch64-apple-darwin`, `x86_64-apple-darwin`, `x86_64-unknown-linux-gnu`, `aarch64-unknown-linux-gnu`, `x86_64-pc-windows-msvc`.

From `app/`:

```bash
bun run dev            # Vite only
bun run build          # production frontend
bun run fetch-fnn -- --all
bun run version:bump patch   # patch | minor | major | x.y.z
bun run tauri build    # installers → src-tauri/target/release/bundle/
bun run generate-icons
```

### Website

```bash
cd fiber-studio/website
bun install
bun run dev            # http://localhost:3000
```

Also: `bun run build`, `bun run start`, `bun run lint`. Deploy on Vercel with root directory `website`.

### Releases

Push a `v*` tag (or run the publish workflow manually). That builds macOS (arm64 + x64), Linux (x64 + arm64), and Windows, then publishes the GitHub Release, updater artifacts, and `latest.json`. Tags must not be GitHub prereleases, or update checks cannot find `latest.json`.

```bash
cd app
bun run version:bump patch
git commit -am "chore: release vX.Y.Z"
git push origin main
git tag vX.Y.Z
git push origin vX.Y.Z
```

Publish needs the repository secret `TAURI_SIGNING_PRIVATE_KEY` (updater signing, separate from OS code signing). macOS publish also needs `APPLE_CERTIFICATE`, `APPLE_CERTIFICATE_PASSWORD`, `APPLE_ID`, `APPLE_PASSWORD`, and `APPLE_TEAM_ID`. Windows publish needs `CERTUM_EMAIL` and `CERTUM_OTP` (SimplySign TOTP seed, not the rotating code). Workflow permissions must allow read and write for releases.

Pushes and pull requests to `main` run the build workflow (frontend, website, and a Tauri smoke build). That workflow does not publish a release.

## Related

- [nervosnetwork/fiber](https://github.com/nervosnetwork/fiber) — Fiber Network Node and protocol
- [chukwuma619/fiber-desktop](https://github.com/chukwuma619/fiber-desktop) — prototype this repo replaces
- [Fiber documentation](https://www.fiber.world/docs)
- [ckb-cli](https://github.com/nervosnetwork/ckb-cli) — export CKB keys

## Contributing

Issues and pull requests are welcome. Direction for v1 is in the [Fiber Desktop v1 proposal](https://talk.nervos.org/t/dis-fiber-desktop-v1-ground-up-rebuild-and-launch-fnn-desktop-app/10317) on Nervos Talk.

## License

[MIT](./LICENSE)
