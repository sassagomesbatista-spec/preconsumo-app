/**
 * Cria o primeiro usuário admin.
 * Uso: node scripts/create-admin.mjs
 * Variáveis: ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD (ou interativo)
 */
import mysql from "mysql2/promise";
import bcrypt from "bcryptjs";
import * as dotenv from "dotenv";
import * as readline from "readline";
dotenv.config();

async function prompt(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => { rl.close(); resolve(answer); });
  });
}

const conn = await mysql.createConnection({
  host: process.env.DB_HOST ?? "localhost",
  port: Number(process.env.DB_PORT ?? 3306),
  user: process.env.DB_USER ?? "root",
  password: process.env.DB_PASSWORD ?? "",
  database: process.env.DB_NAME ?? "preconsumo",
});

const name = process.env.ADMIN_NAME ?? await prompt("Nome: ");
const email = process.env.ADMIN_EMAIL ?? await prompt("E-mail: ");
const password = process.env.ADMIN_PASSWORD ?? await prompt("Senha: ");

const [existing] = await conn.execute("SELECT id FROM users WHERE email = ?", [email.toLowerCase()]);
if (existing.length > 0) {
  console.log("⚠ Usuário com esse e-mail já existe.");
  await conn.end();
  process.exit(0);
}

const passwordHash = await bcrypt.hash(password, 12);
await conn.execute(
  "INSERT INTO users (name, email, passwordHash, role, lastSignedIn) VALUES (?, ?, ?, 'admin', NOW())",
  [name, email.toLowerCase(), passwordHash]
);

console.log(`✓ Admin "${name}" criado com sucesso.`);
await conn.end();
