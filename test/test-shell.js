const tape = require('tape')
const fs = require('fs')

const {default:shell} = require('../src/index.js')

tape.onFinish(() => {
  fs.unlinkSync('tmp')
  fs.unlinkSync('tmp1.out')
  fs.unlinkSync('tmp2.out')
})

console.log('test')
tape('shell', async t => {

  await shell`echo -n hello`.redirect(fs.createWriteStream('tmp')).end();
  t.equal(fs.readFileSync('tmp', 'utf8'), "hello");

  await shell`yes`.pipe(shell`head -n 100`).redirect(fs.createWriteStream('tmp')).end();
  t.equal(fs.readFileSync('tmp', 'utf8').split('\n').length, 100) 

  await shell`echo -n "hello2"`.redirect(fs.createWriteStream('tmp')).end();
  t.equal(fs.readFileSync('tmp', 'utf8'), "hello2");

  await shell`echo -n 'hello3'`.redirect(fs.createWriteStream('tmp')).end();
  t.equal(fs.readFileSync('tmp', 'utf8'), "hello3");

  await shell`echo -n 'hello4"'`.redirect(fs.createWriteStream('tmp')).end();
  t.equal(fs.readFileSync('tmp', 'utf8'), "hello4\"");

  await shell`echo -n ${"a string"}  `.redirect(fs.createWriteStream('tmp')).end();
  t.equal(fs.readFileSync('tmp', 'utf8'), "a string");

  const d = {}
  d.toString = () => 'abc ; '
  await shell`echo -n ${d} ${4}`.redirect(fs.createWriteStream('tmp')).end();
  t.equal(fs.readFileSync('tmp', 'utf8'), "abc ;  4");


  await shell`echo -n "Hello World"`
    .pipe(shell`rev`)
    .redirect(fs.createWriteStream('tmp')).end();
  t.equal(fs.readFileSync('tmp', 'utf8'), "dlroW olleH");

  await shell`echo -n "billy"`
    .pipe(shell`rev`)
    .pipe(shell`tr a-z A-Z`)
    .redirect(fs.createWriteStream('tmp')).end();
  t.equal(fs.readFileSync('tmp', 'utf8'), "YLLIB");


  await shell`echo -n hello`.redirect('tmp1.out').end();
  t.equal(fs.readFileSync('tmp1.out', 'utf8'), "hello");
  await shell`echo -n hello`.append('tmp1.out').end();
  t.equal(fs.readFileSync('tmp1.out', 'utf8'), "hellohello");

  // redirect multiple times after same shell
  await shell`echo -n hi`
    .redirect('tmp1.out')
    .redirect('tmp2.out')
    .end()
  t.equal(fs.readFileSync('tmp1.out', 'utf8'), "hi");
  t.equal(fs.readFileSync('tmp2.out', 'utf8'), "hi");

  // redirect muliple times in-between pipes
  await shell`echo -n alex`
    .redirect('tmp1.out')
    .pipe(shell`rev`)
    .redirect('tmp2.out')
    .end()
  t.equal(fs.readFileSync('tmp1.out', 'utf8'), "alex");
  t.equal(fs.readFileSync('tmp2.out', 'utf8'), "xela");


  //re-use same stdin in different writes
  let stream = shell`echo -n mac-cheese`

  await Promise.all([
    stream.pipe(shell`rev`).redirect('tmp1.out').end(),
    stream.pipe(shell`tr a-z A-Z`).redirect('tmp2.out').end()
  ])

  t.equal(fs.readFileSync('tmp1.out', 'utf8'), "eseehc-cam");
  t.equal(fs.readFileSync('tmp2.out', 'utf8'), "MAC-CHEESE");

  //re-use same stdin in different writes, but wait inbetween
  stream = shell`echo -n doggo`

  //s1 = stream.pipe(shell`rev`).redirect('tmp1.out');
  //stream.pipe(shell`tr a-z A-Z`).append('tmp1.out');
  //await s1.end();
  //await s2.end();

  //t.equal(fs.readFileSync('tmp1.out', 'utf8'), "oggodDOGGO");

  // msc
  /*
  fs.writeFileSync("tmp1.out", "abcde", "utf8")
  fs.writeFileSync("tmp2.out", "vwxyz", "utf8")
  
  shell`echo "i am a"`
  shell`echo "i am b"`
  shell
    .stdin("tmp1.out")
    .stdin("tmp2.out")
    .pipe(shell`tr a-z A-Z`)*/
  t.end()
})
