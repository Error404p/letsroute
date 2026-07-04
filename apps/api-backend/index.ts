import { Elysia } from "elysia";
import { prisma } from "@repo/db";

const app = new Elysia();

app.get("/", async () => {
  const users = await prisma.user.findMany();
  return { users };
});

app.listen(process.env.PORT || 3002, () => {
  console.log(`Server running at http://localhost:${process.env.PORT || 3002}`);
});