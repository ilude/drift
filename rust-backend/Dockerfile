FROM rust:latest AS builder

# Install toolchain components + Lua 5.4 dev headers (for mlua in later phases)
RUN rustup component add rustfmt clippy && \
    apt-get update && apt-get install -y liblua5.4-dev && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Cache dependency layer: copy manifests first
COPY Cargo.toml ./
COPY Cargo.lock* ./
COPY crates/drift-math/Cargo.toml crates/drift-math/Cargo.toml
COPY crates/drift-types/Cargo.toml crates/drift-types/Cargo.toml
COPY crates/drift-data/Cargo.toml crates/drift-data/Cargo.toml
COPY crates/drift-sim/Cargo.toml crates/drift-sim/Cargo.toml
COPY crates/drift-lua/Cargo.toml crates/drift-lua/Cargo.toml
COPY crates/drift-server/Cargo.toml crates/drift-server/Cargo.toml

# Create stub lib.rs files so cargo can resolve the workspace
RUN for crate in drift-math drift-types drift-data drift-sim drift-lua; do \
      mkdir -p crates/$crate/src && echo "" > crates/$crate/src/lib.rs; \
    done && \
    mkdir -p crates/drift-server/src && echo "fn main() {}" > crates/drift-server/src/main.rs

# Build dependencies (cached unless Cargo.toml changes)
RUN cargo build --release 2>/dev/null || true
RUN cargo build --release --tests 2>/dev/null || true

# Now copy real source
COPY . .
RUN touch crates/*/src/*.rs
