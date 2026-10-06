# LAN Sync Security

Status: experimental protocol v3.

LAN sync is an optional desktop-only feature for exchanging incident records directly between paired devices on the same local network. It does not use a cloud relay.

## Identity

Each installation can generate a persistent P-256 keypair for LAN identity.

- the private key stays in the app data directory
- the public key is used to derive a visible fingerprint
- the friendly device name is only a label and is not proof of identity

Users should compare fingerprints when pairing on a network they do not fully trust.

## Pairing

1. Device A enables LAN sync and opens a short pairing window.
2. Device B enters Device A's address and pairing code.
3. Device A receives the pairing request and must explicitly approve it.
4. Both devices can display fingerprints for out-of-band comparison.

A correct pairing code does not automatically grant trust without user approval.

## Transport protection

Sync payloads are sealed with AES-256-GCM.

The channel key is derived from P-256 ECDH and HKDF-SHA256 using both peer identities. Authenticated data binds sender identity, recipient identity, and a monotonic counter.

The protocol rejects replayed counters and persists sync state so a restart does not intentionally reset replay tracking.

## Authorization

Untrusted devices cannot read incident records through the sync endpoint.

The old plaintext device-header protocol is not used by protocol v3.

A minimal ping endpoint may remain available for discovery, but it does not return incident data. When sync is disabled, pairing and sync operations reject requests.

## Trust and revocation

Trusted peer information is stored locally.

Removing trust prevents that peer from continuing normal authenticated sync until the devices are paired again.

## Listener behavior

The current native listener can remain bound while the application is running, even when sync is disabled. Disabled sync gates pairing and sync operations at the application layer.

Users should only allow the Windows Firewall rule on networks they trust as private networks.

## Request limits

The implementation includes request-size limits, timeouts, malformed-input handling, and rate limiting. These controls reduce accidental or basic hostile load but do not turn LAN sync into an internet-facing service.

## Known limitations

- protocol v3 uses static peer identities, so forward secrecy depends on key rotation or re-pairing
- pairing on a hostile network still relies on the user comparing fingerprints to reduce man-in-the-middle risk
- media attachments are not synchronized
- rate limiting is not a substitute for network isolation or host firewall policy
- the feature has limited field testing across different routers, VPNs, captive networks, and enterprise configurations

## Security reporting

If you find a way for an untrusted device to read or modify incident records, bypass pairing approval, replay accepted traffic, expose private key material, or crash the app remotely, report it through [SECURITY.md](../SECURITY.md) instead of opening a public exploit report.
