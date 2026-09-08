# Configuration

The installed configuration lives at `local-agent-factory.config.yaml`. It defines defaults, protected files, allowed environment names, timeouts, configured agents, and each agent's inline system and user prompts. Each agent names a Pi or OpenCode provider, model, thinking level, tools, and write boundaries.

Runtime session files live under the configured `data_dir` and are not part of repository write permissions. Agent owners in workflow phase definitions must exist in the roster. Provider credentials are validated before invocation.
