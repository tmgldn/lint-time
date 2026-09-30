import {
  ensureEndsWithSlash,
  escapeStringForRegex,
  globToRegex,
  Instruction,
  instructionsToPipelines,
} from "./utils";

const abs = (path: string) => `${process.cwd()}/${path}`;

test("globToRegex", () => {
  expect(globToRegex(`./**/*.{ts,tsx}`).test(process.cwd() + "/wow/test.tsx")).toBe(true);
  expect(globToRegex(`./nothing/much.here`).test(process.cwd() + "/nothing/much.here")).toBe(true);
  expect(globToRegex(`./**/*.{ts,tsx}`).test("/wow/test.tsx")).toBe(false);
  expect(globToRegex(`./nothing/much.here`).test("/nothing/much.here")).toBe(false);
  expect(globToRegex(`./**/*.{ts,tsx}`).test(process.cwd() + "/wow/test.ts")).toBe(true);
  expect(globToRegex(`./**/*.{ts,tsx}`).test(process.cwd() + "/wow/test.t")).toBe(false);
  expect(globToRegex(`./**/*.{ts,tsx}`).test(process.cwd() + "/wow/foo/bar/test.ts")).toBe(true);
  expect(globToRegex(`./**/*.{ts,tsx}`).test(process.cwd() + "/a/.ts")).toBe(true);
  expect(globToRegex(`./**/*.{ts,tsx}`).test(process.cwd() + "/.ts")).toBe(true);
  expect(globToRegex(`./**/*.{ts,tsx}`).test(process.cwd() + "ss/.ts")).toBe(false);
  expect(globToRegex(`./**/*.{ts,tsx}`).test(process.cwd() + "/test.ts")).toBe(true);
  expect(globToRegex(`./**/{.keep,.*.tmp}`).test(process.cwd() + "/.keep")).toBe(true);
  expect(globToRegex(`./**/{.keep,.*.tmp}`).test(process.cwd() + "/.tmp")).toBe(false);
  expect(globToRegex(`./**/{.keep,.*.tmp}`).test(process.cwd() + "/.keep.temp")).toBe(false);
  expect(globToRegex(`./**/{.keep,.*.tmp}`).test(process.cwd() + "/.keep.tmp")).toBe(true);
  expect(globToRegex(`./**/{.keep,.*.tmp}`).test(process.cwd() + "/a/.hi.tmp")).toBe(true);
});

test("escapeStringForRegex", () => {
  expect(escapeStringForRegex(`///`)).toBe("///");
  expect(escapeStringForRegex(`\\`)).toBe("\\\\");
  expect(escapeStringForRegex(`hello.world*`)).toBe("hello\\.world\\*");
});

test("ensureEndsWithSlash", () => {
  expect(ensureEndsWithSlash("/hello/world")).toBe("/hello/world/");
  expect(ensureEndsWithSlash("/hello/world/")).toBe("/hello/world/");
  expect(ensureEndsWithSlash("/hello")).toBe("/hello/");
  expect(ensureEndsWithSlash("/")).toBe("/");
});

test("instructionsToPipelines", () => {
  const instructions: Instruction[] = [
    ["*.ts", "npx eslint -c .eslintrc.cjs --cache --fix --max-warnings=0"],
    ["*.{ts,js,cjs,mjs,json}", "npx prettier --ignore-path .gitignore --write"],
  ];
  const filePaths = [
    ".editorconfig",
    ".eslintrc.cjs",
    ".gitignore",
    ".scripts/build.ts",
    ".scripts/checkBuild.ts",
    ".scripts/lib/utils.ts",
    ".vscode/extensions.json",
    ".vscode/settings.json",
    "LICENSE",
    "README.md",
    "banner.svg",
    "cli/index.ts",
    "lib/exclamation.ts",
    "lib/index.test.ts",
    "lib/index.ts",
    "package-lock.json",
    "package.json",
    "tsconfig.json",
    // eslint-disable-next-line unicorn/no-array-callback-reference
  ].map(abs);
  expect(instructionsToPipelines(instructions, filePaths)).toEqual([
    [
      [
        "npx eslint -c .eslintrc.cjs --cache --fix --max-warnings=0",
        "npx prettier --ignore-path .gitignore --write",
        "git add",
      ],
      [
        [abs(".scripts/build.ts"), new Set([0, 1, 2])],
        [abs(".scripts/checkBuild.ts"), new Set([0, 1, 2])],
        [abs(".scripts/lib/utils.ts"), new Set([0, 1, 2])],
        [abs("cli/index.ts"), new Set([0, 1, 2])],
        [abs("lib/exclamation.ts"), new Set([0, 1, 2])],
        [abs("lib/index.test.ts"), new Set([0, 1, 2])],
        [abs("lib/index.ts"), new Set([0, 1, 2])],
        [abs(".eslintrc.cjs"), new Set([1, 2])],
        [abs(".vscode/extensions.json"), new Set([1, 2])],
        [abs(".vscode/settings.json"), new Set([1, 2])],
        [abs("package-lock.json"), new Set([1, 2])],
        [abs("package.json"), new Set([1, 2])],
        [abs("tsconfig.json"), new Set([1, 2])],
      ],
    ],
  ]);
});
