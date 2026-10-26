#!/usr/bin/env bash
# PASTELLA 84 v3 CAD build.
#   ./cad/build.sh rust          Only Rust: spec.json -> B-rep -> STEP / URDF / USDA / GLB + Rust self-checks
#   ./cad/build.sh csharp-rust   the same Rust build, then the independent C# validator (default)
# Extra arguments go to the Rust build, e.g.  ./cad/build.sh rust --palette "Lavender Haze"
set -euo pipefail
cd "$(dirname "$0")/.."

mode="${1:-csharp-rust}"
[ $# -gt 0 ] && shift
case "$mode" in rust|csharp-rust) ;; *) echo "usage: $0 [rust|csharp-rust] [--palette NAME]" >&2; exit 2 ;; esac

echo "== Rust (cad/rust): build + self-checks"
cargo run --quiet --release --manifest-path cad/rust/Cargo.toml -- "$@"

if [ "$mode" = csharp-rust ]; then
  echo "== C# (cad/csharp): independent validation of cad/out"
  dotnet run --project cad/csharp/Pastella.Validate -c Release
fi
echo "outputs: cad/out (open the workbench with ./run.sh)"
