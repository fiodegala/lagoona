import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { posService, CreateSaleData, POSSaleItem } from './posService';

interface POSDatabase extends DBSchema {
  products: {
    key: string;
    value: {
      id: string;
      name: string;
      description: string | null;
      price: number;
      wholesale_price: number | null;
      exclusive_price: number | null;
      promotional_price: number | null;
      stock: number;
      category_id: string | null;
      category_name: string | null;
      image_url: string | null;
      barcode: string | null;
      is_active: boolean;
      variations: Array<{
        id: string;
        sku: string | null;
        price: number | null;
        wholesale_price: number | null;
        exclusive_price: number | null;
        promotional_price: number | null;
        stock: number;
        is_active: boolean;
      }>;
      updated_at: string;
    };
    indexes: { 'by-barcode': string; 'by-name': string };
  };
  pendingSales: {
    key: string;
    value: CreateSaleData & { created_at: string };
    indexes: { 'by-created': string };
  };
  currentSession: {
    key: string;
    value: {
      id: string;
      user_id: string;
      opened_at: string;
      opening_balance: number;
      status: 'open' | 'closed';
    };
  };
}

let db: IDBPDatabase<POSDatabase> | null = null;

const DB_NAME = 'lagoona-pos';
const DB_VERSION = 1;

export const offlineService = {
  async initDB(): Promise<IDBPDatabase<POSDatabase>> {
    if (db) return db;

    db = await openDB<POSDatabase>(DB_NAME, DB_VERSION, {
      upgrade(database) {
        // Products store
        if (!database.objectStoreNames.contains('products')) {
          const productStore = database.createObjectStore('products', { keyPath: 'id' });
          productStore.createIndex('by-barcode', 'barcode');
          productStore.createIndex('by-name', 'name');
        }

        // Pending sales store
        if (!database.objectStoreNames.contains('pendingSales')) {
          const salesStore = database.createObjectStore('pendingSales', { keyPath: 'local_id' });
          salesStore.createIndex('by-created', 'created_at');
        }

        // Current session store
        if (!database.objectStoreNames.contains('currentSession')) {
          database.createObjectStore('currentSession', { keyPath: 'id' });
        }
      },
    });

    return db;
  },

  async getDB(): Promise<IDBPDatabase<POSDatabase>> {
    if (!db) {
      return this.initDB();
    }
    return db;
  },

  // Product cache management
  async cacheProducts(): Promise<void> {
    const database = await this.getDB();
    const products = await posService.getAllActiveProducts();

    const tx = database.transaction('products', 'readwrite');
    const store = tx.objectStore('products');

    // Clear existing products
    await store.clear();

    // Add all products
    for (const product of products) {
      await store.put({
        id: product.id,
        name: product.name,
        description: product.description,
        price: product.price,
        wholesale_price: product.wholesale_price,
        exclusive_price: product.exclusive_price,
        promotional_price: product.promotional_price,
        stock: product.stock,
        category_id: product.category_id,
        category_name: (product.categories as { name: string } | null)?.name || null,
        image_url: product.image_url,
        barcode: product.barcode,
        is_active: product.is_active,
        variations: (product.product_variations || []).map((v: Record<string, unknown>) => ({
          id: v.id as string,
          sku: v.sku as string | null,
          price: v.price as number | null,
          wholesale_price: v.wholesale_price as number | null,
          exclusive_price: v.exclusive_price as number | null,
          promotional_price: v.promotional_price as number | null,
          stock: v.stock as number,
          is_active: v.is_active as boolean,
        })),
        updated_at: product.updated_at,
      });
    }

    await tx.done;
  },

  async getCachedProducts(): Promise<POSDatabase['products']['value'][]> {
    const database = await this.getDB();
    return database.getAll('products');
  },

  async getCachedProductByBarcode(barcode: string): Promise<POSDatabase['products']['value'] | undefined> {
    const database = await this.getDB();
    const index = database.transaction('products', 'readonly').store.index('by-barcode');
    return index.get(barcode);
  },

  async searchCachedProducts(query: string): Promise<POSDatabase['products']['value'][]> {
    const database = await this.getDB();
    const allProducts = await database.getAll('products');
    const lowerQuery = query.toLowerCase();

    return allProducts.filter(
      (p) =>
        p.name.toLowerCase().includes(lowerQuery) ||
        (p.barcode && p.barcode.toLowerCase().includes(lowerQuery))
    );
  },

  // Pending sales management
  async savePendingSale(saleData: CreateSaleData): Promise<void> {
    const database = await this.getDB();
    await database.put('pendingSales', {
      ...saleData,
      created_at: new Date().toISOString(),
    });
  },

  async getPendingSales(): Promise<(CreateSaleData & { created_at: string })[]> {
    const database = await this.getDB();
    return database.getAll('pendingSales');
  },

  async removePendingSale(localId: string): Promise<void> {
    const database = await this.getDB();
    await database.delete('pendingSales', localId);
  },

  async getPendingSalesCount(): Promise<number> {
    const database = await this.getDB();
    return database.count('pendingSales');
  },

  // Session management
  async saveCurrentSession(session: POSDatabase['currentSession']['value']): Promise<void> {
    const database = await this.getDB();
    // Clear existing sessions
    const tx = database.transaction('currentSession', 'readwrite');
    await tx.store.clear();
    await tx.store.put(session);
    await tx.done;
  },

  async getCurrentSession(): Promise<POSDatabase['currentSession']['value'] | undefined> {
    const database = await this.getDB();
    const sessions = await database.getAll('currentSession');
    return sessions[0];
  },

  async clearCurrentSession(): Promise<void> {
    const database = await this.getDB();
    const tx = database.transaction('currentSession', 'readwrite');
    await tx.store.clear();
    await tx.done;
  },

  // Sync management
  async syncPendingSales(): Promise<{ synced: number; failed: number }> {
    const pendingSales = await this.getPendingSales();
    let synced = 0;
    let failed = 0;

    for (const sale of pendingSales) {
      try {
        const result = await posService.syncPendingSale(sale);
        if (result !== null) {
          synced++;
        }
        await this.removePendingSale(sale.local_id);
      } catch (error) {
        console.error('Failed to sync sale:', error);
        failed++;
      }
    }

    return { synced, failed };
  },

  // Network status
  isOnline(): boolean {
    return navigator.onLine;
  },

  onOnlineStatusChange(callback: (online: boolean) => void): () => void {
    const handleOnline = () => callback(true);
    const handleOffline = () => callback(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  },

  // Utility to generate local ID
  generateLocalId(): string {
    return crypto.randomUUID();
  },
};

// Auto-sync when coming back online
if (typeof window !== 'undefined') {
  window.addEventListener('online', async () => {
    console.log('Back online, syncing pending sales...');
    const result = await offlineService.syncPendingSales();
    console.log(`Synced ${result.synced} sales, ${result.failed} failed`);
  });
}
