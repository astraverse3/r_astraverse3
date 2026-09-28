import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // 디자인 핸드오프 번들(시안 코드) — 우리 코드가 아니다
    "docs/**",
  ]),
  {
    // CommonJS 스크립트는 require가 정상이다
    files: ["**/*.js", "**/*.cjs"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  {
    // 로고·Google 아바타뿐이라 next/image 이득이 없다(아바타는 remotePatterns까지 필요)
    rules: {
      "@next/next/no-img-element": "off",
    },
  },
]);

export default eslintConfig;
