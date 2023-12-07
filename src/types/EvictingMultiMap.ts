export default class EvictingMultipMap<K, V> {
  public values: Map<K, V[]>;

  constructor(private evictOver: number, values: [K, V[]][] | undefined = undefined) {
    this.values = new Map(values || []);
  }

  public add(key: K, value: V) {
    if (!this.values.has(key)) {
      this.values.set(key, []);
    }
    const val = this.values.get(key)!;
    if (val.length >= this.evictOver) {
      val.pop();
    }
    val.unshift(value);
  }
}
