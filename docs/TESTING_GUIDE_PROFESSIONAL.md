# Field Testing Guide — two devices, one network (10–15 min)

Fictional-data walkthrough that proves sync end to end. Requires two Windows
computers (or one computer + one second Windows user profile) running the
same app version, on the same network, LAN sync disabled to start.

## Setup (3 min)
1. On Device A (call it "Dispatch"): Settings → LAN sync → enable.
2. Note "Your address" and "Your pairing code".
3. On Device B (call it "Field"): enable LAN sync, enter Dispatch's address
   + code → Pair.
4. Dispatch: approve the pairing request ("Trust device").
5. Both devices: confirm each other appears under "Trusted devices".

## Scenario
1. **Field**: Report wildlife → a gull entangled in fishing line at the boat
   launch → create the report.
2. **Dispatch**: within ~10 s the incident appears in the dashboard queue
   (Response network → New). Verify the reference matches.
3. **Dispatch**: open the incident → Accept (status: Responder assigned).
4. **Field**: within ~10 s the status chip changes; the bell shows a
   notification.
5. **Field**: edit the animal's location description ("moved to the dock
   pilings") via Update report.
6. **Dispatch**: verify the update + timeline entry arrived.
7. **Dispatch**: Transfer / hand off the case to "Rehab Front Desk".
8. **Field**: verify the handoff event appears in the timeline.
9. **Disconnect** one device from the network; edit the summary on each
   device (different text). Reconnect → sync.
10. Expected: a **SYNC CONFLICT** appears in Settings → LAN sync on at least
    one device; nothing was silently overwritten. Resolve with
    "Use this device's" on the device whose text should win; check the
    timeline records "Sync conflict resolved".
11. **Archive** the incident on one device → verify the other hides it from
    Active (it stays findable under Archived).
12. **Trash** it on the same device → verify it disappears from Active on
    both; restore from Trash → verify it returns on both. No history lost.

## Feedback questions
- Did any screen feel unclear about what was synced?
- Was the conflict explanation understandable?
- Did anything ever appear to "lose" information?
