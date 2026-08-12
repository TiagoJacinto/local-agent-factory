# pi-git-push-gate

Project-local Pi package for the repository push policy.

## Install

```bash
pi install -l ./pi-git-push-gate
```

Restart Pi after installation.

## Policy

- Normal `git push` runs `lefthook run pre-push` first.
- A failed gate blocks the push and reports the output.
- `--no-verify` is blocked.
- Force pushes are blocked.
- Other Bash commands are unchanged.

This package applies to commands run by Pi. Git hooks and protected-branch CI remain the repository-wide enforcement layer.
