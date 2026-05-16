import { EmbedBuilder, Message, Client } from 'discord.js';
import supabase from '../utils/supabase';
import { Command, Profile } from '../types';

const command: Command = {
  name: 'vincular',
  aliases: ['link', 'conectar'],
  description: 'Vincula seu Discord ao seu perfil grief.cc',

  async execute(message: Message, args: string[], _client: Client): Promise<void> {
    const username = args[0]?.toLowerCase().replace(/^@/, '');

    if (!username) {
      await message.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0x7c5cfc)
            .setTitle('🔗 Como vincular')
            .setDescription('Use `!vincular <seu_username>` com o username do seu perfil no grief.cc.\n\nExemplo: `!vincular thiagopitas`'),
        ],
      });
      return;
    }

    // Busca o perfil pelo username
    const { data, error } = await supabase
      .from('profiles')
      .select('id, username, display_name, discord_id')
      .eq('username', username)
      .single();

    const profile = data as Pick<Profile, 'id' | 'username' | 'display_name' | 'discord_id'> | null;

    if (error || !profile) {
      await message.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xff4444)
            .setDescription(`❌ Perfil **${username}** não encontrado no grief.cc.`),
        ],
      });
      return;
    }

    // Já vinculado ao próprio Discord
    if (profile.discord_id === message.author.id) {
      await message.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0x7c5cfc)
            .setDescription(`✅ Seu Discord já está vinculado ao perfil **${profile.username}**!`),
        ],
      });
      return;
    }

    // Perfil já vinculado a outro Discord
    if (profile.discord_id && profile.discord_id !== message.author.id) {
      await message.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xff4444)
            .setDescription(`❌ O perfil **${username}** já está vinculado a outro Discord.\nSe é seu perfil, entre em contato com um administrador.`),
        ],
      });
      return;
    }

    // Verifica se esse Discord já está vinculado a outro perfil
    const { data: existingLink } = await supabase
      .from('profiles')
      .select('username')
      .eq('discord_id', message.author.id)
      .single();

    if (existingLink) {
      await message.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xff4444)
            .setDescription(`❌ Seu Discord já está vinculado ao perfil **${existingLink.username}**.\nUse \`!desvincular\` primeiro se quiser trocar.`),
        ],
      });
      return;
    }

    // Vincula via RPC (SECURITY DEFINER — bypassa RLS)
    const { error: updateError } = await supabase.rpc('vincular_discord', {
      p_discord_id: message.author.id,
      p_discord_username: message.author.username,
      p_profile_id: profile.id,
    });

    if (updateError) {
      console.error('Erro ao vincular discord_id:', updateError);
      await message.reply({
        embeds: [new EmbedBuilder().setColor(0xff4444).setDescription('❌ Erro ao vincular. Rode o SQL do migration_link_tokens no Supabase.')],
      });
      return;
    }

    await message.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0x7c5cfc)
          .setTitle('✅ Discord Vinculado!')
          .setDescription(`Seu Discord foi vinculado ao perfil **[${profile.display_name ?? profile.username}](https://grief.cc/${profile.username})**.\n\nAgora você pode usar \`!perfil\`, \`!views\` e outros comandos sem precisar informar o username.`),
      ],
    });
  },
};

export default command;
