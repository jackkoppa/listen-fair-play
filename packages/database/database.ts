import { Document } from 'flexsearch';
import Database from 'flexsearch/db/sqlite'
import EnglishPreset from 'flexsearch/lang/en'
import Sqlite3Database from 'sqlite3';
import { SearchEntry } from '@listen-fair-play/types';
import { log } from '@listen-fair-play/logging'; // Import logging utility
/** Name of the SQLite DB */
const SQLITE_DB_NAME = 'flexsearch_index';

/**
 * Creates a FlexSearch Document index using the provided SQLite database.
 * @param sqlite3DB - The SQLite3 database instance to use for the index.
 * @returns A Promise resolving to the created FlexSearch Document index.
 */
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
        tokenize: 'strict',
        encoder: EnglishPreset,
        context: { 
          resolution: 3,
          depth: 1,
          bidirectional: true
        },
      }],
      store: true, // Ensure documents (or specified fields) are stored for later enrichment.
    },
    commit: false, // We don't make changes regularly to the index, so let's only explicitly commit when needed (at % intervals, and at the end)
  });

  await index.mount(db);

  return index;
}



/**
 * Logs the number of rows in each user-defined table within the provided SQLite database.
 * @param sqlite3DB - The SQLite3 database instance to query.
 */
export async function logRowCountsForSQLiteTables(sqlite3DB: Sqlite3Database.Database): Promise<void> {
  try {
    const tables: { name: string }[] = await new Promise((resolve, reject) => {
      sqlite3DB.all("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'", (err, tables) => {
        if (err) {
          reject(err);
        } else {
          resolve(tables as { name: string }[]);
        }
      });
    });

    if (tables.length > 0) {
      const tableNames = tables.map(t => t.name);
      log.debug(`Found tables in SQLite DB: ${tableNames.join(', ')}`);
      const tableQueries = tableNames.map(tableName => `SELECT '${tableName}' as table_name, COUNT(*) as count FROM ${tableName}`).join(' UNION ALL ');
      
      const rowCounts: { table_name: string; count: number }[] = await new Promise((resolve, reject) => {
        sqlite3DB.all(tableQueries, (err, rows) => {
          if (err) {
            reject(err);
          } else {
            resolve(rows as { table_name: string; count: number }[]);
          }
        });
      });

      if (rowCounts.length > 0) {
        log.info('--- Row Counts in SQLite DB Tables ---');
        rowCounts.forEach((row) => {
          log.info(`Table: ${row.table_name}, Rows: ${row.count}`);
        });
        log.info('-------------------------------------');
      } else {
        log.info('No row counts returned, though tables were queried.');
      }
    } else {
      log.info('No user-defined tables found in the SQLite DB to count rows from.');
    }
  } catch (err: any) {
    log.warn(`Error querying table row counts from SQLite DB: ${err.message}`, err);
  }
}
