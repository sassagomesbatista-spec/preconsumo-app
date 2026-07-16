import mysql from "mysql2/promise";

const { DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME, GITHUB_TOKEN, GITHUB_REPO } = process.env;

if (!GITHUB_TOKEN || !GITHUB_REPO) {
  throw new Error("GITHUB_TOKEN e GITHUB_REPO precisam estar definidos");
}

const conn = await mysql.createConnection({
  host: DB_HOST ?? "localhost",
  port: Number(DB_PORT ?? 3306),
  user: DB_USER ?? "root",
  password: DB_PASSWORD ?? "",
  database: DB_NAME ?? "preconsumo",
  connectTimeout: 20000,
});

const [users] = await conn.execute("SELECT * FROM users");
const [projects] = await conn.execute("SELECT * FROM projects");
await conn.end();

const dump = {
  generatedAt: new Date().toISOString(),
  users,
  projects,
};

const content = Buffer.from(JSON.stringify(dump, null, 2)).toString("base64");
const date = new Date().toISOString().slice(0, 10);
const path = `backups/backup-${date}.json`;

const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/contents/${path}`, {
  method: "PUT",
  headers: {
    Authorization: `Bearer ${GITHUB_TOKEN}`,
    Accept: "application/vnd.github+json",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    message: `Backup ${date}`,
    content,
  }),
});

if (!res.ok) {
  const body = await res.text();
  throw new Error(`Falha ao enviar backup para o GitHub: ${res.status} ${body}`);
}

console.log(`Backup enviado com sucesso: ${path} (${users.length} usuários, ${projects.length} projetos)`);
