# HostLatch Action

[![CI](https://github.com/iammurtaza53/hostlatch-action/actions/workflows/ci.yml/badge.svg)](https://github.com/iammurtaza53/hostlatch-action/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-2563eb.svg)](LICENSE)

Run [HostLatch](https://github.com/iammurtaza53/hostlatch) in pull-request CI, preserve its JSON activation manifest as an artifact, and fail at the selected trust-handoff threshold.

## Usage

```yaml
name: HostLatch

on:
  pull_request:

permissions:
  contents: read

jobs:
  hostlatch:
    runs-on: ubuntu-latest
    steps:
      - name: Check out repository history
        uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
        with:
          fetch-depth: 0

      - name: Scan trust-handoff changes
        uses: iammurtaza53/hostlatch-action@v1
        with:
          base: origin/main
          fail-on: review
          output: hostlatch-manifest.json
```

The action uploads the manifest as `hostlatch-manifest-<job>-<os>`, even when HostLatch reaches the configured failure threshold. Pin the action to a full commit SHA instead of `v1` where an immutable workflow dependency is required.

## Inputs

| Input | Default | Description |
| --- | --- | --- |
| `base` | `origin/main` | Git commit or ref used as the comparison base |
| `fail-on` | `block` | Failure threshold: `block`, `review`, or `never` |
| `output` | `hostlatch-manifest.json` | Relative JSON manifest path inside the checked-out repository |

## Outputs

| Output | Description |
| --- | --- |
| `manifest` | Absolute path to the generated JSON manifest |
| `exit-code` | HostLatch exit code: `0`, `2`, `3`, or `1` for an error |

## Release pinning and security

This action runs HostLatch v0.2.0 from release commit `99e6cc09d4f7a66981f82d37df5bc723bd9f3131`. It also pins its GitHub-maintained action dependencies by full commit SHA. Scanned repository content is read as inert data; it is never installed, imported, built, sourced, or executed.

The output path must be a relative `.json` path that resolves inside the checked-out repository. Existing symlink ancestors are resolved before the scan so a repository cannot redirect the manifest outside the workspace.

Report vulnerabilities through [HostLatch private vulnerability reporting](https://github.com/iammurtaza53/hostlatch/security/advisories/new).

## License

[MIT](LICENSE)
