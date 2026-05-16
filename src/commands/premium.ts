import { EmbedBuilder, Message, Client, GuildMember, PermissionFlagsBits } from 'discord.js';
import supabase from '../utils/supabase';
import { Command, Profile } from '../types';

type Sub = 'verificar' | 'info' | 'sync' | string;

const command: Command = {
  name: 'premium',
  aliases: ['vip'],
  description: 'Verifica e gerencia status premium do grief.cc',

  async execute(message: Message, args: string[], client: Client): Promise<void> {
    const sub: Sub = (args[0] ?? 'verificar').toLowerCase();

    switch (sub) {
      case 'verificar': return verificarPremium(message);
      case 'info':      return infoPremium(message, args.slice(1));
      case 'sync':      return syncPremium(message);
      default: {
        const embed = new EmbedBuilder()
          .setColor(0x7c5cfc)
          .setTitle('✨ Comandos Premium')
          .addFields(
            { name: '`!premium verificar`', value: 'Verifica seu status e recebe o cargo premium' },
            { name: '`!premium info [@usuario]`', value: 'Vê o status premium de alguém' },
            { name: '`!premium sync`', value: 'Sincroniza todos os cargos premium (admin)' }
          );
        await message.reply({ embeds: [embed] });
      }
    }
  },
};

function isAdmin(message: Message): boolean {
  return message.member?.permissions.has(PermissionFlagsBits.Administrator) ?? false;
}

async function verificarPremium(message: Message): Promise<void> {
  const premiumRoleId = process.env.PREMIUM_ROLE_ID;

  const { data } = await supabase
    .from('profiles')
    .select('username, display_name, is_premium')
    .eq('discord_id', message.author.id)
    .single();

  const profile = data as Pick<Profile, 'username' | 'display_name' | 'is_premium'> | null;

  if (!profile) {
    await message.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0x7c5cfc)
          .setDescription('❌ Nenhum perfil grief.cc vinculado ao seu Discord.\nFaça login em **grief.cc** com Discord para vincular.'),
      ],
    });
    return;
  }

  if (!profile.is_premium) {
    await message.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0x7c5cfc)
          .setTitle('Você não é Premium')
          .setDescription('Assine o grief.cc Premium para desbloquear recursos exclusivos!\n🔗 [grief.cc/premium](https://grief.cc/premium)'),
      ],
    });
    return;
  }

  if (premiumRoleId && message.guild) {
    try {
      const member = await message.guild.members.fetch(message.author.id);
      const alreadyHas = member.roles.cache.has(premiumRoleId);
      if (!alreadyHas) await member.roles.add(premiumRoleId);

      await message.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xf857a6)
            .setTitle('✨ Premium Confirmado!')
            .setDescription(
              alreadyHas
                ? `Olá **${profile.display_name ?? profile.username}**! Você já tem o cargo premium.`
                : `Olá **${profile.display_name ?? profile.username}**! Cargo premium concedido com sucesso.`
            ),
        ],
      });
      return;
    } catch (err) {
      console.error('Erro ao atribuir cargo premium:', err);
    }
  }

  await message.reply({
    embeds: [
      new EmbedBuilder()
        .setColor(0xf857a6)
        .setTitle('✨ Você é Premium!')
        .setDescription(`Conta **${profile.display_name ?? profile.username}** confirmada como premium no grief.cc.`),
    ],
  });
}

async function infoPremium(message: Message, args: string[]): Promise<void> {
  type ProfileSnippet = Pick<Profile, 'username' | 'display_name' | 'is_premium'>;
  let target: ProfileSnippet | null = null;

  if (args[0]) {
    const mention = message.mentions.users.first();
    if (mention) {
      const { data } = await supabase
        .from('profiles')
        .select('username, display_name, is_premium')
        .eq('discord_id', mention.id)
        .single();
      target = data;
    } else {
      const { data } = await supabase
        .from('profiles')
        .select('username, display_name, is_premium')
        .eq('username', args[0].toLowerCase())
        .single();
      target = data;
    }
  } else {
    const { data } = await supabase
      .from('profiles')
      .select('username, display_name, is_premium')
      .eq('discord_id', message.author.id)
      .single();
    target = data;
  }

  if (!target) {
    await message.reply({ embeds: [new EmbedBuilder().setColor(0x7c5cfc).setDescription('❌ Perfil não encontrado.')] });
    return;
  }

  const embed = new EmbedBuilder()
    .setColor(target.is_premium ? 0xf857a6 : 0x7c5cfc)
    .setTitle(`${target.is_premium ? '✨' : '👤'} ${target.display_name ?? target.username}`)
    .addFields(
      { name: 'Status', value: target.is_premium ? '✨ **Premium**' : '🆓 Gratuito', inline: true },
      { name: 'Perfil', value: `[grief.cc/${target.username}](https://grief.cc/${target.username})`, inline: true }
    );

  await message.reply({ embeds: [embed] });
}

async function syncPremium(message: Message): Promise<void> {
  if (!isAdmin(message)) {
    await message.reply({ embeds: [new EmbedBuilder().setColor(0xff4444).setDescription('❌ Apenas administradores podem sincronizar cargos.')] });
    return;
  }

  const premiumRoleId = process.env.PREMIUM_ROLE_ID;
  if (!premiumRoleId) {
    await message.reply({ embeds: [new EmbedBuilder().setColor(0xff4444).setDescription('❌ `PREMIUM_ROLE_ID` não configurado no `.env`.')] });
    return;
  }

  if (!message.guild) return;

  const statusMsg = await message.reply({
    embeds: [new EmbedBuilder().setColor(0x7c5cfc).setDescription('⏳ Sincronizando cargos premium...')],
  });

  const { data } = await supabase
    .from('profiles')
    .select('discord_id')
    .eq('is_premium', true)
    .not('discord_id', 'is', null);

  const premiumProfiles = (data ?? []) as Pick<Profile, 'discord_id'>[];

  if (premiumProfiles.length === 0) {
    await statusMsg.edit({ embeds: [new EmbedBuilder().setColor(0x7c5cfc).setDescription('📭 Nenhum usuário premium encontrado.')] });
    return;
  }

  let added = 0, skipped = 0, failed = 0;

  for (const { discord_id } of premiumProfiles) {
    if (!discord_id) { skipped++; continue; }
    try {
      const member: GuildMember | null = await message.guild.members.fetch(discord_id).catch(() => null);
      if (!member) { skipped++; continue; }
      if (member.roles.cache.has(premiumRoleId)) { skipped++; continue; }
      await member.roles.add(premiumRoleId);
      added++;
    } catch {
      failed++;
    }
  }

  await statusMsg.edit({
    embeds: [
      new EmbedBuilder()
        .setColor(0x7c5cfc)
        .setTitle('✅ Sync Concluído')
        .addFields(
          { name: '✨ Cargos adicionados', value: `${added}`, inline: true },
          { name: '⏭️ Já tinham cargo', value: `${skipped}`, inline: true },
          { name: '❌ Falhas', value: `${failed}`, inline: true }
        ),
    ],
  });
}

export default command;
