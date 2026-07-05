// The Estelle seam and its pi dependency are ESM-only. Step support reaches the
// seam through dynamic import(), which needs the tsx ESM loader registered at
// runtime; tsx/cjs hooks require() only. Register the ESM loader here so the
// RIGGING verification commands resolve the TypeScript ESM seam unchanged.
require("tsx/esm/api").register();

module.exports = {
	default: {
		requireModule: ["tsx/cjs"],
		require: [
			"features/steps/**/*.ts",
			"features/support/**/*.ts",
			"packages/*/features/steps/**/*.ts",
			"packages/*/features/support/**/*.ts",
		],
		paths: ["features/**/*.feature", "packages/*/features/**/*.feature"],
		format: ["progress"],
	},
};
