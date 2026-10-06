# LAN Sync Field Testing Guide

Estimated time: 10 to 15 minutes.

Use fictional incidents only. This guide requires two Windows app instances on the same trusted local network.

LAN sync is experimental in `0.3.0-rc.2`.

## Pairing

1. On Device A, open Settings and enable LAN sync.
2. Note the local address and temporary pairing code.
3. On Device B, enable LAN sync and enter Device A's address and pairing code.
4. Device A must explicitly approve the pairing request.
5. Compare device fingerprints if you are testing on a network you do not fully trust.
6. Confirm both devices show each other as trusted peers.

## Fictional incident test

1. On Device B, create a fictional incident.
2. Wait for the incident to appear on Device A.
3. On Device A, make a clear status or assignment change.
4. Confirm that change appears on Device B.
5. On Device B, add a new observation or edit a non-sensitive fictional field.
6. Confirm the change and timeline event appear on Device A.
7. Record a fictional handoff on Device A.
8. Confirm the handoff appears on Device B.

## Conflict test

1. Disconnect the devices from each other.
2. Change the same fictional field on both devices to different values.
3. Reconnect and sync.
4. Confirm the product surfaces a conflict instead of silently choosing a winner.
5. Resolve the conflict deliberately and confirm the resolution is reflected in history.

## Trust and revocation test

1. Revoke Device B from Device A.
2. Attempt another sync.
3. Confirm the revoked peer cannot continue normal authenticated sync until it is paired again.

## What to report

Please report:

- pairing that succeeds without explicit approval
- an untrusted peer reading or changing incident data
- a replayed update being accepted
- unexplained trust changes after restart
- a sync conflict being silently overwritten
- private key or credential material appearing in diagnostics
- crashes caused by malformed or unexpected network input

Security-sensitive findings should follow [SECURITY.md](../SECURITY.md) instead of being posted with exploit details in a public issue.

For ordinary usability feedback, use the [tester feedback form](https://github.com/amgedi/Wildlife-Incident-Handoff/issues/new?template=tester_feedback.yml).
