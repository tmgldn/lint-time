import { lintTime } from ".";
import { rename } from "node:fs/promises";

beforeAll(async () => {
  await rename("package.json", "package2.json");
});

afterAll(async () => {
  await rename("package2.json", "package.json");
});

test("lintTime", async () => {
  expect(() => lintTime()).rejects.toThrowError();
});
