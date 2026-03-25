import express, { Request, Response } from "express";
import { createServer as createViteServer } from "vite";
import mysql from "mysql2/promise";
import dotenv from "dotenv";
import path from "path";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));

  // MySQL Connection Pool
  const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: parseInt(process.env.DB_PORT || "3306"),
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  });

  let dbError: string | null = null;

  // Check connection
  try {
    const connection = await pool.getConnection();
    console.log("Connected to MySQL Database");
    dbError = null;
    
    // Create tables if they don't exist
    await connection.query(`
      CREATE TABLE IF NOT EXISTS \`settings\` (
        \`id\` int(11) NOT NULL DEFAULT 1,
        \`data\` longtext COLLATE utf8mb4_unicode_ci NOT NULL,
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    await connection.query(`
      CREATE TABLE IF NOT EXISTS \`letters\` (
        \`id\` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
        \`data\` longtext COLLATE utf8mb4_unicode_ci NOT NULL,
        \`updated_at\` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    await connection.query(`
      CREATE TABLE IF NOT EXISTS \`employees\` (
        \`id\` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
        \`data\` longtext COLLATE utf8mb4_unicode_ci NOT NULL,
        \`updated_at\` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    
    connection.release();
  } catch (err) {
    dbError = err instanceof Error ? err.message : String(err);
    console.error("====================================================");
    console.error("MYSQL CONNECTION ERROR DETECTED!");
    console.error("The app is currently trying to connect to:", process.env.DB_HOST || "127.0.0.1");
    console.error("ERROR DETAILS:", err);
    console.error("\nACTION REQUIRED:");
    console.error("1. Go to AI Studio 'Settings' (Gear Icon) -> 'Secrets'");
    console.error("2. Add DB_HOST, DB_USER, DB_PASSWORD, and DB_NAME from your Hostinger account.");
    console.error("3. IMPORTANT: Do NOT use 'localhost' or '127.0.0.1' as DB_HOST.");
    console.error("4. Ensure your Hostinger MySQL allows remote connections (Remote MySQL).");
    console.error("====================================================");
  }

  // API Routes
  app.get("/api/db-setup", (_req: Request, res: Response) => {
    res.json({ message: "Use POST to setup database" });
  });

  app.post("/api/db-setup", async (_req: Request, res: Response) => {
    console.log("DB Setup requested...");
    try {
      const connection = await pool.getConnection();
      console.log("DB Connection obtained for setup");
      await connection.query("SET NAMES utf8mb4");
      
      await connection.query(`
        CREATE TABLE IF NOT EXISTS \`settings\` (
          \`id\` int(11) NOT NULL DEFAULT 1,
          \`data\` longtext COLLATE utf8mb4_unicode_ci NOT NULL,
          PRIMARY KEY (\`id\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);
      console.log("Settings table verified");

      await connection.query(`
        CREATE TABLE IF NOT EXISTS \`letters\` (
          \`id\` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
          \`data\` longtext COLLATE utf8mb4_unicode_ci NOT NULL,
          \`updated_at\` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
          PRIMARY KEY (\`id\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);
      console.log("Letters table verified");

      await connection.query(`
        CREATE TABLE IF NOT EXISTS \`employees\` (
          \`id\` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
          \`data\` longtext COLLATE utf8mb4_unicode_ci NOT NULL,
          \`updated_at\` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
          PRIMARY KEY (\`id\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);
      console.log("Employees table verified");
      
      connection.release();
      console.log("DB Setup completed successfully");
      res.json({ success: true, message: "Database tables created/verified successfully" });
    } catch (err) {
      console.error("DB Setup Error:", err);
      res.status(500).json({ 
        success: false, 
        error: err instanceof Error ? err.message : String(err) 
      });
    }
  });

  app.get("/api/db-status", (_req: Request, res: Response) => {
    const host = process.env.DB_HOST || "NOT SET";
    const isLocal = host === "localhost" || host === "127.0.0.1";
    
    res.json({
      connected: dbError === null,
      error: dbError,
      warning: isLocal ? "Anda menggunakan 'localhost'. Gunakan alamat IP atau Hostname dari Hostinger (misal: sql123.hostinger.com)" : null,
      config: {
        host: host,
        user: process.env.DB_USER || "NOT SET",
        database: process.env.DB_NAME || "NOT SET",
        port: process.env.DB_PORT || "3306",
        hasPassword: !!process.env.DB_PASSWORD
      }
    });
  });
  app.get("/api/settings", async (_req: Request, res: Response) => {
    try {
      const [rows]: any = await pool.query("SELECT data FROM settings WHERE id = 1");
      if (rows.length > 0) {
        res.json(JSON.parse(rows[0].data));
      } else {
        res.json(null);
      }
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch settings" });
    }
  });

  app.post("/api/settings", async (req: Request, res: Response) => {
    try {
      const data = JSON.stringify(req.body);
      await pool.query(
        "INSERT INTO settings (id, data) VALUES (1, ?) ON DUPLICATE KEY UPDATE data = ?",
        [data, data]
      );
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to save settings" });
    }
  });

  app.get("/api/letters", async (_req: Request, res: Response) => {
    try {
      const [rows]: any = await pool.query("SELECT data FROM letters ORDER BY updated_at DESC");
      res.json(rows.map((r: any) => JSON.parse(r.data)));
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch letters" });
    }
  });

  app.post("/api/letters", async (req: Request, res: Response) => {
    try {
      const letter = req.body;
      const data = JSON.stringify(letter);
      await pool.query(
        "INSERT INTO letters (id, data) VALUES (?, ?) ON DUPLICATE KEY UPDATE data = ?",
        [letter.id, data, data]
      );
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to save letter" });
    }
  });

  app.delete("/api/letters", async (req: Request, res: Response) => {
    try {
      const { id } = req.query;
      await pool.query("DELETE FROM letters WHERE id = ?", [id]);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to delete letter" });
    }
  });

  app.get("/api/employees", async (_req: Request, res: Response) => {
    try {
      const [rows]: any = await pool.query("SELECT data FROM employees ORDER BY updated_at DESC");
      res.json(rows.map((r: any) => JSON.parse(r.data)));
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch employees" });
    }
  });

  app.post("/api/employees", async (req: Request, res: Response) => {
    try {
      const employee = req.body;
      const data = JSON.stringify(employee);
      await pool.query(
        "INSERT INTO employees (id, data) VALUES (?, ?) ON DUPLICATE KEY UPDATE data = ?",
        [employee.id, data, data]
      );
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to save employee" });
    }
  });

  app.delete("/api/employees", async (req: Request, res: Response) => {
    try {
      const { id } = req.query;
      await pool.query("DELETE FROM employees WHERE id = ?", [id]);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to delete employee" });
    }
  });

  // JSON 404 for API routes to prevent HTML responses
  app.all("/api/*all", (_req: Request, res: Response) => {
    res.status(404).json({ error: "API Route not found" });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
