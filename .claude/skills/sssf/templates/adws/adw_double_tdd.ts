#!/usr/bin/env bun
// @ts-nocheck
import { main } from "./adw_modules/cli";
import * as doubleTdd from "./adw_modules/double_tdd";

/**
 * Phases: scope → select outer → write outer → focused outer → inner red/green → suites → coverage
 * The runtime is copied with the installer templates.
 */
main(async (x) => Number(await doubleTdd.run(x)));
