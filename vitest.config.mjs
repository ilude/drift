import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		environmentOptions: {
			jsdom: {
				url: "http://localhost/",
			},
		},
		coverage: {
			provider: "v8",
			include: ["src/**/*.js"],
			exclude: ["src/__tests__/**", "dist/**"],
		},
	},
});
