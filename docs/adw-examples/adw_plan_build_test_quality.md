# `adw_plan_build_test_quality`

Use when the repository has lint, typecheck, or build commands worth enforcing.

Chain: **request → planner → builder → quality/fix loop → git commit → review**.

Quality checks run as deterministic code phases before the tested result is
committed. Failures return to the builder for bounded repair attempts.
