# Progression decision checklist

## Before adding any phase

1. Which repeated human action, failure, quality gap, isolation risk, or capacity limit is measured?
2. Can deterministic code solve it before adding another agent?
3. Can a smaller change to the current workflow solve it?
4. Has a human walked the proposed workflow end to end?
5. Which existing step and artifact will the new capability consume and produce?
6. What state does the component own?
7. Which layer owns retries, timeout, cancellation, and reconciliation?
8. What is the idempotency strategy for side effects?
9. How is it tested without a live model or external service?
10. How is it disabled, exported, backed up, restored, and removed locally?
11. Which metric and exit gate prove it deserves to remain?
12. Do all earlier phase acceptance tests still pass?

## Do not advance when

- the primary argument is “we may need it later”;
- the new agent duplicates an existing role without measured benefit;
- workflow control is being hidden inside a large skill or prompt;
- deterministic checks are being replaced by LLM judgment;
- the current phase has not been exercised on representative work;
- rollback and local recovery are undefined.
