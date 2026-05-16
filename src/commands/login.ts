import { EmbedBuilder, Message, Client } from 'discord.js';
import supabase from '../utils/supabase';
import { Command } from '../types';

const SITE_URL = process.env.SITE_URL ?? 'http://localhost:3000';
const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 10 * 60 * 1000;

const command: Command = {
  name: 'login',
  aliases: ['vincular-site', 'conectar-site'],
  description: 'Vincula seu Discord ao grief.cc via login no site',

  async execute(message: Message, _args: string[], _client: Client): Promise<void> {
    const { data: existing } = await supabase
      .from('profiles')
      .select('username, display_name')
      .eq('discord_id', message.author.id)
      .single();

    if (existing) {
      await message.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0x7c5cfc)
            .setDescription(`✅ Seu Discord já está vinculado ao perfil **${existing.display_name ?? existing.username}**!\n\nUse \`!desvincular\` se quiser trocar.`),
        ],
      });
      return;
    }

    const { data: tokenData, error } = await supabase
      .from('link_tokens')
      .insert({
        discord_id: message.author.id,
        discord_username: message.author.username,
      })
      .select('token')
      .single();

    if (error || !tokenData) {
      console.error('Erro ao criar token:', JSON.stringify(error, null, 2));
      await message.reply({
        embeds: [new EmbedBuilder().setColor(0xff4444).setDescription(`❌ Erro ao gerar link.\n\`\`\`${error?.message ?? 'Erro desconhecido'}\`\`\``)],
      });
      return;
    }

    const tokenValue = tokenData.token as string;

    const linkUrl = `${SITE_URL}/vincular?token=${tokenValue}`;

    let sentAsDM = false;
    try {
      await message.author.send({
        embeds: [
          new EmbedBuilder()
            .setColor(0x7c5cfc)
            .setTitle('🔗 Vincular Discord ao grief.cc')
            .setDescription(
              `Clique no link abaixo, **faça login no site** e clique em "Vincular minha conta".\n\n🔗 [Clique aqui para vincular](${linkUrl})\n\n⏰ Link válido por **10 minutos**.`
            )
            .setFooter({ text: 'Não compartilhe esse link com ninguém.' }),
        ],
      });
      sentAsDM = true;
    } catch {
    }

    const replyEmbed = new EmbedBuilder()
      .setColor(0x7c5cfc)
      .setTitle('🔗 Link de vinculação gerado!')
      .setDescription(
        sentAsDM
          ? '📩 Enviei o link na sua DM! Abra e faça login no site.\n\n⏰ Válido por 10 minutos — aguardando...'
          : `📩 Não consegui te mandar DM. Clique aqui: [Vincular conta](${linkUrl})\n\n⏰ Válido por 10 minutos — aguardando...`
      );

    const replyMsg = await message.reply({ embeds: [replyEmbed] });

    const startTime = Date.now();

    const poll = setInterval(async () => {
      if (Date.now() - startTime > POLL_TIMEOUT_MS) {
        clearInterval(poll);
        await replyMsg.edit({
          embeds: [
            new EmbedBuilder()
              .setColor(0xff4444)
              .setDescription('⏰ Tempo expirado. Use `!login` novamente para gerar um novo link.'),
          ],
        });
        return;
      }

      const { data: tokenRow } = await supabase
        .from('link_tokens')
        .select('used_at, profile_id')
        .eq('token', tokenValue as string)
        .single();

      if (tokenRow?.used_at) {
        clearInterval(poll);

        const { data: profile } = await supabase
          .from('profiles')
          .select('username, display_name, avatar_url')
          .eq('id', tokenRow.profile_id)
          .single();

        const embed = new EmbedBuilder()
          .setColor(0x7c5cfc)
          .setTitle('✅ Discord Vinculado!')
          .setDescription(
            `Sua conta Discord foi vinculada ao perfil **[${profile?.display_name ?? profile?.username}](https://grief.cc/${profile?.username})**!\n\nAgora use \`!perfil\`, \`!views\` e outros comandos sem precisar do username.`
          );

        if (profile?.avatar_url) embed.setThumbnail(profile.avatar_url);

        await replyMsg.edit({ embeds: [embed] });

        if (!sentAsDM) return;
        await message.channel.send({
          content: `<@${message.author.id}>`,
          embeds: [embed],
        });
      }
    }, POLL_INTERVAL_MS);
  },
};

export default command;
