const CACHE_NAME = 'smartops-v1';
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './manifest.json',
    './icon-192.png',
    './icon-512.png',
    './task-widget-ui.json' // Added this to cache for offline widget rendering
];

const EXTERNAL_ASSETS = [
    'https://unpkg.com/@phosphor-icons/web',
    'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap'
];

// 1. Install Event
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            cache.addAll(EXTERNAL_ASSETS).catch(err => console.log('External asset skipped:', err));
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
    self.skipWaiting();
});

// 2. Activate Event
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keyList) => {
            return Promise.all(keyList.map((key) => {
                if (key !== CACHE_NAME) return caches.delete(key);
            }));
        })
    );
    return self.clients.claim();
});

// 3. Fetch Event
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);
    if (event.request.mode === 'navigate' || url.pathname.endsWith('index.html')) {
        event.respondWith(
            fetch(event.request).catch(() => caches.match('./index.html') || caches.match('./'))
        );
        return;
    }

    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            if (cachedResponse) return cachedResponse;
            return fetch(event.request).then((networkResponse) => {
                if (!networkResponse || networkResponse.status !== 200) return networkResponse;
                const responseToCache = networkResponse.clone();
                caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseToCache));
                return networkResponse;
            });
        })
    );
});

// --- FIXED WIDGET LOGIC (Moved outside of Fetch) ---

self.addEventListener('widgetinstall', event => {
    event.waitUntil(renderWidget(event.widget));
});

self.addEventListener('widgetresume', event => {
    event.waitUntil(renderWidget(event.widget));
});

// Completed the RELOAD_WIDGET logic
self.addEventListener('message', (event) => {
    if (event.data.type === 'RELOAD_WIDGET') {
        event.waitUntil(
            self.widgets.getByTag('task-list').then((widget) => {
                if (widget) renderWidget(widget);
            })
        );
    }
});

async function renderWidget(widget) {
    try {
        const template = await fetch('./task-widget-ui.json').then(res => res.json());
        const tasks = await getTasksFromDB(); 
        
        const data = {
            task1: tasks[0]?.title || "No tasks!",
            task2: tasks[1]?.title || "-",
            task3: tasks[2]?.title || "-"
        };

        await self.widgets.updateByTag('task-list', {
            template: JSON.stringify(template),
            data: JSON.stringify(data)
        });
    } catch (error) {
        console.error("Widget render failed:", error);
    }
}

async function getTasksFromDB() {
    return new Promise((resolve) => {
        const request = indexedDB.open('SmartOpsDB', 1);
        request.onsuccess = (e) => {
            const db = e.target.result;
            // Ensure store exists before trying to read
            if (!db.objectStoreNames.contains('items')) return resolve([]);
            
            const tx = db.transaction('items', 'readonly');
            const store = tx.objectStore('items');
            const getAll = store.getAll();
            getAll.onsuccess = () => {
                const pending = getAll.result.filter(i => !i.done && i.type === 'task');
                resolve(pending.slice(0, 3));
            };
        };
        request.onerror = () => resolve([]);
    });
}
