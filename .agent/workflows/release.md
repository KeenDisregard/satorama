---
description: How to bump version and update changelog after completing a feature or fix
---

# When the user says "release", "bump version", "ship it", or similar:

1. Determine the version bump type based on the changes:
   - **MAJOR** (x.0.0): Breaking changes that require users to modify their usage
   - **MINOR** (1.x.0): New features that are backwards-compatible  
   - **PATCH** (1.0.x): Bug fixes, refactors, no new features

2. Update `CHANGELOG.md` by adding an entry at the top (under the header):
   ```markdown
   ## [X.Y.Z] - YYYY-MM-DD
   ### Added
   - New feature descriptions
   
   ### Changed
   - Modification descriptions
   
   ### Fixed
   - Bug fix descriptions
   ```
   Only include sections that apply. Use past tense.

// turbo
3. Stage the changelog:
   ```bash
   git add CHANGELOG.md
   ```

// turbo
4. Commit the changelog:
   ```bash
   git commit -m "docs: Update changelog for vX.Y.Z"
   ```

// turbo
5. Bump the version (this updates package.json, commits, and creates a tag):
   ```bash
   npm version <major|minor|patch> -m "vX.Y.Z - Brief description"
   ```

// turbo
6. Push the commit and tag:
   ```bash
   git push && git push --tags
   ```

7. Confirm completion to the user with the new version number.
