const esbuild = require("esbuild");

const isProduction = process.argv.includes('--production');
const isWatch = process.argv.includes('--watch');

/**
 * @type {import('esbuild').Plugin}
 */
const esbuildProblemMatcherPlugin = {
	name: 'esbuild-problem-matcher',

	setup(build) {
		build.onStart(() => {
			console.log('[watch] build started');
		});
		build.onEnd((result) => {
			result.errors.forEach(({ text, location }) => {
				console.error(`✘ [ERROR] ${text}`);
				console.error(`    ${location.file}:${location.line}:${location.column}:`);
			});
			console.log('[watch] build finished');
		});
	},
};

/** @type {import('esbuild').BuildOptions} */
const buildOptions = {
	entryPoints: ['./src/extension.ts'],
	bundle: true,
	outfile: 'dist/extension.js',
	external: [
		'vscode',
		// Add native modules to external
		'speaker',
		'node-microphone'
	],
	format: 'cjs',
	platform: 'node',
	target: 'node16',
	sourcemap: !isProduction,
	minify: isProduction,
	sourcesContent: false,
	logLevel: 'info',
	define: {
		'process.env.NODE_ENV': isProduction ? '"production"' : '"development"'
	},
	plugins: [
		esbuildProblemMatcherPlugin,
	],
};

if (isWatch) {
	// Watch mode
	esbuild.context(buildOptions)
		.then(ctx => ctx.watch())
		.catch(() => process.exit(1));
} else {
	// Single build
	esbuild.build(buildOptions)
		.catch(() => process.exit(1));
}
