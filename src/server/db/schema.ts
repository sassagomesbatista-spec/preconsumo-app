import { mysqlTable, int, varchar, longtext, mysqlEnum, timestamp } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 320 }).notNull().unique(),
  passwordHash: varchar("passwordHash", { length: 255 }).notNull(),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const projects = mysqlTable("projects", {
  id: int("id").autoincrement().primaryKey(),
  ownerId: int("ownerId").notNull(),
  clientName: varchar("clientName", { length: 255 }).notNull().default(""),
  colecao: varchar("colecao", { length: 255 }).notNull().default(""),
  dataJson: longtext("dataJson").notNull(),
  pricingJson: longtext("pricingJson"),
  // Vínculo com o pedido do ERP (erp-comissao) — buscado e travado na criação,
  // nunca digitado à mão. Ver routers/erpBridge.ts.
  erpQuoteId: int("erpQuoteId"),
  erpQuoteNumber: varchar("erpQuoteNumber", { length: 20 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
