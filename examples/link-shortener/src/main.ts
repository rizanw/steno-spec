import { LinkService } from './links.ts';
import { createApp } from './server.ts';
import { FileStore, MemoryStore } from './store.ts';

const port = Number(process.env.PORT ?? 3000);
const baseUrl = process.env.BASE_URL ?? `http://localhost:${port}/`;
// Set DATA_FILE to keep links across restarts; otherwise they live in memory.
const store = process.env.DATA_FILE ? new FileStore(process.env.DATA_FILE) : new MemoryStore();

createApp(new LinkService(store), baseUrl).listen(port, () => {
  console.log(`link shortener listening on ${baseUrl}`);
});
