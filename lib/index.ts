import { Instruction, instructionsToPipelines, shellEscape } from "./utils";
import { execSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { relative } from "node:path/posix";

const MAX_ARG_LENGTH = 120_000;

export const lintTime = async (): Promise<boolean> => {
  const json = JSON.parse(await readFile("package.json", "utf8"));

  let instructions: Instruction[];
  if (
    Array.isArray(json["lint-time"]) &&
    json["lint-time"].every((x) => Array.isArray(x) && x.every((y) => typeof y === "string"))
  ) {
    for (const instruction of json["lint-time"]) {
      if (instruction.length < 2) {
        throw new Error(`${JSON.stringify(instruction)} is not a valid instruction`);
      }
    }
    instructions = json["lint-time"];
  } else {
    throw new Error(`"lint-time" key must appear in package.json and must be of type string[][]`);
  }

  const stagedFilePaths = execSync("git diff --diff-filter=ACM --name-only --cached")
    .toString()
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((filePath) => process.cwd() + "/" + filePath);

  const pipelines = instructionsToPipelines(instructions, stagedFilePaths);

  try {
    await Promise.all(
      pipelines.map(async ([commands, entries]) => {
        for (const [i, command] of commands.entries()) {
          const filePaths = entries
            .filter(([, steps]) => steps.has(i))
            .map(([filePath]) => shellEscape(relative(process.cwd(), filePath)));

          const chunks: string[][] = [[]];
          let leftInChunk = MAX_ARG_LENGTH - command.length;
          let activeChunk = chunks[0];

          for (const filePath of filePaths) {
            if (leftInChunk > filePath.length || activeChunk.length === 0) {
              activeChunk.push(filePath);
            } else {
              activeChunk = [filePath];
              chunks.push(activeChunk);
              leftInChunk = MAX_ARG_LENGTH - command.length;
            }
          }

          for (const chunk of chunks) {
            try {
              execSync(`${command} ${chunk.join(" ")}`, { stdio: "inherit" });
            } catch (error) {
              const error_ =
                error && typeof error === "object" && "status" in error && error.status
                  ? error.status
                  : error;
              throw error_;
            }
          }
        }
      })
    );
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    return false;
  }
  return true;
};
