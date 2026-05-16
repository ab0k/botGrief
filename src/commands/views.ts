import { EmbedBuilder, Message, Client } from 'discord.js';
import supabase from '../utils/supabase';
import { Command, Profile, ProfileView } from '../types';

const command: Command = {
  name: 'views',
  aliases: ['visitas', 'stats'],
  description: 'Mostra estatísticas de visitas do grief.cc',

  async execute(message: Message, args: string[], _client: Client): Promise<void> {
    let profile: Pick<Profile, 'id' | 'username' | 'display_name' | 'view_count' | 'is_premium'> | null = null;

    if (args[0]) {
      const { data } = await supabase
        .from('profiles')
        .select('id, username, display_name, view_count, is_premium')
        .eq('username', args[0].toLowerCase())
        .single();
      profile = data;
    } else {
      const { data } = await supabase
        .from('profiles')
        .select('id, username, display_name, view_count, is_premium')
        .eq('discord_id', message.author.id)
        .single();
      profile = data;
    }

    if (!profile) {
      const embed = new EmbedBuilder()
        .setColor(0x7c5cfc)
        .setDescription(
          args[0]
            ? `❌ Perfil **${args[0]}** não encontrado.`
            : '❌ Vincule seu Discord ao grief.cc primeiro em **grief.cc/login**.'
        );
      await message.reply({ embeds: [embed] });
      return;
    }

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: viewRows } = await supabase
      .from('profile_views')
      .select('viewed_at')
      .eq('profile_id', profile.id)
      .gte('viewed_at', thirtyDaysAgo.toISOString());

    const rows = (viewRows ?? []) as Pick<ProfileView, 'viewed_at'>[];

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - 7);

    let today = 0;
    let thisWeek = 0;
    const thisMonth = rows.length;

    for (const row of rows) {
      const d = new Date(row.viewed_at);
      if (d >= todayStart) today++;
      if (d >= weekStart) thisWeek++;
    }

    const embed = new EmbedBuilder()
      .setColor(profile.is_premium ? 0xf857a6 : 0x7c5cfc)
      .setTitle(`📊 Visitas de ${profile.display_name ?? profile.username}`)
      .setURL(`https://grief.cc/${profile.username}`)
      .addFields(
        { name: '📅 Hoje', value: `**${today.toLocaleString('pt-BR')}**`, inline: true },
        { name: '📆 Esta semana', value: `**${thisWeek.toLocaleString('pt-BR')}**`, inline: true },
        { name: '🗓️ Últimos 30 dias', value: `**${thisMonth.toLocaleString('pt-BR')}**`, inline: true },
        { name: '👁️ Total', value: `**${(profile.view_count ?? 0).toLocaleString('pt-BR')}**`, inline: true }
      )
      .setFooter({ text: `grief.cc/${profile.username}` });

    await message.reply({ embeds: [embed] });
  },
};

export default command;
