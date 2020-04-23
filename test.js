//const {spawn} = require('child_process')
const fs = require('fs')
const {command} = require('execa')

class ShellProcess {
  constructor(commandString) {
    this.commandString = commandString;
    this.process = command(commandString);
    this.pipes = [];
    this.redirected = false;
    this.appended = false;
    this.done = false;
  }
  end() {
    return new Promise(resolve, reject) {
      this.done(() => {
        resolve();
      })
    }
  }
  _addToPipeline(shellProcess) {
    const length = this.pipes.push(shellProcess);
    if(length === 1) {
      this.process.stdout.pipe(shellProcess.process.stdin)
    }
    else {
      this.pipes[this.pipes.length - 2].process.stdout.pipe(shellProcess.process.stdin);
    }
  }
  pipe(shellProcess) {
    if (this.redirected) throw Error('Cant pipe once redirected');
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
    return this;
  }
  redirect(path) {
    if (this.redirected) throw Error('Can only redirect a shell once');
    if (this.appended) throw Error('Cant redirect when already appended');
    if(typeof path !== 'string') {
      throw Error('Can only redirect to a file, argument must be a string')
    }
    this.redirected = true;
    this.pipes[this.pipes.length-1].process.stdout.pipe(fs.createWriteStream(path))
    return this;
  }

  append(path) {
    if (this.redirected) throw Error('Cant append when already redirected');
    if (this.appended) throw Error('Can only append once');
    if(typeof path !== 'string') {
      throw Error('Can only append to a file, argument must be a string')
    }
    this.appended = true;
    this.pipes[this.pipes.length-1].process.stdout.pipe(fs.createWriteStream(path), {flags:'a'})
    return this;
  }

}

function shell(strings, ...valaues) {
  const s = strings.join('')
  const shellProcess = new ShellProcess(s);
  return shellProcess;
}

shell`echo "Hello World!"`
  .pipe(shell`tr a-z A-Z`)
  .pipe(shell`rev`)
  .pipe(shell`tr A-Z a-z`)
  .pipe(shell`rev`)
  .redirect('a.out')

shell`cat b.in`
  .pipe(shell`tr a-z A-Z`)
  .pipe(shell`rev`)
  .pipe(shell`tr A-Z a-z`)
  .pipe(shell`rev`)
  .redirect('b.out')

shell`cat b.in`
  .pipe(shell`tr a-z A-Z`)
  .pipe(shell`rev`)
  .pipe(shell`tr A-Z a-z`)
  .pipe(shell`rev`)
  .append('b.out')
//const s = fs.createReadStream(process.stdin);
