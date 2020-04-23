const fs = require('fs')
const {command} = require('execa')

class ShellProcess {
  constructor(commandString) {
    this.commandString = commandString;
    this.process = command(commandString);
    this.pipes = [];
    this.redirected = false;
    this.appended = false;

    this.doneListeners = []
    this.done = (cb) => {
      this.doneListeners.push(cb);
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
  end() {
    return new Promise((resolve, reject) => {
      this.done(() => {
        resolve()
      });
    })
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
    shellProcess.process.on('exit', () => {
      if(length === this.pipes.length){
        for(const listener of this.doneListeners) {
          listener();
        }
      }
    })
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
    this.pipes[this.pipes.length-1].process.stdout.pipe(fs.createWriteStream(path, {flags:'a'}))
    return this;
  }

}

function shell(strings, ...values) {
  const s = strings.join('')
  const file = null;
  const args = [];
  const shellProcess = new ShellProcess(s);
  return shellProcess;
}

async function main() {

  shell`echo "Hello World!"`
    .pipe(shell`tr a-z A-Z`)
    .pipe(shell`rev`)
    .pipe(shell`tr A-Z a-z`)
    .pipe(shell`rev`)
    .redirect('a.out')

  await shell`cat b.in`
    .pipe(shell`tr a-z A-Z`)
    .pipe(shell`rev`)
    .redirect('b.out')
  .end()
  setTimeout(()=>
  shell`cat b.in`
    .pipe(shell`tr A-Z a-z`) // to lowercase
    .pipe(shell`rev`)        // reverse
    .append('b.out')
    ,500)
}
main()
