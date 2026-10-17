import { createApp } from './app.js';
import { JsonFileRepository } from './json-file-repository.js';

const port = Number(process.env.PORT ?? 3000);
const dataFile = process.env.LIBRARY_DATA_FILE ?? 'data/library.json';

createApp({ repo: new JsonFileRepository(dataFile) }).listen(port, () => {
  console.log(`API: http://localhost:${port}`);
});
