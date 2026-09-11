export interface ImplementRequest {
  readonly specificationPath: string;
}

export interface RequiredBehavior {
  readonly id: string;
  readonly description: string;
}

export interface TestSeam {
  readonly module: string;
  readonly publicInterface: string;
  readonly rationale: string;
  readonly testPaths: readonly string[];
}

export interface TddSeamProposal {
  readonly status: "success";
  readonly baselineCommand: string;
  readonly behaviors: readonly RequiredBehavior[];
  readonly seams?: readonly TestSeam[];
}

export interface TddSlice {
  readonly status: "slice";
  readonly behavior: string;
  readonly testCommand: string;
  readonly activeSuiteCommand: string;
  readonly expectedFailure: string;
  readonly changedFiles: readonly string[];
  readonly additionalSeams: readonly TestSeam[];
}

export interface ImplementationPullRequest {
  readonly number: number;
  readonly url: string;
  readonly headBranch: string;
  readonly baseBranch: string;
}
