import winston from "winston";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: winston.format.combine(
    winston.format.timestamp({
      format: "YYYY-MM-DD HH:mm:ss",
    }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json(),
  ),
  defaultMeta: { service: "tlt-bot" },
  transports: [
    new winston.transports.File({
      filename: path.join(__dirname, "./error.log"),
      level: "error",
    }),
    new winston.transports.File({
      filename: path.join(__dirname, "./combined.log"),
    }),
  ],
});

export default logger;
