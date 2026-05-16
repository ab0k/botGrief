import { Client, Message } from 'discord.js';

export interface Command {
  name: string;
  aliases?: string[];
  description: string;
  execute(message: Message, args: string[], client: Client): Promise<void>;
}

export interface Profile {
  id: string;
  username: string;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  view_count: number;
  is_premium: boolean;
  discord_id: string | null;
  created_at: string;
}

export interface ProfileView {
  profile_id: string;
  viewed_at: string;
}

export interface Giveaway {
  id: number;
  prize: string;
  created_by_discord_id: string;
  ends_at: string;
  is_active: boolean;
  channel_id: string;
  guild_id: string;
  winner_discord_id: string | null;
  winner_username: string | null;
}

export interface GiveawayEntry {
  id: number;
  giveaway_id: number;
  discord_id: string;
  discord_username: string;
}
