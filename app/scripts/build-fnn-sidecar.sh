#!/usr/bin/env bash
# Build fnn from a Fiber checkout that has JIT channels and install the Tauri sidecar.
# Local: `bun run build-fnn` (sibling fiber repo). CI sets FIBER_SRC and FNN_TRIPLE.
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
studio_root="$(cd "$script_dir/../.." && pwd)"

fiber_src="${FIBER_SRC:-$studio_root/../fiber}"
studio_app="${STUDIO_APP:-$studio_root/app}"
if [[ "$fiber_src" != /* ]]; then
  fiber_src="$studio_root/$fiber_src"
fi
if [[ "$studio_app" != /* ]]; then
  studio_app="$studio_root/$studio_app"
fi

fnn_triple="${FNN_TRIPLE:-$(rustc --print host-tuple)}"
host_triple="$(rustc --print host-tuple)"
if [[ "$host_triple" != "$fnn_triple" ]]; then
  echo "Refusing to build $fnn_triple on $host_triple. Run this on a native runner for that triple." >&2
  exit 1
fi

if [[ ! -f "$fiber_src/crates/fiber-lib/src/fiber/jit.rs" ]]; then
  echo "No JIT support in $fiber_src (missing jit.rs). Check out feat/jit-channel." >&2
  exit 1
fi

sha="$(git -C "$fiber_src" rev-parse HEAD)"
short_sha="${sha:0:7}"
echo "Building fnn $sha for $fnn_triple from $fiber_src"

build_portable_linux() {
  local configure="$1"
  local work="${RUNNER_TEMP:-$(mktemp -d)}/fnn-openssl"
  mkdir -p "$work"
  if [[ ! -f "$work/openssl-1.1.1s/libssl.a" ]]; then
    curl -fsSL -o "$work/openssl-1.1.1s.tar.gz" https://www.openssl.org/source/openssl-1.1.1s.tar.gz
    tar -xzf "$work/openssl-1.1.1s.tar.gz" -C "$work"
    (
      cd "$work/openssl-1.1.1s"
      # shellcheck disable=SC2086
      ./Configure $configure
      make -j"$(nproc)"
    )
  fi
  export OPENSSL_LIB_DIR="$work/openssl-1.1.1s"
  export OPENSSL_INCLUDE_DIR="$work/openssl-1.1.1s/include"
  export OPENSSL_STATIC=1
  cargo build --release --locked --features portable
}

(
  cd "$fiber_src"
  case "$fnn_triple" in
    aarch64-apple-darwin|x86_64-apple-darwin)
      cargo build --release --locked --features portable
      ;;
    x86_64-unknown-linux-gnu)
      build_portable_linux "linux-x86_64 shared"
      ;;
    aarch64-unknown-linux-gnu)
      build_portable_linux "linux-aarch64 shared"
      ;;
    *)
      echo "Unsupported triple $fnn_triple. Windows uses build-fnn-sidecar.ps1." >&2
      exit 1
      ;;
  esac
)

if [[ -n "${CARGO_TARGET_DIR:-}" ]]; then
  target_dir="$CARGO_TARGET_DIR"
else
  target_dir="$fiber_src/target"
fi
built="$target_dir/release/fnn"
if [[ ! -x "$built" ]]; then
  echo "fnn was not produced at $built" >&2
  exit 1
fi
version="$("$built" --version)"
echo "$version"
if [[ "$version" != *"$short_sha"* ]]; then
  echo "Built fnn does not match $sha (binary reports: $version)." >&2
  exit 1
fi

dest_dir="$studio_app/src-tauri/binaries"
mkdir -p "$dest_dir"
dest="$dest_dir/fnn-$fnn_triple"
cp "$built" "$dest"
chmod 755 "$dest"
printf '%s\n%s\n' "$sha" "$fnn_triple" > "$dest_dir/fnn-source.txt"
echo "Wrote $dest"

debug_dir="$studio_app/src-tauri/target/debug"
if [[ -d "$debug_dir" ]]; then
  staging="$debug_dir/fnn.new"
  if cp "$dest" "$staging" && chmod 755 "$staging" && mv "$staging" "$debug_dir/fnn"; then
    echo "Updated dev sidecar $debug_dir/fnn"
  else
    echo "Could not update $debug_dir/fnn (stop the node, then re-run build-fnn)." >&2
    rm -f "$staging"
  fi
fi
