import { nanoid } from "nanoid";

/**
 * 数据类
 * * 用于存储和管理数据
 * * 提供唯一标识符和数据更新功能
 */
export class Data {
  private _id: string;
  [key: string]: unknown;

  /** 创建实例并分配唯一标识符。 */
  constructor() {
    this._id = nanoid();
  }

  /**
   * 获取数据实例的唯一标识符。
   * @returns 唯一标识符
   */
  get id(): string {
    return this._id;
  }

  /**
   * 设置新的标识符。
   * @param value 新的唯一标识符
   */
  set id(value: string) {
    this._id = value;
  }

  /**
   * 根据传入的数据更新实例内容。
   * @param data 需要合并到实例中的数据
   */
  update(data: Record<string, unknown>): void {
    Object.assign(this, data);
  }

  /**
   * 生成可序列化的 JSON 表示。
   * @returns 包含实例字段的对象
   */
  toJSON(): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const key in this) {
      if (key !== "_id" && Object.hasOwn(this, key)) {
        result[key] = this[key];
      }
    }
    return result;
  }
}
