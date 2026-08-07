export {};

const roots = ["src/adws", "src/scripts"];
const files = roots.flatMap((root) =>
	[...new Bun.Glob("**/*.ts").scanSync(root)].map((file) => `${root}/${file}`),
);
let failed = 0;
for (const file of files) {
	const result = await Bun.build({ entrypoints: [file], target: "bun" });
	if (!result.success) {
		console.error(file, result.logs);
		failed++;
	}
}
if (failed) process.exit(1);
console.log(`built ${files.length} TypeScript files`);
