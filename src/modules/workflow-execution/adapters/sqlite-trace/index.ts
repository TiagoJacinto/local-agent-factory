import type { TraceEvent, TraceSinkPort } from "../../ports/trace-sink";

export class InMemoryTraceSink implements TraceSinkPort {
  readonly events: TraceEvent[] = [];
  record(event: TraceEvent): void {
    this.events.push(event);
  }
  project(runIdentifier: string): readonly TraceEvent[] {
    return this.events.filter((event) => event.runIdentifier === runIdentifier);
  }
}
