# shl

A JavaScript tagged template literal for shell commands.

## Installing

Not on NPM yet, still developing. Watch the repo for updates.

## Examples

More can be found in `/examples`.

Get lines in a file that match a regex pattern.

```javascript
shell`cat /usr/share/dict/words`
  .pipe(shell`grep "^Abe" `)
  .redirect(process.stdout);
// Abe
// Abe's
// Abel
// ...
```

Get a live ndjson-separated stream of wikipedia edits.

```javascript
const wiki = shell`curl -s  https://stream.wikimedia.org/v2/stream/recentchange`
  .pipe(shell`grep data`)
  .pipe(shell`sed 's/^data: //g'`);

// only edits made by non-bots
wiki.pipe(shell`ndjson-filter "!d.bot"`).redirect("non-bots.ndjson");

// only english wikipedia edits
wiki
  .pipe(shell`ndjson-filter "d.meta.domain === 'en.wikipedia.org'"`)
  .redirect("english-wiki.ndjson");
```

## Why tho

I'm working on some other projects where I want a easy-to-use and somewhat-safe way to spawn child proceses in a bash-like way in JavaScript, with the ability to parameterize commands and pipe commands together. Other solutions were either too verbose, very unsafe, or didn't pipe at all.

Of course, the idea of "parametrized shell commands" may scare the crap out of you, and doing it with JavaScript is even weirder, but it works!

## API Reference

### shl **\`string\`**

Create a new pipeline and execute the given command, spawning a new process. See "Syntax" for legal syntax.

```javascript
shell`python script.py arg1 "this is an argument" 'another one'`;
```

will execute the `python` executable, with arguments `["scripy.py", "arg1", "this is an argument", "another one"]`. Internally, `shl` will call [`child_process.spawn()`](https://nodejs.org/api/child_process.html#child_process_child_process_spawn_file_args_options_callback) to create the process.

Returns a new pipeline that ony contains the executed process.

### pipeline.**pipe**(destination)

Pipe the output (stdout) of a shl process into destination, where destination is another `shl` pipeline.

### pipeline.**redirect**(destination)

Redirect the output of the last process in the pipeline into a file or writable stream. The only parameter destination can either be a string (the path of a file to write to) or a writeable stream (e.g. `fs.createWriteStream`). Similar to redirection in bash, like `echo hi > file.txt`.

### pipeline.**append**(destination)

Append the output of the last process in the pipeline to a file. The parameter destination must be a string (the path of a file to write to). Similar to appending in bash, like `echo hi >> file.txt`.

### pipeline.**end**()

Returns a promise that resolves when the pipeline completes. A pipeline completes when the last process exits sucessfully (and when all `.redirect()` and `.append()` writing finishes). The promise will reject if any process in the pipeline fails, or if a `.redirect` or `.append` fails.

## `shl` Syntax

Every invocation of the `shl` tagged template literal must follow the following rules.

The first word in the tagged template is the command that will be ran. This is required. It cannot be a template expression, it must be defined (to limit the scope of a remote execution attack).

```javascript
shell`ls`; // legal
shell` `; // illegal, no command given
shell`${"grep"}`; // illegal, command cannot be an expression (no "${}")
```

After the command, there can be optional whitespace-delimited arguments. Spaces in arguments can be escaped with double quotes or single quotes. For example:

```javascript
shell`ls my_dir`;
shell`python my_script.py arg1 "argument 2" 'another argument!'`;
```

If a quoted argument does not have a closing quote, an error is thrown.

Template expressions are allowed as their own argument, but they must be separate from other arguments (ie, there's no string concatenation on expressions).

```javascript
const name = "Alex";
shell`echo Hello ${name}`; // legal
shell`echo "Hello ${name}"`; // illegal, since the expression exists in a quoted argument.
shell`echo Hello${name}`; // illegal, must be whitespace around expression
```

If you want string concatenation with a argument and an expression, add the argument in an expression. For example:

```javascript
shell`echo ${`Hello, ${name}`}`;
```

Of course, be careful of any security implications in these types of arguments (more below).

## Security concerns

User-input with shell commands is scary, but it's much easier to do it safely with `shl` than with `bash` or other interpreters. For example, say you had this with bash:

```javascript
const name = "Alex";
exec(`echo "Hello, ${name}"`, { shell: "/bin/bash" });
```

When this executes, the command `echo "Hello, Alex"` is interpreted and executed by bash, printing out `"Hello, Alex"` to stdout.

But what if the `name` variable contains user-inputted data? Say the input was `"; rm -rf /data;"`. This would be executed:

 ```bash
 echo "Hello, "; rm -rf /data;""
 ``` 
 
 This echos the string `"Hello, "` then arbitrarily delete files in `/data` with no warning.

That's bad! And this has happened in several remote-execution attacks on many systems for years. What does `shl` do to help avoid this?

### 1. Only 1 process per invocation

One problem with the vulnerability above is that bash can execute several processes with one invocation (`echo` and `rm` in the example above). `shl` only allows one executed process per invocation, which is limiting, but a little safer.

So this:

```javascript
const name = "; rm -rf /data"
shell`echo "Hello," ${name}`;
```

would execute `echo` with arguments `["Hello,", "; rm -rf /data"]`, which executes a process that echoes the string:
```"
Hello, ; rm -rf /data"
```
 to stdout. No other processes would be executed, just that one `echo` command and no `rm` action is taken.

### 2. Each invocation requires named script

`shl` also requires that the executable file to be defined and not arbitrary. So ``shell`${scriptName} args`` is not allowed, since the first non-whitespace word is an arbitrary value. ``shell`ls ${variable} `` would be allowed, since the script name is defined (`ls`).

### `shl` isn't magical, though

This type of `shl` usage is dangerous:

```javascript
const name = request.query.name;
const script = `echo 'Hello, ${name}'`
shell`bash -c ${script}`;
```

Hee, `bash` will be executed, with arguments `["-c", "echo 'Hello, Alex'"]`. If `name` is user defined, they could perform a similar attack like above. Arguments to a script could still be dangerous and cause a vulnerability, so use expression wisely.

## Compared to Bash

`shl` syntax is different than `bash`, but many bash features (redirecting, appending, process substitution, etc.) is still possible. Here's a quick cheatsheat on common recipies for both `shl` and `bash`.

### Supported

Call a command

```bash
echo "hello"`
```

```javascript
shell`echo "hello"`;
```

Redirect stdout of a command into a file.
```bash
echo "hello" > a.txt
```

```javascript
shell`echo "hello"`
  .redirect("a.txt")
```

Append stdout of a command into a file.
```bash
echo "hello" >> a.txt
```

```javascript
shell`echo "hello"`
  .append("a.txt")
```

Pipe a series of commands together.

```bash
echo "hello" | rev | tr a-z A-Z
```

```javascript
shell`echo "hello"`
  .pipe(shell`rev`)
  .pipe(shell`tr a-z A-Z`);
```

Use a variable.

```bash
t="Hello"
echo $t
```

```javascript
const t = "Hello";
shell`echo ${t}`;
```

### Not supported

### Environment variables 

In bash, env var usage looks like:

```bash
echo "Hello $NAME"
```

There's no direct equivalent in `shl`. You could use node's for this, however:

```javascript
shell`echo "Hello" ${process.env.NAME}`
```

### Tilde Expansion

In bash (and other shell intepretors) you can use the tilde symbol `~` for an alias of `$HOME`, the home directory. That's not built inside of `shl`, however. I welcome any PR's! 

### Redirect file to stdin

In bash, you can use `<` to use a file as stdin for a process. That's not built into `shl` yet.
```bash
grep "pattern" < infile.txt
```

## TODO
- [ ] Tilde expansion
- [ ] Process Substition
- [ ] ShellPipelines should be read/write streams
- [ ] You should be able to pass in read/qrite/transform steams in `.pipe()`
- [ ] You should be able to pass in write stream in `.redirect()` and `.append()`
