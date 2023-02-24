export interface ISerializableEvent {
  id: string;
  name: string;
  toJSON(): unknown;
}
