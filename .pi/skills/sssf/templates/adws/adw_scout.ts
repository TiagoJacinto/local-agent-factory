#!/usr/bin/env bun
import { main } from "./adw_modules/cli"; import * as workflow from "./adw_modules/workflows";
main(async (x) => workflow.scout(x));
