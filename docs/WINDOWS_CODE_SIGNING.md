# Windows Code Signing — Release Requirements

Status: **NOT signing yet.** Current release EXEs/installers are unsigned.
This document lists exactly what is needed to sign future releases. Do not
fake or partially sign.

## What to buy

- An **OV (Organization Validation) or EV code-signing certificate** from a
  public CA (Sectigo, DigiCert, GlobalSign…). Since June 2023 all
  code-signing private keys must live on hardware (HSM/USB token) or a
  cloud signing service (e.g. Azure Trusted Signing, DigiCert KeyLocker).

## What to configure

1. Store the token/credentials securely; never commit them.
2. Sign BOTH artifacts on every release:
   - `release/desktop/Wildlife-Incident-Handoff-Portable-<version>.exe`
   - `release/desktop/Wildlife-Incident-Handoff-Setup-<version>.exe`
   (sign the NSIS installer AND the inner portable binary; timestamp with
   an RFC-3161 timestamp server so signatures outlive the certificate.)
3. Tool: `signtool sign /fd SHA256 /tr <timestamp-url> /td SHA256 /a file.exe`
4. Record the certificate thumbprint in the release checklist.

## Why it matters

Unsigned builds trigger SmartScreen warnings and make enterprise adoption
harder. Signed builds also make the future signed updater (Tauri updater
with a public signing key) possible — never auto-install unsigned updates.
