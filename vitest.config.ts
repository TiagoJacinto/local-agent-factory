import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		environment: "node",
		include: ["src/**/*.test.ts", "src/**/*.spec.ts"],
		projects: [
			{
				extends: true,
				test: {
					name: "hvut",
					include: ["features/**/*.hvut.ts"],
					environment: "node",
				},
			},
		],
	},
});
