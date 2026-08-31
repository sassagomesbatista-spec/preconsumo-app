import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import * as schema from "./schema.js";

const pool = mysql.createPool({
  host: process.env.DB_HOST ?? "localhost",
  port: Number(process.env.DB_PORT ?? 3306),
  user: process.env.DB_USER ?? "root",
  password: process.env.DB_PASSWORD ?? "",
  database: process.env.DB_NAME ?? "preconsumo",
  waitForConnections: true,
  connectionLimit: 10,
});

export const db = drizzle(pool, { schema, mode: "default" });
export type DB = typeof db;

// Auto-migrations: cria as tabelas se ainda não existirem
export async function runAutoMigrations() {
  const conn = await pool.getConnection();
  try {
    const migrations = [
      `CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(320) NOT NULL UNIQUE,
        passwordHash VARCHAR(255) NOT NULL,
        role ENUM('user','admin') NOT NULL DEFAULT 'user',
        createdAt TIMESTAMP DEFAULT NOW(),
        lastSignedIn TIMESTAMP DEFAULT NOW()
      )`,
      `CREATE TABLE IF NOT EXISTS projects (
        id INT AUTO_INCREMENT PRIMARY KEY,
        ownerId INT NOT NULL,
        clientName VARCHAR(255) NOT NULL DEFAULT '',
        colecao VARCHAR(255) NOT NULL DEFAULT '',
        dataJson LONGTEXT NOT NULL,
        pricingJson LONGTEXT,
        createdAt TIMESTAMP DEFAULT NOW(),
        updatedAt TIMESTAMP DEFAULT NOW() ON UPDATE NOW()
      )`,
    ];
    const columnMigrations = [
      `ALTER TABLE projects ADD COLUMN erpQuoteId INT`,
      `ALTER TABLE projects ADD COLUMN erpQuoteNumber VARCHAR(20)`,
    ];
    for (const sql of [...migrations, ...columnMigrations]) {
      try { await conn.execute(sql); } catch (e: any) {
        if (!e.message?.includes("already exists") && !e.message?.includes("Duplicate column")) throw e;
      }
    }
  } finally {
    conn.release();
  }
}
