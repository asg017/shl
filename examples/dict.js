const { shell } = require("../src");
shell`cat /usr/share/dict/words`
  .pipe(shell`grep "^Abe" `)
  .redirect(process.stdout);
