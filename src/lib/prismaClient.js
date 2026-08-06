import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import dotenv from "dotenv";
dotenv.config();

const adapter = new PrismaPg({
  url: process.env.DATABASE_URL,
});
const prismaClient = new PrismaClient({ adapter });

export default prismaClient;
