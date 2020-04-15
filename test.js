//const {spawn} = require('child_process')
const fs = require('fs')
const {command} = require('execa')

function shell(strings, ...valaues) {
  const pipes = [];
  let redirected = false;
  let appended = false;
  
  const s = strings.join('')
  const p = command(s)
  //p.stdout.pipe(process.stdout)
  return {
    stdin: p.stdin,
    stdout: p.stdout,
    pipes,
    redirected,
    pipe(shell) {
      if (redirected) throw Error('Cant pipe once redirected');
      if (redirected) throw Error('Cant pipe once appended');

      const length = pipes.push(shell);

      if(length === 1) {
        p.stdout.pipe(shell.stdin)
      }
      else {
        pipes[pipes.length - 2].stdout.pipe(shell.stdin);
      }
      return this;
    },
    redirect(path) {
      if (redirected) throw Error('Can only redirect a shell once');
      redirected = true;
      pipes[pipes.length-1].stdout.pipe(fs.createWriteStream(path))
      return this;
    },
    /*j
    append() {
      if (redirected) throw Error('Cant append when already redirected');
      if (appended) throw Error('Can only append once');
      appended = true;
      return this;
    }
    */
  };
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

//const s = fs.createReadStream(process.stdin);
