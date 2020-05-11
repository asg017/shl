#!/bin/bash
curl -s  https://stream.wikimedia.org/v2/stream/recentchange |
  grep data |
  sed 's/^data: //g'
