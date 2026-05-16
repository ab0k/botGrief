import { EmbedBuilder, Message, Client } from 'discord.js';
import supabase from '../utils/supabase';
import { Command, Profile, ProfileView } from '../types';

const MEDALS = ['🥇', '🥈', '🥉'];

type RankingFilter = 'hoje' | 'semana' | 'tudo';

const command: Command = {
  name: 'ranking',
  aliases: ['rank', 'top'],
  description: 'Mostra o ranking de perfis mais visitados do grief.cc',

  async execute(message: Message, args: string[], _client: Client): Promise<void> {
    const filter = (args[0] ?? 'tudo').toLowerCase() as RankingFilter;
    const validFilters: RankingFilter[] = ['hoje', 'semana', 'tudo'];

    if (!validFilters.includes(filter)) {
      await message.reply({
        embeds: [new EmbedBuilder().setColor(0x7c5cfc).setDescription('❌ Uso: `!ranking [hoje|semana|tudo]`')],
      });
      return;
    }

    if (filter === 'hoje' || filter === 'semana') {
      await rankingByPeriod(message, filter);
      return;
    }

    const { data: profiles } = await supabase
      .from('profiles')
      .select('username, display_name, view_count, is_premium')
      .order('view_count', { ascending: false })
      .limit(10);

    if (!profiles || profiles.length === 0) {
      await message.reply({ embeds: [new EmbedBuilder().setColor(0x7c5cfc).setDescription('📭 Nenhum perfil encontrado.')] });
      return;
    }

    const lines = (profiles as Pick<Profile, 'username' | 'display_name' | 'view_count' | 'is_premium'>[]).map((p, i) => {
      const medal = MEDALS[i] ?? `**${i + 1}.**`;
      const premium = p.is_premium ? ' ✨' : '';
      return `${medal} [${p.display_name ?? p.username}](https://grief.cc/${p.username})${premium} — **${(p.view_count ?? 0).toLocaleString('pt-BR')}** visitas`;
    });

    const embed = new EmbedBuilder()
      .setColor(0x7c5cfc)
      .setTitle('🏆 Ranking grief.cc — Geral')
      .setURL('https://grief.cc/ranking')
      .setDescription(lines.join('\n'))
      .setFooter({ text: 'grief.cc/ranking • Use !ranking hoje ou !ranking semana' });

    await message.reply({ embeds: [embed] });
  },
};

async function rankingByPeriod(message: Message, filter: 'hoje' | 'semana'): Promise<void> {
  const days = filter === 'hoje' ? 1 : 7;
  const since = new Date();
  since.setDate(since.getDate() - days);

  const { data: viewData } = await supabase
    .from('profile_views')
    .select('profile_id')
    .gte('viewed_at', since.toISOString());

  const rows = (viewData ?? []) as Pick<ProfileView, 'profile_id'>[];

  if (rows.length === 0) {
    await message.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0x7c5cfc)
          .setDescription(`📭 Nenhuma visita registrada ${filter === 'hoje' ? 'hoje' : 'essa semana'}.`),
      ],
    });
    return;
  }

  const counts: Record<string, number> = {};
  for (const row of rows) {
    counts[row.profile_id] = (counts[row.profile_id] ?? 0) + 1;
  }

  const sorted = Object.entries(counts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10);

  const ids = sorted.map(([id]) => id);

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, username, display_name, is_premium')
    .in('id', ids);

  if (!profiles) {
    await message.reply({ embeds: [new EmbedBuilder().setColor(0xff4444).setDescription('❌ Erro ao buscar perfis.')] });
    return;
  }

  const profileMap = new Map((profiles as Pick<Profile, 'id' | 'username' | 'display_name' | 'is_premium'>[]).map(p => [p.id, p]));

  const lines = sorted
    .map(([id, count], i) => {
      const p = profileMap.get(id);
      if (!p) return null;
      const medal = MEDALS[i] ?? `**${i + 1}.**`;
      const premium = p.is_premium ? ' ✨' : '';
      return `${medal} [${p.display_name ?? p.username}](https://grief.cc/${p.username})${premium} — **${count}** visitas`;
    })
    .filter((l): l is string => l !== null);

  const label = filter === 'hoje' ? 'Hoje' : 'Esta Semana';

  const embed = new EmbedBuilder()
    .setColor(0x7c5cfc)
    .setTitle(`🏆 Ranking grief.cc — ${label}`)
    .setURL('https://grief.cc/ranking')
    .setDescription(lines.join('\n') || 'Sem dados.')
    .setFooter({ text: 'grief.cc/ranking' });

  await message.reply({ embeds: [embed] });
}

export default command;
