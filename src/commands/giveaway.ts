import { EmbedBuilder, Message, Client, PermissionFlagsBits } from 'discord.js';
import supabase from '../utils/supabase';
import { Command, Giveaway, GiveawayEntry } from '../types';

type Sub = 'criar' | 'participar' | 'encerrar' | 'lista' | 'ajuda';

const command: Command = {
  name: 'giveaway',
  aliases: ['sorteio', 'gw'],
  description: 'Gerencia sorteios do grief.cc via Discord',

  async execute(message: Message, args: string[], _client: Client): Promise<void> {
    const sub = (args[0] ?? 'ajuda').toLowerCase() as Sub;

    switch (sub) {
      case 'criar':     return criarGiveaway(message, args.slice(1));
      case 'encerrar':  return encerrarGiveaway(message, args.slice(1));
      case 'lista':     return listarGiveaways(message);
      case 'participar': return participarGiveaway(message, args.slice(1));
      default:          return sendHelp(message);
    }
  },
};

async function sendHelp(message: Message): Promise<void> {
  const embed = new EmbedBuilder()
    .setColor(0x7c5cfc)
    .setTitle('🎁 Comandos de Giveaway')
    .addFields(
      { name: '`!giveaway criar <prêmio> <minutos>`', value: 'Cria um sorteio (admin)' },
      { name: '`!giveaway participar <id>`', value: 'Entra em um sorteio ativo' },
      { name: '`!giveaway encerrar <id>`', value: 'Encerra e sorteia o vencedor (admin)' },
      { name: '`!giveaway lista`', value: 'Lista sorteios ativos' }
    );
  await message.reply({ embeds: [embed] });
}

function isAdmin(message: Message): boolean {
  return message.member?.permissions.has(PermissionFlagsBits.Administrator) ?? false;
}

function errorEmbed(desc: string): EmbedBuilder {
  return new EmbedBuilder().setColor(0xff4444).setDescription(desc);
}

async function criarGiveaway(message: Message, args: string[]): Promise<void> {
  if (!isAdmin(message)) {
    await message.reply({ embeds: [errorEmbed('❌ Apenas administradores podem criar sorteios.')] });
    return;
  }

  if (args.length < 2) {
    await message.reply({ embeds: [new EmbedBuilder().setColor(0x7c5cfc).setDescription('❌ Uso: `!giveaway criar <prêmio> <duração em minutos>`')] });
    return;
  }

  const duracao = parseInt(args[args.length - 1]);
  if (isNaN(duracao) || duracao < 1) {
    await message.reply({ embeds: [errorEmbed('❌ Duração inválida. Informe um número de minutos.')] });
    return;
  }

  const premio = args.slice(0, args.length - 1).join(' ');
  const endsAt = new Date(Date.now() + duracao * 60 * 1000);

  const { data, error } = await supabase
    .from('giveaways')
    .insert({
      prize: premio,
      created_by_discord_id: message.author.id,
      ends_at: endsAt.toISOString(),
      is_active: true,
      channel_id: message.channelId,
      guild_id: message.guildId,
    })
    .select()
    .single();

  if (error || !data) {
    console.error('Erro ao criar giveaway:', error);
    await message.reply({ embeds: [errorEmbed('❌ Erro ao criar sorteio. Verifique se a tabela `giveaways` existe no Supabase.')] });
    return;
  }

  const gw = data as Giveaway;
  const embed = new EmbedBuilder()
    .setColor(0x7c5cfc)
    .setTitle('🎁 Novo Sorteio!')
    .setDescription(`**Prêmio:** ${premio}`)
    .addFields(
      { name: '⏰ Encerra em', value: `<t:${Math.floor(endsAt.getTime() / 1000)}:R>`, inline: true },
      { name: '🆔 ID', value: `#${gw.id}`, inline: true }
    )
    .setFooter({ text: `Use !giveaway participar ${gw.id} para entrar!` });

  await message.channel.send({ embeds: [embed] });
}

async function participarGiveaway(message: Message, args: string[]): Promise<void> {
  const id = parseInt(args[0]);
  if (isNaN(id)) {
    await message.reply({ embeds: [new EmbedBuilder().setColor(0x7c5cfc).setDescription('❌ Uso: `!giveaway participar <id>`')] });
    return;
  }

  const { data } = await supabase
    .from('giveaways')
    .select('id, prize, ends_at, is_active')
    .eq('id', id)
    .single();

  const gw = data as Pick<Giveaway, 'id' | 'prize' | 'ends_at' | 'is_active'> | null;

  if (!gw?.is_active) {
    await message.reply({ embeds: [errorEmbed('❌ Sorteio não encontrado ou já encerrado.')] });
    return;
  }

  if (new Date(gw.ends_at) < new Date()) {
    await message.reply({ embeds: [errorEmbed('❌ Esse sorteio já expirou.')] });
    return;
  }

  const { data: existing } = await supabase
    .from('giveaway_entries')
    .select('id')
    .eq('giveaway_id', id)
    .eq('discord_id', message.author.id)
    .single();

  if (existing) {
    await message.reply({ embeds: [new EmbedBuilder().setColor(0xf857a6).setDescription('⚠️ Você já está participando desse sorteio!')] });
    return;
  }

  await supabase.from('giveaway_entries').insert({
    giveaway_id: id,
    discord_id: message.author.id,
    discord_username: message.author.username,
  });

  await message.reply({
    embeds: [new EmbedBuilder().setColor(0x7c5cfc).setDescription(`✅ **${message.author.username}** entrou no sorteio **"${gw.prize}"** (ID #${id})!`)],
  });
}

async function encerrarGiveaway(message: Message, args: string[]): Promise<void> {
  if (!isAdmin(message)) {
    await message.reply({ embeds: [errorEmbed('❌ Apenas administradores podem encerrar sorteios.')] });
    return;
  }

  const id = parseInt(args[0]);
  if (isNaN(id)) {
    await message.reply({ embeds: [new EmbedBuilder().setColor(0x7c5cfc).setDescription('❌ Uso: `!giveaway encerrar <id>`')] });
    return;
  }

  const { data } = await supabase
    .from('giveaways')
    .select('id, prize, is_active')
    .eq('id', id)
    .single();

  const gw = data as Pick<Giveaway, 'id' | 'prize' | 'is_active'> | null;

  if (!gw?.is_active) {
    await message.reply({ embeds: [errorEmbed('❌ Sorteio não encontrado ou já encerrado.')] });
    return;
  }

  const { data: entries } = await supabase
    .from('giveaway_entries')
    .select('discord_id, discord_username')
    .eq('giveaway_id', id);

  const entryList = (entries ?? []) as Pick<GiveawayEntry, 'discord_id' | 'discord_username'>[];

  if (entryList.length === 0) {
    await supabase.from('giveaways').update({ is_active: false }).eq('id', id);
    await message.reply({ embeds: [new EmbedBuilder().setColor(0x7c5cfc).setDescription('📭 Nenhum participante. Sorteio encerrado sem vencedor.')] });
    return;
  }

  const winner = entryList[Math.floor(Math.random() * entryList.length)];

  await supabase.from('giveaways').update({
    is_active: false,
    winner_discord_id: winner.discord_id,
    winner_username: winner.discord_username,
  }).eq('id', id);

  const embed = new EmbedBuilder()
    .setColor(0xf857a6)
    .setTitle('🎉 Sorteio Encerrado!')
    .setDescription(`Prêmio: **${gw.prize}**\n\n🏆 Vencedor: <@${winner.discord_id}> (**${winner.discord_username}**)\n\nParabéns! Entre em contato com um admin para resgatar.`);

  await message.channel.send({ embeds: [embed] });
}

async function listarGiveaways(message: Message): Promise<void> {
  const { data } = await supabase
    .from('giveaways')
    .select('id, prize, ends_at, is_active')
    .eq('is_active', true)
    .order('ends_at', { ascending: true })
    .limit(10);

  const giveaways = (data ?? []) as Pick<Giveaway, 'id' | 'prize' | 'ends_at' | 'is_active'>[];

  if (giveaways.length === 0) {
    await message.reply({ embeds: [new EmbedBuilder().setColor(0x7c5cfc).setDescription('📭 Nenhum sorteio ativo no momento.')] });
    return;
  }

  const lines = giveaways.map(gw => {
    const ts = Math.floor(new Date(gw.ends_at).getTime() / 1000);
    return `**#${gw.id}** — ${gw.prize} — encerra <t:${ts}:R>`;
  });

  const embed = new EmbedBuilder()
    .setColor(0x7c5cfc)
    .setTitle('🎁 Sorteios Ativos')
    .setDescription(lines.join('\n'))
    .setFooter({ text: 'Use !giveaway participar <id> para entrar' });

  await message.reply({ embeds: [embed] });
}

export default command;
