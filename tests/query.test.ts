import "dotenv/config";
import { expect, it, beforeAll } from "vitest";
import { NeonConnector } from "../src/NeonConnector";
import { powerSync } from "../src/powersync";

beforeAll(async () => {
  const connector = new NeonConnector();
  await connector.initSession();

  await powerSync.connect(connector);
  await powerSync.init();
  await powerSync.waitForFirstSync();
});

it("should fetch lists", async () => {
  const lists = await powerSync.getAll(`SELECT * FROM lists`);
  console.log("lists: ", lists);
  expect(Array.isArray(lists)).toBe(true);
});

it("should fetch todos", async () => {
  const todos = await powerSync.getAll(`SELECT * FROM todos`);
  console.log("todos: ", todos);
  expect(Array.isArray(todos)).toBe(true);
});
