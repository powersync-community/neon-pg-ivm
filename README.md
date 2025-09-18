# PowerSync Neon Demo
This is a demo project showing how to use PowerSync with a Neon Postgres database.

## Setup Neon

1. Create a Neon account and a free project at [neon.tech](https://neon.tech).
2. Create a new project.
3. Go to settings and enable Logical Replication (Settings -> Logical Replication -> Enable).
4. Enable authentication for your project. (Auth -> Enable Neon Auth)
5. Go to the configuration tab and copy your environment variables.
6. Copy the `.env.template` to `.env` and update the Neon environment variables.

## Run the demo

1. Install dependencies:

   ```shell
   pnpm install
   ```

2. Copy the example environment file:

   ```shell
   cp .env.template .env
   ```

3. Update the `.env` file with your Neon environment variables.
4. Start up the PowerSync service:

   ```shell
   pnpm powersync:up
   ```

5. Run the demo script:

   ```shell
   pnpm dev
    ```

## Using pg_ivm for materialized views

PowerSync supports syncing materialized views using the `pg_ivm` extension. This allows you to create views that automatically update when the underlying tables change, and PowerSync can sync these views to clients. **Specifically useful for queries that require joined tables**

1. Connect to your Neon database using `psql` or any Postgres client.
2. Run the following SQL commands to set up `pg_ivm` and create a sample table and materialized view:

   ```sql
   CREATE EXTENSION IF NOT EXISTS pg_ivm;

   SELECT
    pgivm.create_immv(
        'lists_with_todos', 
        'SELECT t.id, l.id AS list_id, l.name AS list_name, t.description AS todo_description 
        FROM lists AS l 
        JOIN todos AS t ON l.id = t.list_id'
    );
    ALTER TABLE lists_with_todos REPLICA IDENTITY FULL;
   ```

3. Include the view in your sync rules:

    ```yaml
    bucket_definitions:
        global:
            data:
            - SELECT * FROM lists
            - SELECT * FROM todos
            - SELECT * FROM lists_with_todos
    ```

### Caveats

- There are [contraints](https://github.com/sraoss/pg_ivm#supported-view-definitions-and-restriction) for `pg_ivm` tables.
- Changes to dependant `pg_ivm` tables require the source database to be updated before the changes are reflected on the client.