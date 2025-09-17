import {
  AbstractPowerSyncDatabase,
  type PowerSyncBackendConnector,
  type PowerSyncCredentials,
  UpdateType,
} from "@powersync/node";
import { StackServerApp, type ServerUser, type Session } from "@stackframe/js";
import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

export class NeonConnector implements PowerSyncBackendConnector {
  stackServerApp: StackServerApp;
  client: NeonQueryFunction<false, false>;
  session: Session | undefined;

  constructor() {
    this.stackServerApp = new StackServerApp({
      projectId: process.env.PS_STACK_PROJECT_ID,
      publishableClientKey: process.env.STACK_PUBLISHABLE_CLIENT_KEY,
      secretServerKey: process.env.STACK_SECRET_SERVER_KEY,
      tokenStore: "memory",
    });

    this.client = neon(process.env.PS_POSTGRESQL_URI as string);
  }

  async initSession() {
    let user: ServerUser | null = null;

    const users = await this.stackServerApp.listUsers();
    if (users.length > 0) {
      user = users[0];
    } else {
      user = await this.stackServerApp.createUser({
        primaryEmail: "test@test.com",
      });
    }
    
    this.session = await user?.createSession({
      expiresInMillis: 24 * 60 * 60 * 1000,
    });
  }

  /**
   * @returns {Promise<PowerSyncCredentials>}
   */
  async fetchCredentials(): Promise<PowerSyncCredentials> {
    const tokens = await this.session?.getTokens();

    return {
      endpoint: process.env.POWERSYNC_URL as string,
      token: tokens?.accessToken || "",
    };
  }

  async uploadData(database: AbstractPowerSyncDatabase) {
    const transaction = await database.getNextCrudTransaction();

    if (!transaction) {
      return;
    }

    /**
     * @type {CrudEntry | null}
     */
    let lastOp = null;
    try {
      // Note: If transactional consistency is important, use database functions
      // or edge functions to process the entire transaction in a single call.
      for (const op of transaction.crud) {
        lastOp = op;
        if (!op.opData) {
          continue;
        }
        const columns = Object.keys(op.opData).concat("id");
        let result;
        switch (op.op) {
          case UpdateType.PUT:
            const record = { ...op.opData, id: op.id };
            result = await this.client.query(
              `INSERT INTO ${op.table} (${columns}) VALUES (${Object.values(
                record
              )
                .map((_, i) => `$${i + 1}`)
                .join(", ")})
                 ON CONFLICT (id) DO UPDATE SET ${Object.keys(record)
                   .map((k, i) => `"${k}" = $${i + 1}`)
                   .join(", ")}`,
              Object.values(record)
            );
            break;
          case UpdateType.PATCH:
            result = await this.client.query(
              `UPDATE ${op.table} SET ${columns
                .map((k, i) => `"${k}" = $${i + 1}`)
                .join(", ")} WHERE id = $${columns.length + 1}`,
              [...Object.values(op.opData), op.id]
            );
            break;
          case UpdateType.DELETE:
            result = await this.client.query(
              `DELETE FROM ${op.table} WHERE id = $1`,
              [op.id]
            );
            break;
        }
      }

      await transaction.complete();
    } catch (ex: any) {
      console.debug(ex);
      if (
        typeof ex.code == "string" &&
        FATAL_RESPONSE_CODES.some((regex) => regex.test(ex.code))
      ) {
        /**
         * Instead of blocking the queue with these errors,
         * discard the (rest of the) transaction.
         *
         * Note that these errors typically indicate a bug in the application.
         * If protecting against data loss is important, save the failing records
         * elsewhere instead of discarding, and/or notify the user.
         */
        console.error("Data upload error - discarding:", lastOp, ex);
        await transaction.complete();
      } else {
        // Error may be retryable - e.g. network error or temporary server error.
        // Throwing an error here causes this call to be retried after a delay.
        throw ex;
      }
    }
  }
}

/// Postgres Response codes that we cannot recover from by retrying.
const FATAL_RESPONSE_CODES = [
  // Class 22 — Data Exception
  // Examples include data type mismatch.
  new RegExp("^22...$"),
  // Class 23 — Integrity Constraint Violation.
  // Examples include NOT NULL, FOREIGN KEY and UNIQUE violations.
  new RegExp("^23...$"),
  // INSUFFICIENT PRIVILEGE - typically a row-level security violation
  new RegExp("^42501$"),
];
