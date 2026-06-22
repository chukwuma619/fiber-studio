# Fiber Studio

Native desktop app for the [Fiber Network](https://www.fiber.world/docs) on [Nervos CKB](https://nervos.org). Fiber Studio wraps the official [Fiber Network Node (`fnn`)](https://github.com/nervosnetwork/fiber) so you can run channels, send and receive payments, and manage your node without living in a terminal.

Built with [Tauri 2](https://v2.tauri.app/start/), [React 19](https://react.dev/), [Vite](https://vite.dev/), [TanStack Router](https://tanstack.com/router), and [Tailwind CSS 4](https://tailwindcss.com/).

> **Status:** Early development (v0.1.0). This repo is the ground-up v1 rebuild. The earlier prototype lives at [chukwuma619/fiber-desktop](https://github.com/chukwuma619/fiber-desktop).

## What Fiber Studio is

Fiber is CKB’s peer-to-peer payment and swap layer — channels, routing, invoices, and fast off-chain value movement. To use it, you run **fnn**, the official Fiber Network Node.

Fiber Studio does not replace `fnn` or fork the protocol. It is the interface for the same official node: install and run `fnn` locally, with guided setup and task-based flows instead of CLI-only workflows. Your CKB key file stays on disk; secrets stay in the OS keychain. It is not a hosted wallet.

## Features

### Implemented

- **Guided setup wizard** — choose mainnet or testnet, connect via official relays or a custom peer, pick a data directory, import a CKB key file, and set a wallet password
- **Node lifecycle** — start and stop `fnn`, view recent logs, and stop the node when the app exits
- **Home dashboard** — local balance, channel and peer counts, relay connectivity, channel liquidity, and recent activity
- **Local-first security** — `fnn` runs on your machine; keys and passwords stay on your device (OS keychain for secrets)

### Planned

- **Wallet** — send and receive payments, human-readable amounts, invoice QR codes
- **Channels** — open, list, and monitor channels
- **Network** — peer management and network visibility
- **Settings** — node, wallet, and app preferences

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

Supported sidecar targets: `aarch64-apple-darwin`, `x86_64-apple-darwin`, `x86_64-unknown-linux-gnu`, `x86_64-pc-windows-msvc`.

### Scripts

```bash
bun run dev              # frontend only (Vite)
bun run build            # production frontend build
bun run fetch-fnn        # download fnn sidecar for current platform
bun run fetch-fnn -- --all                    # all supported platforms
bun run fetch-fnn -- --triple aarch64-apple-darwin  # one platform (CI)
bun run tauri dev        # run the desktop app in development
bun run tauri build      # production installers → src-tauri/target/release/bundle/
bun run generate-icons   # regenerate app icons from app-icon.svg
```

## Project layout

```
fiber-studio/
├── src/                 # React UI (routes, components, lib)
│   ├── routes/          # TanStack Router file-based routes
│   ├── components/      # UI, setup wizard, home dashboard, layout
│   └── lib/             # fnn client helpers, setup storage, relays
├── src-tauri/           # Tauri shell (Rust)
│   ├── src/
│   │   ├── commands/    # Tauri invoke handlers (setup, node, dashboard)
│   │   └── fnn/         # fnn process manager, config, keychain, logs
│   ├── resources/       # fnn config templates (mainnet, testnet)
│   └── binaries/        # fnn sidecar (gitignored; populated by fetch-fnn)
├── shared/              # Shared data (e.g. relay definitions)
├── scripts/             # fetch-fnn and other build helpers
└── public/              # Static assets
```

## CI

GitHub Actions builds the frontend on every push and PR to `main`, and cross-compiles Tauri installers for macOS (Apple Silicon and Intel), Linux, and Windows.

## Related projects

- [nervosnetwork/fiber](https://github.com/nervosnetwork/fiber) — Fiber Network Node (`fnn`) and protocol implementation
- [chukwuma619/fiber-desktop](https://github.com/chukwuma619/fiber-desktop) — prototype this repo replaces
- [Fiber documentation](https://www.fiber.world/docs) — protocol and node guides
- [ckb-cli](https://github.com/nervosnetwork/ckb-cli) — CKB command-line tool (export keys, manage accounts)

## Contributing

Fiber Studio is under active development. Issues and PRs are welcome once contribution guidelines are published. For context on the v1 direction, see the [Fiber Desktop v1 proposal](https://talk.nervos.org/t/dis-fiber-desktop-v1-ground-up-rebuild-and-launch-fnn-desktop-app/10317) on Nervos Talk.
