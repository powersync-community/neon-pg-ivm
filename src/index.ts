import "dotenv/config";
import { powerSync } from "./powersync.ts";
import { NeonConnector } from "./NeonConnector.ts";


const connector = new NeonConnector();
await connector.initSession();
await powerSync.connect(connector);
await powerSync.init();
await powerSync.waitForFirstSync();

const lists = await powerSync.getAll(`SELECT * FROM lists`);
console.log("lists: ", lists);

const todos = await powerSync.getAll(`SELECT * FROM todos`);
console.log("todos: ", todos);

// await powerSync.execute(
//   `INSERT INTO lists (id, name, created_at, owner_id) VALUES (?, ?, ?, ?)`,
//   [
//     crypto.randomUUID(),
//     "New List",
//     new Date().toISOString(),
//     crypto.randomUUID(),
//   ]
// );

// await connector.uploadData(powerSync);

// const updatedLists = await powerSync.getAll(`SELECT * FROM lists`);
// console.log("Updated lists: ", updatedLists);

await powerSync.disconnectAndClear();
console.log("Disconnected and cleared the database.");

process.exit(0);
