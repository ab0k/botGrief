import { EmbedBuilder, Message, Client } from 'discord.js';
import supabase from '../utils/supabase';
import { Command, Profile } from '../types';

const command: Command = {
  name: 'perfil',
  aliases: ['p', 'profile'],
  description: 'Mostra o perfil grief.cc de um usuário',

  async execute(message: Message, args: string[], _client: Client): Promise<void> {
    let profile: Profile | null = null;

    if (args[0]) {
      const username = args[0].replace(/^@/, '').toLowerCase();
      const { data } = await supabase
        .from('profiles')
        .select('id, username, display_name, bio, avatar_url, view_count, is_premium, discord_id, created_at')
        .eq('username', username)
        .single();
      profile = data;
    } else {
      const { data } = await supabase
        .from('profiles')
        .select('id, username, display_name, bio, avatar_url, view_count, is_premium, discord_id, created_at')
        .eq('discord_id', message.author.id)
        .single();
      profile = data;
    }

    if (!profile) {
      const embed = new EmbedBuilder()
        .setColor(0x7c5cfc)
        .setDescription(
          args[0]
            ? `❌ Nenhum perfil encontrado com o username **${args[0]}**.`
            : '❌ Você não tem um perfil grief.cc vinculado ao seu Discord.\nAcesse **grief.cc** e faça login com Discord para vincular.'
        );
      await message.reply({ embeds: [embed] });
      return;
    }

    const premiumBadge = profile.is_premium ? '✨ ' : '';
    const memberSince = new Date(profile.created_at).toLocaleDateString('pt-BR');

    const embed = new EmbedBuilder()
      .setColor(profile.is_premium ? 0xf857a6 : 0x7c5cfc)
      .setTitle(`${premiumBadge}${profile.display_name ?? profile.username}`)
      .setURL(`https://grief.cc/${profile.username}`)
      .setDescription(profile.bio ?? '*Sem bio*')
      .addFields(
        { name: '🔗 Link', value: `[grief.cc/${profile.username}](https://grief.cc/${profile.username})`, inline: true },
        { name: '👁️ Visitas', value: (profile.view_count ?? 0).toLocaleString('pt-BR'), inline: true },
        { name: '📅 Membro desde', value: memberSince, inline: true }
      )
      .setFooter({ text: 'grief.cc' });

    if (profile.avatar_url) embed.setThumbnail(profile.avatar_url);

    await message.reply({ embeds: [embed] });
  },
};

export default command;
