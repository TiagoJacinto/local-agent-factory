export interface ImplementOutlineRequest {
  readonly outlinePath: string;
  readonly maxValidationAttempts?: number;
  readonly babysitPolls?: number;
}

export interface OutlinePhase {
  readonly number: number;
  readonly title: string;
  readonly body: string;
  readonly validationCommands: readonly string[];
  readonly changesUi: boolean;
  readonly beforeCaptureCommand?: string;
  readonly afterCaptureCommand?: string;
}

export interface StackPullRequest {
  readonly phase: number;
  readonly number: number;
  readonly url: string;
  readonly headBranch: string;
  readonly baseBranch: string;
}

export interface CommentDisposition {
  readonly commentId: string;
  readonly action: "no_change" | "reply_only" | "fix";
  readonly rationale: string;
  readonly changedFiles: readonly string[];
  readonly reply: string;
}
