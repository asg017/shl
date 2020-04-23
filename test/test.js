function shell() {

};

shell`echo "asdf"` // "echo", ["asdf"]
shell`echo "abc xyz"` // "echo", ["asdf xyz"]
shell`echo "abc xyz 123 "` // "echo", ["abc xyz 123"]
shell`echo "asdf" ${"string"}` // "echo", ["asdf"]
shell`echo "asdf" ${"string"}` // "echo", ["asdf"]
