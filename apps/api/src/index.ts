import { buildServer } from "./server";

const port = Number(process.env.PORT ?? 4000);
const host = process.env.HOST ?? "0.0.0.0";
const server = await buildServer();

try {
  await server.listen({ port, host });
  server.log.info({ port, host }, "CueRoom API listening");
} catch (error) {
  server.log.error(error);
  process.exit(1);
}
