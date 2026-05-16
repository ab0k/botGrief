import dotenv from 'dotenv';
dotenv.config({ path: '.env' });
dotenv.config({ path: '.env.local', override: true });
import { Client, Collection, EmbedBuilder, GatewayIntentBits, Message } from 'discord.js';
import fs from 'fs';
import path from 'path';
import { Command } from './types';

const PREFIX = '!';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
});

const commands = new Collection<string, Command>();

const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(f => f.endsWith('.ts') || f.endsWith('.js'));

for (const file of commandFiles) {
  const command: Command = require(path.join(commandsPath, file)).default;
  commands.set(command.name, command);
  command.aliases?.forEach(alias => commands.set(alias, command));
}

client.once('clientReady', () => {
  console.log(`✅ Bot online como ${client.user!.tag}`);
  client.user!.setActivity('grief.cc', { type: 3 });
});

client.on('messageCreate', async (message: Message) => {
  if (message.author.bot) return;
  if (!message.content.startsWith(PREFIX)) return;

  const args = message.content.slice(PREFIX.length).trim().split(/\s+/);
  const commandName = args.shift()!.toLowerCase();

  const command = commands.get(commandName);
  if (!command) return;

  try {
    await command.execute(message, args, client);
  } catch (error) {
    console.error(`Erro no comando ${commandName}:`, error);
    const embed = new EmbedBuilder()
      .setColor(0xff4444)
      .setDescription('❌ Ocorreu um erro ao executar esse comando.');
    message.reply({ embeds: [embed] });
  }
});

client.login(process.env.DISCORD_TOKEN);
