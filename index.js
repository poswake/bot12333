const { Client, Collection, GatewayIntentBits, Partials, REST, Routes, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const config = require('./config');
const { startServer } = require('./keep-alive');
const milestones = require('./utils/milestones');

// Create a new Discord client with necessary intents
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ],
  partials: [
    Partials.Channel,
    Partials.Message,
    Partials.User,
    Partials.GuildMember
  ]
});

// Collection to store commands
client.commands = new Collection();
const commands = [];

// Load commands from commands directory
const commandFiles = fs.readdirSync(path.join(__dirname, 'commands'))
  .filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
  const command = require(path.join(__dirname, 'commands', file));
  // Add to the Collection for interaction handling
  client.commands.set(command.data.name, command);
  // Add to the array for registration with the API
  commands.push(command.data.toJSON());
  console.log(`Loaded command: ${command.data.name}`);
}

// Function to register slash commands with Discord API
async function registerCommands() {
  try {
    console.log('Started refreshing application (/) commands.');
    
    const rest = new REST({ version: '10' }).setToken(config.TOKEN);
    
    // Register global commands (available in all guilds)
    await rest.put(
      Routes.applicationCommands(client.user.id),
      { body: commands },
    );
    
    console.log('Successfully reloaded application (/) commands.');
  } catch (error) {
    console.error('Error refreshing application commands:', error);
  }
}

// Ready event handler
client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}`);
  
  // Set activity to "Watching Pathfinders"
  client.user.setActivity(config.ACTIVITY, { type: 3 }); // Type 3 is WATCHING
  
  // Register slash commands
  await registerCommands();
  
  // Log bot invite URL for convenience (now including applications.commands scope)
  console.log(`Invite URL: https://discord.com/oauth2/authorize?client_id=${client.user.id}&scope=bot%20applications.commands&permissions=274878024704`);
});

// Interaction event handler for all types of interactions
client.on('interactionCreate', async interaction => {
  try {
    // Handle slash commands
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) return;

      try {
        // Execute the command
        await command.execute(interaction);
      } catch (error) {
        console.error(`Error executing command ${interaction.commandName}:`, error);
        // If we already replied, use followUp; otherwise reply
        const replyMethod = interaction.replied || interaction.deferred ? 'followUp' : 'reply';
        interaction[replyMethod]({ 
          content: 'There was an error trying to execute that command!', 
          ephemeral: true 
        }).catch(console.error);
      }
    } 
    // Handle button interactions
    else if (interaction.isButton()) {
      // Check if it's an attendance button
      if (interaction.customId.startsWith('attend_')) {
        await handleAttendanceButton(interaction);
      }
      // Check if it's the view milestones button
      else if (interaction.customId === 'view_milestones') {
        await handleViewMilestonesButton(interaction);
      }
    }
  } catch (error) {
    console.error('Error handling interaction:', error);
  }
});

// Function to handle attendance button clicks
async function handleAttendanceButton(interaction) {
  try {
    // Extract the event ID from the custom ID (format: attend_eventId)
    const eventId = interaction.customId.split('_')[1];
    
    // Load the schedule data
    const scheduleFilePath = path.join(__dirname, 'schedule.json');
    let scheduleData = [];
    
    if (fs.existsSync(scheduleFilePath)) {
      const fileContent = fs.readFileSync(scheduleFilePath, 'utf8');
      scheduleData = JSON.parse(fileContent);
    } else {
      return interaction.reply({ 
        content: 'Could not find the schedule data.', 
        ephemeral: true 
      });
    }
    
    // Find the event
    const eventIndex = scheduleData.findIndex(event => event.id === eventId);
    if (eventIndex === -1) {
      return interaction.reply({ 
        content: 'This event no longer exists.', 
        ephemeral: true 
      });
    }
    
    const event = scheduleData[eventIndex];
    
    // Initialize attendees array if it doesn't exist (for backwards compatibility)
    if (!event.attendees) {
      event.attendees = [];
    }
    
    // Check if user is already attending
    const userId = interaction.user.id;
    const isAttending = event.attendees.includes(userId);
    
    // Toggle attendance
    if (isAttending) {
      // Remove user from attendees
      event.attendees = event.attendees.filter(id => id !== userId);
      await interaction.reply({ 
        content: `You are no longer attending the ${event.type} event scheduled for ${event.date} at ${event.time}.`, 
        ephemeral: true 
      });
    } else {
      // Add user to attendees
      event.attendees.push(userId);
      await interaction.reply({ 
        content: `You are now attending the ${event.type} event scheduled for ${event.date} at ${event.time}!`, 
        ephemeral: true 
      });
    }
    
    // Update the schedule file
    fs.writeFileSync(scheduleFilePath, JSON.stringify(scheduleData, null, 2), 'utf8');
    
    // Send attendance notification to the designated channel
    try {
      // Get the guild from the interaction
      const guild = interaction.guild;
      
      // Look for the attendance channel
      let attendanceChannel;
      const channelId = config.ATTENDANCE_CHANNEL_ID;
      
      // Try to get the channel by ID first
      if (channelId.match(/^\d+$/)) {
        attendanceChannel = await guild.channels.fetch(channelId).catch(() => null);
      }
      
      // If that fails, try to find by name
      if (!attendanceChannel) {
        attendanceChannel = guild.channels.cache.find(channel => 
          channel.name === channelId && channel.type === 0 // Type 0 = text channel
        );
      }
      
      // If we found a channel, send the notification
      if (attendanceChannel) {
        // Prepare the attendance message
        const userName = interaction.user.username;
        const eventType = event.type;
        const eventDate = event.date;
        const eventTime = event.time;
        
        // Get the Discord timestamp for the event
        const timestamp = Math.floor(event.timestamp / 1000);
        const shortTimestamp = `<t:${timestamp}:f>`; // Short date and time format
        
        // Create a more human-readable message based on whether they're attending or not
        const messageContent = isAttending
          ? `🔴 **${userName}** has canceled their attendance for the **${eventType}** event on ${shortTimestamp}.`
          : `🟢 **${userName}** will be attending the **${eventType}** event on ${shortTimestamp}!`;
        
        // Send the notification
        await attendanceChannel.send(messageContent);
      }
    } catch (error) {
      console.error('Error sending attendance notification:', error);
      // We don't want to fail the whole interaction if just the notification fails
    }
  } catch (error) {
    console.error('Error handling attendance button:', error);
    await interaction.reply({ 
      content: 'There was an error processing your attendance. Please try again later.', 
      ephemeral: true 
    }).catch(console.error);
  }
}

// Function to handle view milestones button clicks
async function handleViewMilestonesButton(interaction) {
  try {
    // Get all milestones
    const allMilestones = milestones.getAllMilestones();
    
    // Create an embed to display all milestones
    const embed = new EmbedBuilder()
      .setColor('#9C59B6') // Purple color
      .setTitle('📊 Point Milestones')
      .setDescription('All available rank milestones in the system.')
      .setTimestamp();
    
    // Add fields for each milestone
    for (const milestone of allMilestones) {
      const nextThreshold = milestone.next?.threshold || "Max Rank";
      
      embed.addFields({
        name: `${milestone.emoji} ${milestone.name} (${milestone.threshold} - ${nextThreshold} Points)`,
        value: milestone.description || "Earn points by participating in events and contributing to the community."
      });
    }
    
    // Add footer with user info
    embed.setFooter({ 
      text: `Requested by ${interaction.user.username}`, 
      iconURL: interaction.user.displayAvatarURL() 
    });
    
    // Reply with the embed
    await interaction.reply({ 
      embeds: [embed], 
      ephemeral: true 
    });
  } catch (error) {
    console.error('Error handling view milestones button:', error);
    await interaction.reply({ 
      content: 'There was an error loading the milestones. Please try again later.', 
      ephemeral: true 
    }).catch(console.error);
  }
}

// Enhanced error handling and reconnection
client.on('error', error => {
  console.error('Discord client error:', error);
  console.log('Attempting to reconnect...');
});

client.on('disconnect', (event) => {
  console.log(`Bot disconnected with code ${event.code}.`);
  console.log('Attempting to reconnect...');
  client.login(config.TOKEN).catch(err => {
    console.error('Failed to reconnect:', err);
    // Wait a moment before trying again
    setTimeout(() => {
      console.log('Retrying connection...');
      client.login(config.TOKEN);
    }, 10000); // 10 seconds delay
  });
});

client.on('reconnecting', () => {
  console.log('Bot is reconnecting...');
});

process.on('unhandledRejection', error => {
  console.error('Unhandled promise rejection:', error);
});

process.on('uncaughtException', error => {
  console.error('Uncaught exception:', error);
  // Keep the process alive even after an uncaught exception
  console.log('Process will continue running despite the error');
});

// Start the keep-alive server
startServer();

// Login to Discord with the bot token
client.login(config.TOKEN).catch(error => {
  console.error('Failed to log in to Discord:', error);
  process.exit(1);
});
