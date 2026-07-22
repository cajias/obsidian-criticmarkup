module.exports = {
	testEnvironment: 'jsdom',
	testMatch: ["**/tests/**/*.test.ts"],
	// cursor_movement.test.ts depends on unmocked Obsidian `app` global
	testPathIgnorePatterns: ["/node_modules/", "tests/cursor_movement.test.ts"],

	collectCoverage: false,

	transform: {
		"^.+\\.(ts|js|jsx)$": "esbuild-jest"
	},


	moduleDirectories: ["node_modules", "src", "tests"],
	moduleFileExtensions: ['js', 'ts'],
	moduleNameMapper: {
		"^obsidian$": "<rootDir>/__mocks__/obsidian.ts",
	},

	setupFilesAfterEnv: ["jest-expect-message"],
	noStackTrace: true,
};
