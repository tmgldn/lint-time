#!/usr/bin/env node
/* eslint-disable no-console */

import { lintTime } from "../lib";

lintTime()
  .then((wasSuccess) => {
    if (wasSuccess) {
      console.log("lint-time success");
    } else {
      console.log("lint-time failed");
      process.exit(1);
    }
  })
  .catch((error) => {
    throw error;
  });
