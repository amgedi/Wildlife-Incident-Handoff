# Git and GitHub — a beginner's guide (using this repository's real history)

## Git vs GitHub

- **Git** is a program that tracks the history of files on *your computer*. It lives entirely offline.
- **GitHub** is a website that hosts Git repositories *online*, so you can back them up, share them, and collaborate.

You use Git locally; GitHub is (usually) where you publish the result.

## The core vocabulary

| Term | Meaning |
| --- | --- |
| **repository (repo)** | A folder whose history Git tracks |
| **commit** | A saved snapshot of the project at one moment, with a message describing it |
| **branch** | A parallel line of history; **main** is the default branch name here |
| **remote** | A copy of the repo hosted elsewhere (GitHub). **origin** is the conventional name of *your* remote |
| **push / pull** | Send your commits to the remote / fetch and apply commits from it |
| **clone** | Download a remote repo with its full history |
| **tag** | A named marker on one commit, e.g. `v0.1.0` — used for releases |
| **.gitignore** | A list of files Git should never track (dependencies, build output, secrets) |

## The actual commands used to create this repository

```bash
# 1. Start tracking this project, using "main" as the default branch
git init -b main

# 2. Choose what to include, then save the first snapshot
git add package.json vite.config.ts tsconfig.json index.html .gitignore
git commit -m "chore: initialize wildlife incident handoff"

# 3. Development proceeded in meaningful commits:
#   feat: add incident creation workflow, local storage, timeline and custody history
#   test: add critical workflow coverage
#   feat: add handoff workflow, exports, onboarding and tutorial polish
#   docs: prepare v0.1.0 release

# 4. Publish to GitHub (first time) — create an EMPTY repo named
#    "wildlife-incident-handoff" on github.com first, then:
git remote add origin https://github.com/YOUR-USERNAME/wildlife-incident-handoff.git
git push -u origin main

# 5. Tag the release
git tag -a v0.1.0 -m "First public release"
git push origin v0.1.0
```

## Everyday workflow after changes

```bash
git status            # what changed?
git add -A            # stage everything (or add specific files)
git commit -m "fix: explain the change in one line"
git push              # upload to GitHub
```

## Releases on GitHub

A **release** = a git tag + a page on GitHub describing what changed (see CHANGELOG.md), optionally with a downloadable ZIP of the built app attached.

## What this repo deliberately does NOT track

See `.gitignore`: `node_modules/` (installed dependencies — `npm install` recreates them), `dist/` (build output), `.env` (secrets), test artifacts, and OS noise. Never commit personal incident data or credentials.

## Quick reference

```bash
git log --oneline        # history, one line per commit
git diff                 # unstaged changes
git branch feature-name  # create a branch
git switch feature-name  # move to it
git switch main          # back to main
git pull                 # get others' changes
```

Learn more: <https://docs.github.com/en/get-started>
