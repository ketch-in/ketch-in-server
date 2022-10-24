export type Dictionary = { [key: string]: unknown };

export interface RoomArgs {
  id: string;
  owner: string;
  extra: Dictionary;
  maxParticipantsAllowed: number;
}
