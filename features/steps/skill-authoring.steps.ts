import { When } from "@cucumber/cucumber";
import type { EstelleWorld } from "../support/world.js";

When(
	"the operator asks Estelle to create the skill {string}",
	async function (this: EstelleWorld, name: string) {
		await this.launched!.createSkill(name);
	},
);
