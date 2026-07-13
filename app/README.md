# Fiber Studio

Native desktop app for the [Fiber Network](https://www.fiber.world/docs) on [Nervos CKB](https://nervos.org). Fiber Studio wraps the official [Fiber Network Node (`fnn`)](https://github.com/nervosnetwork/fiber) so you can run channels, send and receive payments, and manage your node without living in a terminal.

Built with [Tauri 2](https://v2.tauri.app/start/), [React 19](https://react.dev/), [Vite](https://vite.dev/), [TanStack Router](https://tanstack.com/router), and [Tailwind CSS 4](https://tailwindcss.com/).

> **Status:** Early development (v0.1.7). This repo is the ground-up v1 rebuild. The earlier prototype lives at [chukwuma619/fiber-desktop](https://github.com/chukwuma619/fiber-desktop).

## What Fiber Studio is

Fiber is CKB’s peer-to-peer payment and swap layer — channels, routing, invoices, and fast off-chain value movement. To use it, you run **fnn**, the official Fiber Network Node.

Fiber Studio does not replace `fnn` or fork the protocol. It is the interface for the same official node: install and run `fnn` locally, with guided setup and task-based flows instead of CLI-only workflows. Your CKB key file stays on disk; secrets stay in the OS keychain. It is not a hosted wallet.

## Features

### Implemented

- **Guided setup wizard** — choose testnet (mainnet is shown but not available yet), connect via official relays or enter a custom peer pubkey/multiaddr, pick a data directory, import a CKB key file, and set a wallet password
- **Node lifecycle** — start and stop `fnn`, view recent logs, and stop the node when the app exits
- **Home dashboard** — local balance, channel and peer counts, saved peer connectivity, channel liquidity, and recent activity
- **Wallet** — create and import invoices (with QR codes), receive payment status, send via invoice or keysend, payment history with route details
- **Channels** — open, list, monitor, and close channels; on-chain wallet balance
- **Network** — connect to public relays and custom peers, view relay and graph status
- **Settings** — node and wallet configuration, theme, network switch, password updates, open config/data directory, in-app updates (legacy `~/fiber-studio` data is auto-migrated on first launch)
- **In-app updates** — signed auto-updates; check on launch, manual check in Settings, install with progress feedback
- **Local-first security** — `fnn` runs on your machine; keys and passwords stay on your device (OS keychain for secrets)

## How two users can transact

Fiber Studio is a **desktop app** (macOS, Windows, Linux) that runs on your **laptop or PC**. Each person installs their own copy, runs their own [Fiber Network Node (`fnn`)](https://github.com/nervosnetwork/fiber) in the background, and uses the UI to manage channels and payments. There is no central account or hosted wallet — CKB moves off-chain between **your node** and **their node** over the Fiber network.

Today the setup wizard supports **testnet** only (mainnet is not available there yet). Both users must use the same Fiber network (e.g. both on testnet).

### What you need to understand first

**1. Peer connection is not payment**

Your node must **connect** to another node (P2P link on **Network**) and **open a channel** with them (**Channels**, state **ChannelReady**) before CKB can flow. Connecting as a peer alone does not let you pay or receive.

| | Peer connection | Channel (`ChannelReady`) |
|--|-----------------|--------------------------|
| What it is | P2P link for gossip and discovery | Off-chain CKB lane between two nodes |
| Enough to pay? | **No** | **Yes** (directly or as a hop in a route) |
| In Fiber Studio | **Network → Peers** | **Channels** |

Bootnodes under **Discovery & other connections** help you find the network; you cannot open payment channels with them.

**2. How you reach the other laptop depends on where you are**

Your Fiber node listens on port **8228** on your machine (see `fiber.listening_addr` in the bundled config templates). Official testnet relays in `shared/relays.json` use port **8119** instead — use each peer’s own multiaddr as given. To **connect** to someone, your node needs a **dialable address** for theirs — not just a pubkey.

| Situation | Typical approach | Direct channel between you? |
|-----------|------------------|----------------------------|
| **Same Wi‑Fi / LAN** (e.g. two laptops in one room) | Share **pubkey** + **LAN multiaddr** (`/ip4/192.168.x.x/tcp/8228/p2p/…`) | **Yes** — easiest way to pay each other directly |
| **Different cities / countries** (home internet, no port forwarding) | **Multi-hop** via a shared **public hub** (Option B) | Indirect — you each channel with the same hub |
| **Different locations, but one side has port forwarding** | Share **pubkey** + **public multiaddr** (public IP, port 8228 forwarded) | **Yes** — direct channel over the internet |

The **Wallet** page shows your **node pubkey** (copy button at the bottom). It does **not** show a multiaddr. For LAN or port-forwarded setups, you must share the multiaddr separately (chat, email, etc.).

**3. Two ways to pay**

| Mode | Route | When to use |
|------|--------|-------------|
| **Direct** | Your laptop ⟷ Their laptop (one channel) | Same LAN, or you can reach each other on the internet (multiaddr) |
| **Multi-hop** | You → public hub → them (two channels) | Far apart on home Wi‑Fi, no port forwarding — **most common for remote friends** |

Payments use the public internet (or your LAN). You do **not** need to be on the same Wi‑Fi for multi-hop. You **do** need a reachable address or a shared hub for the mode you choose.

For protocol details, see the [Fiber documentation](https://www.fiber.world/docs).

---

### Before you start (both modes)

1. **Install** Fiber Studio from [GitHub Releases](#download) on each laptop.
2. **Complete setup** on each machine:
   - **Network** — **Testnet**
   - **Public network** — pick at least one saved peer (official relay, community hub, or custom pubkey/multiaddr). The node connects after setup on **Network**. Which peer you pick depends on Option A or B below.
   - **Wallet key** — import a CKB key file ([ckb-cli](https://github.com/nervosnetwork/ckb-cli) can export one)
   - **Wallet password** — stored in the OS keychain
   - **Review & start** — start the node and **keep it running** while sending or receiving
3. **Fund on-chain** (first channel open):
   - Send testnet CKB to your **On-chain wallet** on **Channels**
   - Minimum **1,000 CKB** per channel open, plus reserve and on-chain fees
4. **Share details** out of band before connecting to each other:
   - **Pubkey** (always) — **Wallet** footer, 66-character hex (`02…` or `03…`)
   - **Multiaddr** (for direct connect) — see Option A; format `/ip4/HOST/tcp/8228/p2p/Qm…`

---

## Option A — Direct payment (channel with each other)

One **direct channel** between you and the other person. Payments are a single hop — no hub in the middle.

```text
Your laptop ══════ channel ══════ Their laptop
```

Use this when you can **connect** to each other: same LAN, or over the internet with a public multiaddr.

### A1 — Same Wi‑Fi / LAN (two laptops nearby)

This is the straightforward case for **direct** payment: both nodes are on the same local network, so you dial each other’s **LAN IP** — no router port forwarding required.

**1. Both users — keep nodes running**

Start Fiber Studio and ensure the node is up on both laptops.

**2. Share pubkey + LAN address**

- **Pubkey:** **Wallet** → copy **Node pubkey** at the bottom.
- **LAN multiaddr:** On the laptop that will be dialed first, find its local IP (e.g. macOS **System Settings → Network**, Windows `ipconfig`, Linux `ip addr`). Build:

  ```text
  /ip4/192.168.x.x/tcp/8228/p2p/QmPEER_ID
  ```

  - Port is **8228** (default Fiber P2P port).
  - The `/p2p/Qm…` part is your node’s libp2p peer id. After your node connects to bootnodes, check **Network** (connected peer addresses) or your node log (`fiber-studio-fnn.log` in your data directory) for a `/p2p/Qm…` suffix.

  Pubkey-only connect (`connect_peer` with just a pubkey) only works if your node already knows their address from **gossip**. Fresh home nodes usually do not — **use the LAN multiaddr**.

**3. Connect (both users)**

1. **Network → Add saved peer** — paste their **pubkey** and **LAN multiaddr**, then **Add & connect**.
2. If the peer is already saved but not connected, click **Connect** until they show as **Connected**.
3. Optionally repeat from the other laptop so both sides are connected.

**4. Open a channel**

1. **Channels → Open channel** — select the other person’s pubkey.
2. Capacity at least **1,000 CKB** (plus fees).
3. Wait until **ChannelReady** on **both** laptops.

**5. Pay**

- **Invoice (recommended):** They create an invoice on **Wallet → Create invoice** and send you the string (or QR). You pay on **Wallet → Send payment** (Invoice tab). Route preview should show **one hop** (direct).
- **Keysend:** **Wallet → Send payment** (Keysend tab) with their pubkey.

The invoice **payee pubkey** must match the node you opened the channel with. If they send an invoice from a different wallet/node, payment will not route correctly.

### A2 — Far apart (direct over the internet)

Direct payment is still possible across cities or continents if **at least one** laptop is reachable from the public internet.

**1. Reachable side — port forwarding**

On the laptop that will accept inbound connections:

1. Forward router port **8228** → that machine’s LAN IP.
2. Edit `config.yml` in your Fiber Studio data directory (see template in `src-tauri/resources/fnn-config/testnet.yml`):
   - Under `fiber.announced_addrs`, add your **public** IP, e.g. `/ip4/YOUR_PUBLIC_IP/tcp/8228`
3. Restart the node.
4. Share **pubkey** + full multiaddr `/ip4/YOUR_PUBLIC_IP/tcp/8228/p2p/Qm…` with the other person.

**2. Other side — connect, channel, pay**

Same as LAN steps 3–5: **Network** (pubkey + multiaddr) → **ChannelReady** → pay invoice or keysend.

If neither side can port-forward, use **Option B** instead — do not expect pubkey-only connect to work across home networks.

### Direct payment — troubleshooting

`PathFind error: no path found` on route preview — check in order:

| Problem | What to do |
|---------|------------|
| Peer not **connected** | Missing or wrong multiaddr; on LAN use `192.168.x.x`, not public IP; both nodes must be running |
| Connected but no channel | **Channels → Open channel** → wait for **ChannelReady** on both sides |
| Wrong invoice | Invoice payee pubkey ≠ peer you channeled with — ask for a new invoice from the correct node |
| No liquidity | Sender needs enough **In channels** balance for amount + fees |

### Direct payment checklist

| Step | You | Them |
|------|-----|------|
| Fiber Studio installed, node running | ✓ | ✓ |
| Pubkey shared | ✓ | ✓ |
| Multiaddr shared (LAN or public) | ✓ | ✓ |
| **Connected** peer on **Network → Peers** | ✓ | ✓ |
| **ChannelReady** with each other | ✓ | ✓ |
| In-channel balance (sender) | ✓ | — |
| Invoice created & shared | — | ✓ |
| Invoice paid | ✓ | — |

---

## Option B — Multi-hop payment (shared public hub)

**Use this when you are far apart on normal home internet** and neither side has set up port forwarding. You do **not** need the same Wi‑Fi. Each laptop connects to the **same public Fiber node** (a “hub”), opens a channel with it, and payments route through that hub.

```text
Your laptop ──channel──► Hub (public peer) ──channel──► Their laptop
```

### Steps

**1. Pick a hub (agree out of band)**

Both users must use the **same** hub pubkey, for example:

- **Official testnet relays** — **Use public node1** / **Use public node2** in setup or on **Network** (`shared/relays.json`). Their multiaddrs use port **8119**, not 8228.
- **Community hub** — any public testnet node with a known IP that **both** of you can connect to (e.g. from **Network** after joining via bootnodes).

Official relays may not accept connections from every network. If node1/node2 never show as connected, pick a community hub that works for both of you and use its pubkey + multiaddr (with that hub’s actual port).

**2. Connect to the hub (both laptops)**

1. **Network → Add saved peer** — hub **pubkey** + **multiaddr** from `shared/relays.json` or your hub operator, then **Add & connect** (or **Connect** if already saved).
2. Wait until the hub appears as **Connected** in the **Peers** list.
3. Give gossip a minute after node start; **Network** shows gossip node counts — values above 0 help pathfinding.

**3. Open a channel with the hub (both laptops)**

1. **Channels → Open channel** — select the **hub** pubkey (not each other).
2. Wait until **ChannelReady** on both machines.
3. **Sender** — fund your side (local/outbound balance).
4. **Receiver** — must also have a **ChannelReady** hub channel so the hub can forward inbound CKB to you.

Peer-only connection to the hub is **not** enough for receiving payments.

**4. Pay**

1. **Receiver** — **Wallet → Create invoice** (from their own node; payee pubkey on the invoice must be theirs).
2. **Sender** — **Wallet → Send payment** (Invoice tab) — route preview should show a path **via the hub** (multi-hop).
3. Confirm and send.

### Multi-hop checklist

| Step | Sender | Receiver |
|------|--------|----------|
| Node running | ✓ | ✓ |
| Connected to **same hub** | ✓ | ✓ |
| **ChannelReady** with **same hub** | ✓ | ✓ |
| In-channel balance (sender) | ✓ | — |
| Graph synced (gossip nodes &gt; 0 on **Network**) | ✓ | ✓ |
| Invoice created & shared | — | ✓ |
| Invoice paid | ✓ | — |

### Multi-hop troubleshooting

`PathFind error: no path found` does not always mean the receiver is offline:

- **Empty graph** — wait after start; ensure bootnodes/hub are connected.
- **Receiver has no hub channel** — peer connect only is insufficient.
- **Different hubs** — you used hub A, they used hub B; no route between them.
- **Liquidity** — not enough outbound on your hub channel or on hub → receiver.
- **Receiver offline** — possible; rule out the above first.

---

## Send a payment (both modes)

### Invoice (recommended)

**Receiver:** **Wallet → Create invoice** → share Bech32m string or QR.

**Sender:** **Wallet → Send payment** (Invoice tab) → paste invoice → confirm amount and **route preview** → **Review payment** → send.

**Receiver:** invoice status updates to **Received** when settled.

### Keysend

**Sender:** **Wallet → Send payment** (Keysend tab) → recipient pubkey → amount → route preview → send.

**Receiver:** payment appears in history when settled.

Works for **direct** (channel peer) or **multi-hop** (routable path). Route preview must succeed before sending.

For protocol details beyond the app UI, see the [Fiber documentation](https://www.fiber.world/docs).

## Download

Release builds are on [GitHub Releases](https://github.com/chukwuma619/fiber-studio/releases). Each release ships all platform bundle formats. macOS and Windows builds are not yet notarized or code-signed.

| OS | Download this file | Install |
|----|-------------------|---------|
| **macOS (Apple Silicon, M1/M2/M3)** | `Fiber Studio_*_aarch64.dmg` | Open the DMG, drag Fiber Studio to Applications. |
| **macOS (Intel)** | `Fiber Studio_*_x64.dmg` | Open the DMG, drag Fiber Studio to Applications. |
| **Windows** | `Fiber Studio_*_x64-setup.exe` (NSIS) or `Fiber Studio_*_x64_en-US.msi` | Run the setup wizard. |
| **Linux x64** | `Fiber Studio_*_amd64.AppImage`, `fiber-studio_*_amd64.deb`, or `fiber-studio-*-1.x86_64.rpm` | AppImage: `chmod +x "Fiber Studio_"*"_amd64.AppImage"` then run. Debian/Ubuntu: `sudo apt install ./fiber-studio_*_amd64.deb`. Fedora/RHEL: `sudo dnf install ./fiber-studio-*-1.x86_64.rpm`. |
| **Linux ARM64** | `Fiber Studio_*_aarch64.AppImage`, `fiber-studio_*_arm64.deb`, or `fiber-studio-*-1.aarch64.rpm` | Same as Linux x64, using the `aarch64` / `arm64` filenames. |

Download only the installer for your platform (`.dmg`, `-setup.exe`, `.msi`, `.AppImage`, `.deb`, or `.rpm`). Ignore `latest.json` and files like `*.app.tar.gz` — those are for in-app updates, not manual install.

### macOS: “Apple could not verify…” on first launch

Fiber Studio is not Apple-notarized yet. After you download from GitHub, macOS Gatekeeper may block the first launch and show **“Fiber Studio” Not Opened** with only **Done** and **Move to Bin**. The app is safe to run; macOS just does not recognize the developer yet.

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
cd fiber-studio/app
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
├── app/                 # Tauri desktop app (run all bun/tauri commands here)
│   ├── src/             # React UI (routes, components, lib)
│   │   ├── routes/      # TanStack Router file-based routes
│   │   ├── components/  # UI, setup wizard, home dashboard, layout, settings
│   │   └── lib/
│   │       ├── fnn/     # fnn client helpers, dashboard, node control
│   │       ├── setup/   # setup wizard state and storage
│   │       └── updates/ # in-app updater provider and preferences
│   ├── src-tauri/       # Tauri shell (Rust)
│   │   ├── src/
│   │   │   ├── commands/  # Tauri invoke handlers (setup, node, dashboard)
│   │   │   └── fnn/       # fnn process manager, config, keychain, logs
│   │   ├── resources/   # fnn config templates (mainnet, testnet)
│   │   ├── binaries/    # fnn sidecar (gitignored; populated by fetch-fnn)
│   │   └── .updater/    # updater signing private key (gitignored)
│   ├── shared/          # Shared data (e.g. relay definitions)
│   ├── scripts/         # fetch-fnn, version-bump, and other build helpers
│   └── public/          # Static assets
└── .github/workflows/   # CI build + publish (projectPath: app)
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
