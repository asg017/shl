#!/usr/bin/env node
const socket = require("socket.io-client")("https://openedcaptions.com");
socket.on("word", (data) => process.stdout.write(`${JSON.stringify(data)}\n`));
