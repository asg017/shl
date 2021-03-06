const tape = require("tape");
const fs = require("fs");

const { shell } = require("../src/index.js");

tape.onFinish(() => {
  fs.unlinkSync("tmp");
  fs.unlinkSync("tmp1.out");
  fs.unlinkSync("tmp2.out");
});

tape("shell", async (t) => {
  await shell`echo -n hello`.redirect(fs.createWriteStream("tmp")).end();
  t.equal(fs.readFileSync("tmp", "utf8"), "hello");

  await shell`echo -n "hello2"`.redirect(fs.createWriteStream("tmp")).end();
  t.equal(fs.readFileSync("tmp", "utf8"), "hello2");

  await shell`echo -n 'hello3'`.redirect(fs.createWriteStream("tmp")).end();
  t.equal(fs.readFileSync("tmp", "utf8"), "hello3");

  await shell`echo -n 'hello4"'`.redirect(fs.createWriteStream("tmp")).end();
  t.equal(fs.readFileSync("tmp", "utf8"), 'hello4"');

  await shell`echo -n ${"a string"}  `
    .redirect(fs.createWriteStream("tmp"))
    .end();
  t.equal(fs.readFileSync("tmp", "utf8"), "a string");

  const d = {};
  d.toString = () => "abc ; ";
  await shell`echo -n ${d} ${4}`.redirect(fs.createWriteStream("tmp")).end();
  t.equal(fs.readFileSync("tmp", "utf8"), "abc ;  4");

  await shell`echo -n "Hello World"`
    .pipe(shell`rev`)
    .redirect(fs.createWriteStream("tmp"))
    .end();
  t.equal(fs.readFileSync("tmp", "utf8").trim(), "dlroW olleH");

  await shell`echo -n "billy"`
    .pipe(shell`rev`)
    .pipe(shell`tr a-z A-Z`)
    .redirect(fs.createWriteStream("tmp"))
    .end();
  t.equal(fs.readFileSync("tmp", "utf8").trim(), "YLLIB");

  await shell`echo -n hello`.redirect("tmp1.out").end();
  t.equal(fs.readFileSync("tmp1.out", "utf8"), "hello");
  await shell`echo -n hello`.append("tmp1.out").end();
  t.equal(fs.readFileSync("tmp1.out", "utf8"), "hellohello");

  // redirect multiple times after same shell
  await shell`echo -n hi`.redirect("tmp1.out").redirect("tmp2.out").end();
  t.equal(fs.readFileSync("tmp1.out", "utf8"), "hi");
  t.equal(fs.readFileSync("tmp2.out", "utf8"), "hi");

  // redirect muliple times in-between pipes
  await shell`echo -n alex`
    .redirect("tmp1.out")
    .pipe(shell`rev`)
    .redirect("tmp2.out")
    .end();
  t.equal(fs.readFileSync("tmp1.out", "utf8"), "alex");
  t.equal(fs.readFileSync("tmp2.out", "utf8").trim(), "xela");

  //re-use same stdin in different writes
  let stream = shell`echo -n mac-cheese`;

  await Promise.all([
    stream
      .pipe(shell`rev`)
      .redirect("tmp1.out")
      .end(),
    stream
      .pipe(shell`tr a-z A-Z`)
      .redirect("tmp2.out")
      .end(),
  ]);

  t.equal(fs.readFileSync("tmp1.out", "utf8").trim(), "eseehc-cam");
  t.equal(fs.readFileSync("tmp2.out", "utf8"), "MAC-CHEESE");

  t.end();
});
