# Fluxa GUI  Developer Notes

## Quick start (new machine)
1) Install prerequisites:
- Node.js LTS
- Git (optional, but recommended)
- MySQL (if running locally)
- VS Code

2) In project root run:
  npm install
  npm run dev

Open in browser:
  http://localhost:3000

## OneDrive rules (IMPORTANT)
This project folder may live inside OneDrive for syncing source code across machines.
To prevent OneDrive duplication issues ("- Copy", "(2)" etc.):

Do sync:
- src/, public/, docs/, config files

Do NOT sync (generated/heavy):
- node_modules/
- .next/
- dist/, build/ (if present)

Recommended: OneDrive Settings  Account  Choose folders  exclude the heavy folders above.

## Common issues

### Can't delete node_modules (Access denied)
Close VS Code and any running node processes, then run:
  taskkill /F /IM node.exe

### Fresh install
If something gets weird:
  (delete) node_modules and .next
  npm install
  npm run dev
