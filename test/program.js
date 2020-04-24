const args = process.argv.slice(2)

for(const arg of args) {
  process.stdout.write(arg)
}
