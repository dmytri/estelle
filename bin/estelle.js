#!/usr/bin/env node

// Operator launch command. Drops the operator into pi's interactive session as
// Bonny; the seam resolves its own shipped assets when the directory carries
// none, and stays in the TUI until the operator exits. CLI arguments pass
// through to pi so package commands act exactly as pi's own.
/**
 * @planks("Then the package provides an executable \"estelle\" command")
 * @planks("When the operator runs estelle with the arguments \"install npm:pi-web-access\"")
 */
require("../dist/index.js")
	.run({ argv: process.argv.slice(2) })
	.catch(
		/**
		 * @planks("Then the command exits with a nonzero status")
		 * @planks("Then the command prints the launch error to stderr")
		 */
		(err) => {
			console.error(err);
			process.exitCode = 1;
		},
	);
