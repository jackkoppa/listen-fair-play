import { Document } from 'flexsearch';
import Database from 'flexsearch/db/sqlite'
import Sqlite3Database from 'sqlite3';
import { SearchEntry } from '@listen-fair-play/types';
/** Name of the SQLite DB */
const SQLITE_DB_NAME = 'flexsearch_index';

export async function createDocumentIndex(sqlite3DB: Sqlite3Database.Database): Promise<Document<SearchEntry, true>> {
  // Create FlexSearch Document index with SQLite adapter
  const db = new Database({
    name: SQLITE_DB_NAME,
    db: sqlite3DB
  });

  const index = new Document<SearchEntry, true>({
    document: {
      id: 'id',
      index: [{
        field: 'text',
        tokenize: 'full',
        context: true,
      }],
      store: true, // Ensure documents (or specified fields) are stored for later enrichment.
    },
    commit: false, // We don't make changes regularly to the index, so let's only explicitly commit when needed (at % intervals, and at the end)
  });

  await index.mount(db);

  return index;
}