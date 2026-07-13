---
description: Run commands in the Nix environment
---
To run any command that requires npm or other node modules:

1. Ensure `shell.nix` exists in the project root.
2. Run the command wrapped in `nix-shell`:

```bash
nix-shell --run "your-command-here"
```

Example:
```bash
nix-shell --run "npm install"
nix-shell --run "npm test"
```
