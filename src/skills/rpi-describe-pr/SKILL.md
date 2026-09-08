---
name: rpi-describe-pr
disable-model-invocation: true
description: Compose and publish the reviewed description for one stacked pull request.
---

# Describe a pull request

The `implement-outline` Workflow uses this contract after deterministic validation and before feedback babysitting. It creates or updates exactly one pull request for the current phase branch, preserving the phase's stack base.

## Contract

1. Inspect the current branch's pull request, if one exists.
2. Read the complete diff and account for every changed file.
3. Compose the description from the phase title, outline body, actual verification evidence, and visual evidence.
4. Replace only the managed description content; preserve unrelated pull-request prose.
5. Attach before/after or preview media through the installed `before-and-after` skill when the phase changes UI.
6. Verify the rendered description and attachment URLs.

The Workflow invokes GitHub through deterministic Command Primitives and records the pull-request URL, branch relationship, description result, and visual-evidence result in Run Evidence. It never merges, deploys, or modifies the integration branch.

## Manual use

When this skill is invoked outside the Workflow, apply the same contract to the current branch and current branch pull request. Keep descriptions in memory or send them directly to GitHub; do not create additional RPI artifacts.
