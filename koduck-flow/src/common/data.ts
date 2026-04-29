import { nanoid } from "nanoid";

/**
 * Data class
 * * Used for storing and managing data
 * * Provides unique identifier and data update functionality
 */
export class Data {
  private _id: string;
  [key: string]: unknown;

  /** Creates an instance and assigns a unique identifier. */
  constructor() {
    this._id = nanoid();
  }

  /**
   * Gets the unique identifier of the data instance.
   * @returns Unique identifier
   */
  get id(): string {
    return this._id;
  }

  /**
   * Sets a new identifier.
   * @param value New unique identifier
   */
  set id(value: string) {
    this._id = value;
  }

  /**
   * Updates instance content based on the passed data.
   * @param data Data to be merged into the instance
   */
  update(data: Record<string, unknown>): void {
    Object.assign(this, data);
  }

  /**
   * Generates a serializable JSON representation.
   * @returns An object containing instance fields
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
