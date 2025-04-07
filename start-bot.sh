#!/bin/bash

# This script ensures the bot restarts if it crashes
# It creates an infinite loop that keeps restarting the bot if it exits

while true; do
  echo "Starting Discord bot..."
  npm install discord.js express
  node index.js
  
  # If the bot crashes, we'll get here
  echo "Bot crashed or exited. Restarting in 5 seconds..."
  sleep 5
done