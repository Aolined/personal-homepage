export interface HistoryRetentionRecord {
  id: string;
  createdAt: number;
  outputSize: number;
}

export interface ConversionHistoryRecord extends HistoryRetentionRecord {
  sourceName: string;
  outputName: string;
  kind: 'image' | 'audio' | 'video' | 'pdf';
  sourceSize: number;
  blob: Blob;
}

const DATABASE_NAME = 'format-workshop-history';
const STORE_NAME = 'results';
const MAX_HISTORY_COUNT = 10;
const MAX_HISTORY_BYTES = 100 * 1024 * 1024;

export function selectHistoryToKeep<T extends HistoryRetentionRecord>(
  records: readonly T[],
  maxCount = MAX_HISTORY_COUNT,
  maxBytes = MAX_HISTORY_BYTES,
): T[] {
  const newestFirst = [...records].sort((a, b) => b.createdAt - a.createdAt);
  const kept: T[] = [];
  let totalBytes = 0;

  for (const record of newestFirst) {
    if (kept.length >= maxCount || totalBytes + record.outputSize > maxBytes) {
      continue;
    }
    kept.push(record);
    totalBytes += record.outputSize;
  }
  return kept;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('无法打开本地转换记录。'));
  });
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('本地记录操作失败。'));
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('本地记录写入失败。'));
    transaction.onabort = () => reject(transaction.error ?? new Error('本地记录写入已中止。'));
  });
}

export async function listHistoryRecords(): Promise<ConversionHistoryRecord[]> {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(STORE_NAME, 'readonly');
    const records = await requestResult(
      transaction.objectStore(STORE_NAME).getAll() as IDBRequest<ConversionHistoryRecord[]>,
    );
    return selectHistoryToKeep(records);
  } finally {
    database.close();
  }
}

export async function addHistoryRecords(
  records: readonly ConversionHistoryRecord[],
): Promise<void> {
  if (records.length === 0) return;
  const database = await openDatabase();
  try {
    const write = database.transaction(STORE_NAME, 'readwrite');
    const store = write.objectStore(STORE_NAME);
    records.forEach((record) => store.put(record));
    await transactionDone(write);

    const read = database.transaction(STORE_NAME, 'readonly');
    const allRecords = await requestResult(
      read.objectStore(STORE_NAME).getAll() as IDBRequest<ConversionHistoryRecord[]>,
    );
    const keepIds = new Set(selectHistoryToKeep(allRecords).map((record) => record.id));
    const staleIds = allRecords
      .filter((record) => !keepIds.has(record.id))
      .map((record) => record.id);
    if (staleIds.length > 0) {
      const trim = database.transaction(STORE_NAME, 'readwrite');
      const trimStore = trim.objectStore(STORE_NAME);
      staleIds.forEach((id) => trimStore.delete(id));
      await transactionDone(trim);
    }
  } finally {
    database.close();
  }
}

export async function deleteHistoryRecord(id: string): Promise<void> {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).delete(id);
    await transactionDone(transaction);
  } finally {
    database.close();
  }
}

export async function clearHistoryRecords(): Promise<void> {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).clear();
    await transactionDone(transaction);
  } finally {
    database.close();
  }
}
