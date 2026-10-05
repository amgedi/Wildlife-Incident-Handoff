# TESTER README — Wildlife Incident Handoff 0.3.0-rc.1

Thank you for testing! This guide is written for non-developers — you do not
need any programming tools, and nothing here asks you to run commands.

## What this app is

**Wildlife Incident Handoff** is a local-first desktop app for creating clear,
traceable wildlife incident records and handing them off between reporters and
wildlife professionals. Everything you create is stored **on your own
computer** — the app does not require an account and does not send your records
anywhere.

## This is a release candidate

This is an early release candidate for testing. Please use **fictional or
non-critical test data only** — do not enter real emergency, sensitive, or
personal data yet. The built-in **Test View** can fill the app with realistic
fictional incidents for you (see below).

## Installing

1. Run `Wildlife-Incident-Handoff-Setup-0.3.0-rc.1.exe`.
2. Windows may show a blue "Windows protected your PC" warning because the
   app is not yet code-signed. Click **More info → Run anyway**. (This is
   expected for an unsigned release candidate — see KNOWN_LIMITATIONS.md.)
3. Follow the installer. It installs for your Windows user only (no admin
   rights needed) and adds **Wildlife Incident Handoff** to your Start Menu.

A portable, install-free option is also available:
`Wildlife-Incident-Handoff-Portable-0.3.0-rc.1.exe` — just double-click it.

You do **not** need Node, Git, Rust, or any development tools.

## First run

The app starts with a short onboarding (language → theme → workspace choice).
You can change everything later in **Settings**. For a quick tour with
realistic fictional data, enable **Test View** on the dashboard.

## Where your data lives

Your records are stored locally in your Windows user profile
(`AppData\Roaming\org.wildlifeincidenthandoff.app`). Nothing is uploaded.

## Uninstalling — and what happens to your data

Uninstall from Windows Settings → Apps, or the Start Menu entry. The program
is removed, but **your records are kept** on purpose, so reinstalling or
upgrading later brings them back. To fully erase test data, delete the
`AppData\Roaming\org.wildlifeincidenthandoff.app` folder after uninstalling.

## How to reset your test data

In the app: **Settings → Data** offers backup/restore. For a clean slate,
close the app and delete the data folder above, then start the app again
(fresh onboarding).

## How to enable Test View

On the dashboard header, click **Test view**. It fills the workspace with
fictional demo incidents (clearly labeled) for training and testing. Nothing
in Test View touches real records, and **Exit test view** + **Reset** removes
only the fictional data.

## Reporting a bug

See FEEDBACK_GUIDE.md. In short: note what you did, what you expected, and
what happened — and copy your diagnostics from **Settings → About → Copy
diagnostics** (it contains version/build info and no private data).

## Finding diagnostics

Open the app, go to **Settings → About** — version, commit and build
identity are listed there and can be copied for a bug report.
