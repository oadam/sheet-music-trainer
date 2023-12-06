export default class EvictingMultipMap<K, V> {
    private values = new Map<K, V[]>()

    constructor(private evictOver: number) {
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

    public get(key: K): V[]|undefined {
        return this.values.get(key);
    }

}