import { EmbedBuilder, Message, Client } from 'discord.js';
import supabase from '../utils/supabase';
import { Command } from '../types';

const command: Command = {
  name: 'desvincular',
  aliases: ['unlink', 'desconectar'],
  description: 'Remove a vinculação do seu Discord com o grief.cc',

  async execute(message: Message, _args: string[], _client: Client): Promise<void> {
    const { data } = await supabase
      .from('profiles')
      .select('id, username')
      .eq('discord_id', message.author.id)
      .single();

    if (!data) {
      await message.reply({
        embeds: [new EmbedBuilder().setColor(0x7c5cfc).setDescription('❌ Seu Discord não está vinculado a nenhum perfil.')],
      });
      return;
    }

    const { error } = await supabase
      .from('profiles')
      .update({ discord_id: null })
      .eq('id', data.id);

    if (error) {
      console.error('Erro ao desvincular:', error);
      await message.reply({
        embeds: [new EmbedBuilder().setColor(0xff4444).setDescription(`❌ Erro ao desvincular: \`${error.message}\``)],
      });
      return;
    }

    await message.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0x7c5cfc)
          .setDescription(`✅ Desvinculado do perfil **${data.username}** com sucesso.`),
      ],
    });
  },
};

export default command;
