# Configuration

The installed configuration lives at `adws/adw_sssf_config/sssf.config.yaml`. It defines defaults, protected paths, allowed environment names, timeouts, and configured agents. Each agent names a Pi or OpenCode provider, model, thinking level, tools, writes, and prompt files.

Default protected paths are `adws/factory/`, `adws/adw_sssf_config/`, and `adws/factory/modules/change-delivery/workflows/`. Agent writes are enforced in the disposable Git workspace; unauthorized changes are rolled back and fail the phase. Runtime session files live under configured `data_dir` and are not part of repository write permissions.

Use `--config <path>` or `SSSF_CONFIG` to select a configuration. Agent owners in workflow phase definitions must exist in the roster. Provider credentials are validated before invocation.
