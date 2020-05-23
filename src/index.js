const fs = require("fs");
const { spawn } = require("child_process");

// https://github.com/sindresorhus/is-stream/blob/master/index.js
const isWriteStream = (s) =>
  s !== null &&
  typeof s === "object" &&
  typeof s.pipe === "function" &&
  s.writable !== false &&
  typeof s._write === "function" &&
  typeof s._writableState === "object";

class ShellPipeline {
  constructor(pipes = []) {
    this.pipes = pipes;
    if (this.pipes.length < 1)
      throw Error("New ShellPipelines must have at least one pipe.");
    this.head = this.pipes[0];
    this.tail = this.pipes[this.pipes.length - 1];

    // for .end() promise
    this.tailExitListeners = [];
    this.done = (cb) => {
      this.tailExitListeners.push(cb);
    };
    this.writeEndListeners = [];
    this.tail.process.on("exit", async () => {
      await Promise.all(this.writeEndListeners);
      for (const listener of this.tailExitListeners) {
        listener();
      }
    });
  }

  end() {
    return new Promise((resolve, reject) => {
      this.done(() => {
        resolve();
      });
    });
  }

  pipe(shellPipeline) {
    if (!shellPipeline instanceof ShellPipeline) {
      throw Error(
        "Can only pipe to another Shell process, not",
        typeof shellPipeline
      );
    }
    const newPipes = this.pipes.slice();
    newPipes.push(shellPipeline.tail);
    const newPipeline = new ShellPipeline(newPipes);
    this.tail.process.stdout.pipe(newPipeline.tail.process.stdin);
    return newPipeline;
  }

  redirect(destination) {
    let ws;
    if (typeof destination === "string") {
      ws = fs.createWriteStream(destination);
    } else if (isWriteStream(destination)) {
      ws = destination;
    } else {
      throw Error("Can only redirect to a file (string), or write stream.");
    }
    this.tail.process.stdout.pipe(ws);
    this.writeEndListeners.push(
      new Promise((resolve, reject) => {
        ws.on("finish", resolve);
        ws.on("error", reject);
      })
    );
    return this;
  }

  append(path) {
    if (typeof path !== "string") {
      throw Error("Can only append to a file, argument must be a string");
    }
    const ws = fs.createWriteStream(path, { flags: "a" });
    this.tail.process.stdout.pipe(ws);
    this.writeEndListeners.push(
      new Promise((resolve, reject) => {
        ws.on("finish", resolve);
        ws.on("error", reject);
      })
    );
    return this;
  }
}

class ShellPipe {
  constructor(cmdFile, cmdArgs) {
    this.cmdFile = cmdFile;
    this.cmdArgs = cmdArgs;
    this.process = spawn(cmdFile, cmdArgs);
  }
}

const STATE = {
  INITIAL: 1,
  CMD_NAME: 2,

  ARGS: 3,
  ARG_PARSE_TOKEN: 4,
  ARG_PARSE_VALUE: 5,
  ARG_PARSE_STRING_SINGLE: 6,
  ARG_PARSE_STRING_DOUBLE: 7,
};

const char_is = {
  whitespace: (c) => /\s/.test(c),
  nonwhitespace: (c) => /\S/.test(c),
};

function parseShellTemplate(strings, values) {
  let cmdFile;
  const args = [];

  let argString;
  let argToken;
  let argValue;

  let state = STATE.INITIAL;
  for (let i = 0; i < strings.length; i++) {
    const s = strings[i];
    const v = values[i];

    for (let si = 0; si < s.length; si++) {
      const char = s[si];
      switch (state) {
        case STATE.INITIAL:
          if (char_is.whitespace(char)) continue;
          else {
            state = STATE.CMD_NAME;
            cmdFile = char;
          }
          break;
        case STATE.CMD_NAME:
          if (char_is.nonwhitespace(char)) {
            cmdFile += char;
            continue;
          } else {
            state = STATE.ARGS;
          }
          break;
        case STATE.ARGS:
          if (char_is.whitespace(char)) continue;
          else if (char === "'") {
            state = STATE.ARG_PARSE_STRING_SINGLE;
            argString = "";
          } else if (char === '"') {
            state = STATE.ARG_PARSE_STRING_DOUBLE;
            argString = "";
          } else {
            state = STATE.ARG_PARSE_TOKEN;
            argToken = char;
          }
          break;
        case STATE.ARG_PARSE_TOKEN:
          if (char_is.whitespace(char)) {
            args.push(argToken);
            state = STATE.ARGS;
          } else {
            argToken += char;
            continue;
          }
          break;
        case STATE.ARG_PARSE_VALUE:
          if (char_is.whitespace(char)) {
            state = STATE.ARGS;
            args.push(argValue);
          } else {
            argValue += char;
          }
          break;
        case STATE.ARG_PARSE_STRING_SINGLE:
          if (char === "'") {
            state = STATE.ARGS;
            args.push(argString);
          } else {
            argString += char;
          }
          break;
        case STATE.ARG_PARSE_STRING_DOUBLE:
          if (char === '"') {
            state = STATE.ARGS;
            args.push(argString);
          } else {
            argString += char;
          }
          break;
      }
    }

    // this is where the "[value]" would happen
    if (v) {
      switch (state) {
        case STATE.INITIAL:
          throw Error("CMD_NAME_ERROR");
        case STATE.CMD_NAME:
          throw Error("CMD_NAME_ERROR");
        case STATE.ARGS:
          state = STATE.ARG_PARSE_VALUE;
          argValue = v.toString();
          break;
        case STATE.ARG_PARSE_TOKEN:
          argToken += v.toString();
          break;
        case STATE.ARG_PARSE_VALUE:
          argValue += v.toString();
          break;
        case STATE.ARG_PARSE_STRING_SINGLE:
          throw Error(`SHL_EXPRESSION_ERROR`)
        case STATE.ARG_PARSE_STRING_DOUBLE:
          throw Error(`SHL_EXPRESSION_ERROR`)
          break;
      }
    }
  }
  // this is where "EOF" would happen
  switch (state) {
    case STATE.INITIAL:
      throw Error("CMD_NAME_ERROR");
    case STATE.CMD_NAME:
      // aint no problem
      break;
    case STATE.ARGS:
      // aint no problem
      break;
    case STATE.ARG_PARSE_TOKEN:
      // aint no problem
      args.push(argToken);
      break;
    case STATE.ARG_PARSE_VALUE:
      // aint no problem
      args.push(argValue);
      break;
    case STATE.ARG_PARSE_STRING_SINGLE:
    case STATE.ARG_PARSE_STRING_DOUBLE:
      throw Error("ARG_STRING_ERROR");
  }
  return { cmdFile, args };
}
function shell(strings, ...values) {
  const { cmdFile, args } = parseShellTemplate(strings, values);
  const pipe = new ShellPipe(cmdFile, args);
  return new ShellPipeline([pipe]);
}

module.exports = { shell };
