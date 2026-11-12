// The archive lives in this browser (IndexedDB), one database per account.
// Nothing here is sent anywhere.
const STORES = ["children", "photos", "originals", "faces", "milestones", "growth", "records"];

function request(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function openArchive(userId) {
  const open = indexedDB.open("imorta-" + userId, 1);
  open.onupgradeneeded = () => {
    const db = open.result;
    for (const name of STORES) {
      if (db.objectStoreNames.contains(name)) continue;
      const store = db.createObjectStore(name, { keyPath: "id", autoIncrement: name !== "originals" });
      if (name === "faces") store.createIndex("photoId", "photoId");
    }
  };
  const db = await request(open);
  return {
    all: (store) => request(db.transaction(store).objectStore(store).getAll()),
    get: (store, id) => request(db.transaction(store).objectStore(store).get(id)),
    async put(store, value) {
      const id = await request(db.transaction(store, "readwrite").objectStore(store).put(value));
      value.id = id;
      return value;
    },
    del: (store, id) => request(db.transaction(store, "readwrite").objectStore(store).delete(id)),
    async putAll(store, values) {
      const tx = db.transaction(store, "readwrite");
      for (const v of values) tx.objectStore(store).put(v);
      return new Promise((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); });
    },
    async wipe() {
      const tx = db.transaction(STORES, "readwrite");
      for (const name of STORES) tx.objectStore(name).clear();
      return new Promise((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); });
    },
  };
}
