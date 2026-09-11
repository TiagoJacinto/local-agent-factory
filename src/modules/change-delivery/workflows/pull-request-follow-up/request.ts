export interface PullRequestReference {
  readonly number: number;
  readonly headBranch: string;
  readonly baseBranch: string;
}

export interface PullRequestFollowUpRequest {
  readonly pullRequests: readonly PullRequestReference[];
}

export interface CommentDisposition {
  readonly commentId: string;
  readonly action: "no_change" | "reply_only" | "fix";
  readonly rationale: string;
  readonly changedFiles: readonly string[];
  readonly reply: string;
}
