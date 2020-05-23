const { shell } = require('../src')
// streams: https://stream.wikimedia.org/?spec
shell`curl -s  https://stream.wikimedia.org/v2/stream/recentchange`
  .pipe(shell`grep data`)
  .pipe(shell`sed 's/^data: //g'`)
  .redirect(process.stdout)
