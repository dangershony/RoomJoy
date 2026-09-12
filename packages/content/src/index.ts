/**
 * RoomJoy content pack stub — prompts, decks, and copy for future games.
 */
export interface ContentPack {
  id: string;
  gameId: string;
  locale: string;
  items: ContentItem[];
}

export interface ContentItem {
  id: string;
  text: string;
  tags?: string[];
}

export const EMPTY_PACKS: ContentPack[] = [];

export function getPack(_id: string): ContentPack | undefined {
  return undefined;
}
