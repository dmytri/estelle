#!/usr/bin/env node

// Operator launch command. Drops the operator into pi's interactive session as
// Bonny; the seam resolves its own shipped assets when the directory carries
// none, and stays in the TUI until the operator exits.
/**
 * @planks("Then the package provides an executable \"estelle\" command")
 */
require("../dist/index.js")
	.run()
	.catch((err) => {
		console.error(err);
		process.exitCode = 1;
	});
