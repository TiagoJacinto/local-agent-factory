import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		environment: "node",
		projects: [
			{
				extends: true,
				test: {
					name: "unit",
					include: ["src/**/*.test.ts", "src/**/*.spec.ts"],
					environment: "node",
				},
			},
			{
				extends: true,
				test: {
					name: "hvut",
					include: ["tests/**/*.hvut.ts"],
					environment: "node",
				},
			},
		],
	},
});
