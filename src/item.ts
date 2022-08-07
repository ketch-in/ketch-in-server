export default class Item {
  static items: { [id: string]: Item } = {};

  static add(item: Item): void {
    if (this.items[item.id]) {
      return;
    }
    this.items[item.id] = item;
  }

  static remove(item: Item): void {
    return this.removeById(item.id);
  }

  static removeById(id: string): void {
    const item = this.get(id);
    if (!item) {
      return;
    }
    item.destroy();
    delete this.items[id];
  }

  static get(id?: unknown): Item | null {
    if (!id || typeof id !== "string" || !this.items[id]) {
      return null;
    }
    return this.items[id];
  }

  static createId(id?: string): string {
    if (!id) {
      return this.createId((Math.random() * 1000).toString().replace(".", ""));
    }
    return this.items[id] ? this.createId() : id;
  }

  id: string;

  constructor(id: string) {
    this.id = Item.createId(id);
    Item.add(this);
  }

  destroy(): void {
    return;
  }
}
