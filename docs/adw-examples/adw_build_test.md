# `adw_build_test`

Use when a builder must satisfy an existing test suite.

Chain: **request → builder → test/fix loop → git commit → review**.

The known test command runs in a code phase. Failed tests return to the same
builder for bounded repair attempts. A commit occurs only after green tests.
