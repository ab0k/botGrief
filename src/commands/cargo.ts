import { EmbedBuilder, Message, Client, PermissionFlagsBits, GuildMember } from 'discord.js';
import supabase from '../utils/supabase';
import { Command } from '../types';

const ADMIN_ROLE_ID = process.env.ADMIN_ROLE_ID;
const VIP_ROLE_ID = process.env.VIP_ROLE_ID ?? process.env.PREMIUM_ROLE_ID;

type Action = 'add' | 'remove';
type CargoType = 'admin' | 'vip';

const command: Command = {
  name: 'cargo',
  aliases: ['role', 'setrole'],
  description: 'Dá ou remove cargos de admin/vip para usuários',

  async execute(message: Message, args: string[], _client: Client): Promise<void> {
    if (!message.member?.permissions.has(PermissionFlagsBits.Administrator)) {
      await message.reply({
        embeds: [new EmbedBuilder().setColor(0xff4444).setDescription('❌ Apenas administradores podem usar esse comando.')],
      });
      return;
    }

    const action = args[0]?.toLowerCase() as Action;
    const cargoArg = args[1]?.toLowerCase() as CargoType;
    const mention = message.mentions.members?.first();

    if (!action || !cargoArg || !mention) {
      await sendHelp(message);
      return;
    }

    if (!['add', 'remove'].includes(action)) {
      await sendHelp(message);
      return;
    }

    if (!['admin', 'vip'].includes(cargoArg)) {
      await sendHelp(message);
      return;
    }

    const roleId = cargoArg === 'admin' ? ADMIN_ROLE_ID : VIP_ROLE_ID;

    if (!roleId) {
      await message.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xff4444)
            .setDescription(`❌ \`${cargoArg === 'admin' ? 'ADMIN_ROLE_ID' : 'VIP_ROLE_ID'}\` não configurado no \`.env\`.`),
        ],
      });
      return;
    }

    const role = message.guild?.roles.cache.get(roleId);
    if (!role) {
      await message.reply({
        embeds: [new EmbedBuilder().setColor(0xff4444).setDescription('❌ Cargo não encontrado no servidor.')],
      });
      return;
    }

    try {
      if (action === 'add') {
        await mention.roles.add(roleId);
        await syncDatabase(mention, cargoArg, true);

        await message.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(0x7c5cfc)
              .setTitle(`✅ Cargo ${cargoArg === 'admin' ? '🛡️ Admin' : '✨ VIP'} concedido`)
              .setDescription(`<@${mention.id}> agora é **${cargoArg.toUpperCase()}** no servidor${cargoArg === 'vip' ? ' e no grief.cc' : ''}.`)
              .setThumbnail(mention.user.displayAvatarURL()),
          ],
        });
      } else {
        await mention.roles.remove(roleId);
        await syncDatabase(mention, cargoArg, false);

        await message.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(0x7c5cfc)
              .setTitle(`✅ Cargo ${cargoArg === 'admin' ? '🛡️ Admin' : '✨ VIP'} removido`)
              .setDescription(`<@${mention.id}> não é mais **${cargoArg.toUpperCase()}**.`)
              .setThumbnail(mention.user.displayAvatarURL()),
          ],
        });
      }
    } catch (err) {
      console.error('Erro ao modificar cargo:', err);
      await message.reply({
        embeds: [new EmbedBuilder().setColor(0xff4444).setDescription('❌ Erro ao modificar cargo. O bot tem permissão "Gerenciar cargos"?')],
      });
    }
  },
};

// Sincroniza com o banco do grief.cc
async function syncDatabase(member: GuildMember, cargo: CargoType, add: boolean): Promise<void> {
  if (cargo === 'vip') {
    await supabase
      .from('profiles')
      .update({ is_premium: add })
      .eq('discord_id', member.id);
  }
  // admin não tem coluna específica no banco — só no Discord
}

async function sendHelp(message: Message): Promise<void> {
  await message.reply({
    embeds: [
      new EmbedBuilder()
        .setColor(0x7c5cfc)
        .setTitle('🎭 Comandos de Cargo')
        .addFields(
          { name: '`!cargo add @usuario vip`', value: 'Dá o cargo VIP e ativa premium no grief.cc' },
          { name: '`!cargo remove @usuario vip`', value: 'Remove o cargo VIP e desativa premium' },
          { name: '`!cargo add @usuario admin`', value: 'Dá o cargo Admin no servidor' },
          { name: '`!cargo remove @usuario admin`', value: 'Remove o cargo Admin' }
        )
        .setFooter({ text: 'Apenas administradores podem usar esses comandos' }),
    ],
  });
}

export default command;
