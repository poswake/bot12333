const express = require('express');
const config = require('./config');

// Create a simple Express server to keep the bot alive
const app = express();

// Set up a basic route
app.get('/', (req, res) => {
  res.send('Discord bot is running!');
});

// Start the server
function startServer() {
  app.listen(config.PORT, '0.0.0.0', () => {
    console.log(`Keep-alive server running on port ${config.PORT}`);
  });
}

module.exports = { startServer };
