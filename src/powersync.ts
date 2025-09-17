import {
  column,
  Schema,
  Table,
  PowerSyncDatabase,
  createBaseLogger,
} from "@powersync/node";

export const schema = new Schema({
  lists: new Table({
    name: column.text,
    created_at: column.text,
    owner_id: column.text,
  }),
  todos: new Table({
    description: column.text,
    list_id: column.text,
    completed: column.integer,
  }),
});

export const powerSync = new PowerSyncDatabase({
  schema,
  database: { dbFilename: "test.sqlite" },
  logger: createBaseLogger(),
});