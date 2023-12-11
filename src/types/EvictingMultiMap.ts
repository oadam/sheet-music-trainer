import { isMappedTypeNode } from "typescript";

export default class EvictingMultipMap<K, V> {
  public values: Map<K, V[]>;

  constructor(values: [K, V[]][] | undefined = undefined) {
    this.values = new Map(values || []);
  }

  /** @param evictOver Remove values that are older than this number */
  public add(key: K, value: V, evictOver: number) {
    if (!this.values.has(key)) {
      this.values.set(key, []);
    }
    const val = this.values.get(key)!;
    if (val.length >= evictOver) {
      val.pop();
    }
    val.unshift(value);
  }

  public clear() {
    this.values.clear();
  }
}
