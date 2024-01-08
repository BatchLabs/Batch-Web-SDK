export default function objectDepth(o: object): number {
  return Object(o) === o ? 1 + Math.max(-1, ...Object.values(o).map(objectDepth)) : 0;
}
