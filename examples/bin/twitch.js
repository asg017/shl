#!/usr/bin/env node
const tmi = require("tmi.js");

const client = new tmi.Client({
  connection: {
    secure: true,
    reconnect: true,
  },
  channels: ["nickmercs"],
});

client.connect();

client.on("message", (channel, tags, message) => {
  process.stdout.write(`${JSON.stringify({ channel, tags, message })}\n`);
});
