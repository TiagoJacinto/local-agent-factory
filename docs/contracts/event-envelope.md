# Event envelope contract

Every external event is normalized into `EventEnvelope` before workflow dispatch.

Required fields:

- `event_id`: source delivery identifier
- `event_type`: source event family
- `event_action`: optional action
- `source`: provider name
- `correlation_id`: end-to-end trace identifier
- `causation_id`: parent event or operation
- `repository`: repository identity when relevant
- `subject_number`: issue or PR number
- `expected_head_sha`: exact revision agents may act against
- `payload`: original source data

## Invariants

- `event_id` is unique within a source.
- Writes caused by an event use an idempotency key derived from the event and target operation.
- A PR-changing operation must verify `expected_head_sha` immediately before committing, pushing, commenting, approving, or merging.
- Duplicate events return success-like acknowledgement and do not start duplicate work.
