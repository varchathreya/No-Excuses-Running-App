import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const googleCalendarConnectionsTable = pgTable(
  "google_calendar_connections",
  {
    clerkUserId: text("clerk_user_id").primaryKey(),
    encryptedRefreshToken: text("encrypted_refresh_token").notNull(),
    grantedScope: text("granted_scope").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
);

export const insertGoogleCalendarConnectionSchema = createInsertSchema(
  googleCalendarConnectionsTable,
).omit({ createdAt: true, updatedAt: true });

export type InsertGoogleCalendarConnection = z.infer<
  typeof insertGoogleCalendarConnectionSchema
>;
export type GoogleCalendarConnection =
  typeof googleCalendarConnectionsTable.$inferSelect;