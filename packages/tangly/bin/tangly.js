#!/usr/bin/env node
import("../dist/cli/index.js")
  .then(({ run }) => run(process.argv.slice(2)))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
