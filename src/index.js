const fs = require('fs')
const {execFile} = require('child_process');

// https://github.com/sindresorhus/is-stream/blob/master/index.js
const isWriteStream = s => s !== null &&
  typeof s === 'object' &&
  typeof s.pipe === 'function' && 
  s.writable !== false &&
	typeof s._write === 'function' &&
	typeof s._writableState === 'object'


class ShellProcess {
  constructor(cmdFile, cmdArgs) {
    this.process = execFile(cmdFile, cmdArgs);
    this.pipes = [];
    this.redirected = false;
    this.appended = false;

    this.doneListeners = []
    this.done = (cb) => {
      this.doneListeners.push(cb);
    }
    this.process.on('exit', () => {
      if(this.pipes.length === 0){
        for(const listener of this.doneListeners) {
          listener();
        }
      }
    })
  }
  end() {
    return new Promise((resolve, reject) => {
      this.done(() => {
        resolve()
      });
    })
  }
  pipe(shellProcess) {
    //if (this.redirected) throw Error('Cant pipe once redirected');
    if (this.appended) throw Error('Cant pipe once appended');

    if(!shellProcess instanceof ShellProcess) {
      throw Error('Can only pipe to another Shell process, not', typeof shellProcess)
    }

    const length = this.pipes.push(shellProcess);

    if(length === 1) {
      this.process.stdout.pipe(shellProcess.process.stdin)
    }
    else {
      this.pipes[this.pipes.length - 2].process.stdout.pipe(shellProcess.process.stdin);
    }
    shellProcess.process.on('exit', () => {
      if(length === this.pipes.length){
        for(const listener of this.doneListeners) {
          listener();
        }
      }
    })
    return this;
  }
  redirect(destination) {
    //if (this.redirected) throw Error('Can only redirect a shell once');
    if (this.appended) throw Error('Cant redirect when already appended');
    this.redirected = true;
    const sourceStream = this.pipes.length > 0
      ? this.pipes[this.pipes.length -1].process.stdout
      : this.process.stdout;
    if(typeof destination === 'string') {
      sourceStream.pipe(fs.createWriteStream(destination))  
    }
    else if (isWriteStream(destination)) {
      sourceStream.pipe(destination);
    }
    else {
      throw Error('Can only redirect to a file (string), or write stream.')
    }
    return this;
  }

  append(path) {
    if (this.redirected) throw Error('Cant append when already redirected');
    if (this.appended) throw Error('Can only append once');
    if(typeof path !== 'string') {
      throw Error('Can only append to a file, argument must be a string')
    }
    this.appended = true;
    const sourceStream = this.pipes.length > 0
      ? this.pipes[this.pipes.length -1].process.stdout
      : this.process.stdout;
    sourceStream.pipe(fs.createWriteStream(path, {flags:'a'}))
    return this;
  }

}

const STATE = {
  INITIAL: 1,
  CMD_NAME: 2,

  ARGS: 7,
  ARG_PARSE_TOKEN: 8,
  ARG_PARSE_VALUE: 9,
  ARG_PARSE_STRING_SINGLE: 10,
  ARG_PARSE_STRING_DOUBLE: 11,
}

const char_is = {
  quote: c => c === '"' || c === "'",
  whitespace: c => /\s/.test(c),
  nonwhitespace: c => /\S/.test(c),

}

function parseShellTemplate(strings, values){
  let cmdFile;
  const args = [];

  let argString;
  let argToken;
  let argValue;

  let state = STATE.INITIAL;
  for(let i = 0; i < strings.length; i++) {
    const s = strings[i];
    const v = values[i];

    for(let si = 0; si < s.length; si++) {
      const char = s[si];
      switch(state) {
        case STATE.INITIAL:
          if(char_is.whitespace(char))
            continue;
          else {
            state = STATE.CMD_NAME;
            cmdFile = char;
          }
          break;
        case STATE.CMD_NAME:
          if(char_is.nonwhitespace(char)){
            cmdFile += char;
            continue;
          }
          else {
            state = STATE.ARGS;
          }
          break;
        case STATE.ARGS:
          if(char_is.whitespace(char)) continue;
          else if(char === "'") {
            state = STATE.ARG_PARSE_STRING_SINGLE;
            argString = '';
          }
          else if(char === '"') {
            state = STATE.ARG_PARSE_STRING_DOUBLE;
            argString = '';
          }
          else {
            state = STATE.ARG_PARSE_TOKEN;
            argToken = char;
          }
          break;
        case STATE.ARG_PARSE_TOKEN:
            if(char_is.whitespace(char)) {
              args.push(argToken);
              state = STATE.ARGS;
            }
            else {
              argToken += char;
              continue;
            }
          break;
        case STATE.ARG_PARSE_VALUE:
          if(char_is.whitespace(char)) {
            state = STATE.ARGS;
            args.push(argValue);
          }
          else {
            argValue += char;
          }
          break;
        case STATE.ARG_PARSE_STRING_SINGLE: 
          if(char === "'") {
            state = STATE.ARGS;
            args.push(argString);
          }
          else {
            argString += char;
          }
        break;
        case STATE.ARG_PARSE_STRING_DOUBLE: 
          if(char === '"') {
            state = STATE.ARGS;
            args.push(argString);
          }
          else {
            argString += char;
          }
        break;
      }
    }

    // this is where the "[value]" would happen
    if(v) {
      switch(state) {
        case STATE.INITIAL:
          throw Error('CMD_NAME_ERROR')
        case STATE.CMD_NAME:
          throw Error('CMD_NAME_ERROR')
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
          argString += v.toString();
        case STATE.ARG_PARSE_STRING_DOUBLE: 
          argString += v.toString();
        break;
      }
    }
  }
  // this is where "EOF" would happen
  switch(state) {
    case STATE.INITIAL:
      throw Error('CMD_NAME_ERROR')
    case STATE.CMD_NAME:
      // aint no problem
      break
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
      throw Error('ARG_STRING_ERROR')
  }
  return {cmdFile, args};
}
function shell(strings, ...values) {
  const {cmdFile, args} = parseShellTemplate(strings, values);
  return new ShellProcess(cmdFile, args);
}

module.exports = {
  default: shell
}
