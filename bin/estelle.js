#!/usr/bin/env node

// Operator launch command. Boots Estelle from the operator's directory; the
// seam resolves its own shipped assets when the directory carries none.
/**
 * @planks("Then the package provides an executable \"estelle\" command")
 */
require("../dist/index.js").launch();
