// Configuration settings for the Discord bot
module.exports = {
  // Discord bot token - must be set as an environment variable
  TOKEN: process.env.DISCORD_BOT_TOKEN,
  
  // ID of the agent role that can manage points
  // This needs to be set to a valid role ID in your Discord server
  AGENT_ROLE_ID: process.env.AGENT_ROLE_ID || '1348381075151523940', // Agent role ID
  
  // Channel ID for event attendance notifications
  // Uses environment variable if set, otherwise defaults to general channel
  ATTENDANCE_CHANNEL_ID: process.env.ATTENDANCE_CHANNEL_ID || '1354445995777327226', // Channel ID for attendance notifications
  
  // Path to the database file
  DATABASE_PATH: './data.json',
  
  // Path to the schedule file
  SCHEDULE_PATH: './schedule.json',
  
  // Bot activity status
  ACTIVITY: 'Pathfinders',
  
  // Port for the keep-alive server
  PORT: process.env.PORT || 8000
};
