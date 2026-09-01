# Observability

Every Factory run records phase and primitive lifecycle events, artifact evidence, source revision, workspace path, failures, and integration decisions. The evidence manifest is persisted by the run ledger. Installed execution additionally writes ordered events to the configured SQLite database (`SSSF_DB`, default `adws/adw_data/sssf.db`) in the `workflow_trace` table.

Use the installed `just sessions`, `just phases <run-id>`, and `just tail <run-id>` commands where supported by the target repository. Do not infer status from agent output: inspect the evidence manifest and trace projection.
