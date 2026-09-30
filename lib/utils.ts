import { normalize } from "node:path/posix";

const GLOBSTAR_REGEX = /(^|\/)\\\*\\\*(?:\/|$)/;
const WILDCARD_REGEX = /\\\*/;
const SET_REGEX = /\\{(.*)?(\\})/;
const COMMA_REGEX = /,/g;

export const globToRegex = (glob: string, basePath = process.cwd()): RegExp => {
  // features:
  // relative / absolute based on start of glob
  const isAbsolute = glob.startsWith("/");
  let regexSource = escapeStringForRegex(normalize(glob));
  // ** = globstar (must not have adjacent char besides a /)
  let globstarMatch = regexSource.match(GLOBSTAR_REGEX);
  while (globstarMatch !== null) {
    const index = globstarMatch.index;
    if (index === undefined) {
      break;
    } else {
      regexSource =
        regexSource.slice(0, index) +
        globstarMatch[1] +
        ".*" +
        regexSource.slice(index + globstarMatch[0].length);
      globstarMatch = regexSource.match(GLOBSTAR_REGEX);
    }
  }
  // * = wildcard
  let wildcardMatch = regexSource.match(WILDCARD_REGEX);
  while (wildcardMatch !== null) {
    const index = wildcardMatch.index;
    if (index === undefined) {
      break;
    } else {
      regexSource =
        regexSource.slice(0, index) + "[^/]*" + regexSource.slice(index + wildcardMatch[0].length);
      wildcardMatch = regexSource.match(WILDCARD_REGEX);
    }
  }
  // {,} = set
  let setMatch = regexSource.match(SET_REGEX);
  while (setMatch !== null) {
    const index = setMatch.index;
    if (index === undefined) {
      break;
    } else {
      regexSource =
        regexSource.slice(0, index) +
        "(?:" +
        setMatch[1].replace(COMMA_REGEX, "|") +
        ")" +
        regexSource.slice(index + setMatch[0].length);
      setMatch = regexSource.match(SET_REGEX);
    }
  }

  return new RegExp(
    "^" +
      (isAbsolute ? "" : escapeStringForRegex(ensureEndsWithSlash(normalize(basePath)))) +
      regexSource +
      "$"
  );
};

const ESCAPE_REGEX = /[\t\n$()*+.?[\\\]^{|}]/g;
const replacer = (value: string): string => {
  if (value === "\n") {
    return "\\n";
  }
  if (value === "\t") {
    return "\\t";
  }
  return "\\" + value;
};

export const escapeStringForRegex = (string: string): string => {
  return string.replace(ESCAPE_REGEX, replacer);
};

export const ensureEndsWithSlash = (path: string): string => {
  return path.endsWith("/") ? path : path + "/";
};

export type Instruction = [glob: string, ...commands: string[]];
export type Pipeline = [commands: string[], entries: [filePath: string, steps: Set<number>][]];

export const instructionsToPipelines = (
  instructions: Instruction[],
  filePaths: string[]
): Pipeline[] => {
  const fileCommandsMap = new Map<string, string[]>();

  for (const [glob_, ...commands] of instructions) {
    let glob = glob_;
    if (glob.startsWith("/")) {
      glob = glob.slice(1);
    } else if (!glob.startsWith("**/")) {
      glob = "**/" + glob;
    }

    const regex = globToRegex(glob);
    for (const filePath of filePaths) {
      if (regex.test(filePath)) {
        const maybeFileCommands = fileCommandsMap.get(filePath);
        let fileCommands: string[];
        if (maybeFileCommands) {
          fileCommands = maybeFileCommands;
        } else {
          fileCommands = [];
          fileCommandsMap.set(filePath, fileCommands);
        }
        fileCommands.push(...commands);
      }
    }
  }

  const sortedFileInstructionSets = [...fileCommandsMap.entries()].sort(
    ([, a], [, b]) => b.length - a.length
  );

  const pipelines: [commands: string[], entries: [filePath: string, steps: Set<number>][]][] = [];
  file: for (const [filePath, commands] of sortedFileInstructionSets) {
    for (const pipeline of pipelines) {
      const steps = new Set<number>();
      let j = 0;
      for (let i = 0; i < pipeline[0].length; i++) {
        if (commands[j] === pipeline[0][i]) {
          steps.add(i);
          j += 1;
          if (j === commands.length) break;
        }
      }
      const couldFileUsePipeline = j === commands.length;
      if (couldFileUsePipeline) {
        pipeline[1].push([filePath, steps]);
        continue file;
      }
    }
    pipelines.push([commands, [[filePath, new Set(commands.map((_, i) => i))]]]);
  }

  for (const pipeline of pipelines) {
    const gitAddIndex = pipeline[0].length;
    pipeline[0].push("git add");
    for (const fileData of pipeline[1]) {
      fileData[1].add(gitAddIndex);
    }
  }

  return pipelines;
};

const REQUIRES_ESCAPE_REGEX = /[^\w/:=-]/;
const QUOTE_REGEX = /'/g;
const LEADING_QUOTES_REGEX = /^(?:'')+/g;
const BACKSLASH_QUOTES_REGEX = /\\'''/g;

export const shellEscape = (arg: string): string =>
  REQUIRES_ESCAPE_REGEX.test(arg)
    ? `'${arg.replace(QUOTE_REGEX, "'\\''")}'`
        .replace(LEADING_QUOTES_REGEX, "")
        .replace(BACKSLASH_QUOTES_REGEX, "\\'")
    : arg;
