const CACHE_NAME = 'smartops-v1';
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './manifest.json',
    './icon-192.png', // Ensure these exist!
    './icon-512.png'
];

// External assets (Fonts & Icons)
const EXTERNAL_ASSETS = [
    'https://unpkg.com/@phosphor-icons/web',
    'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap'
];

// 1. Install Event: Cache core files immediately
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('[Service Worker] Caching all: app shell and content');
            // We cache external assets separately to handle potential CORS issues gracefully
            cache.addAll(EXTERNAL_ASSETS).catch(err => console.log('External asset skipped:', err));
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
    self.skipWaiting(); // Activate worker immediately
});

// 2. Activate Event: Clean up old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keyList) => {
            return Promise.all(keyList.map((key) => {
                if (key !== CACHE_NAME) {
                    console.log('[Service Worker] Removing old cache', key);
                    return caches.delete(key);
                }
            }));
        })
    );
    return self.clients.claim();
});

// 3. Fetch Event: Network-First for HTML, Cache-First for Assets
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // Strategy: Network First for the main page (index.html) to ensure updates are seen
    // If offline, fall back to cache.
    if (event.request.mode === 'navigate' || url.pathname.endsWith('index.html')) {
        event.respondWith(
            fetch(event.request)
                .catch(() => {
                    return caches.match('./index.html') || caches.match('./');
                })
        );
        return;
    }
    // --- WIDGET LOGIC ---

self.addEventListener('widgetinstall', event => {
    event.waitUntil(renderWidget(event.widget));
});

self.addEventListener('widgetresume', event => {
    event.waitUntil(renderWidget(event.widget));
});

// This listens for updates from your index.html (when a user adds a task)
self.addEventListener('message', (event) => {
    if (event.data.type === 'RELOAD_WIDGET') {
        self.widgets.updateByTag('task-list', {
             // Logic to refresh data
        });
    }
});

async function renderWidget(widget) {
    // 1. Fetch the UI template
    const template = await fetch('./task-widget-ui.json').then(res => res.json());

    // 2. Access IndexedDB to get the real tasks
    // (This is a simplified representation of fetching your 'items' array)
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
}

// Helper to get data from your SmartOpsDB
async function getTasksFromDB() {
    return new Promise((resolve) => {
        const request = indexedDB.open('SmartOpsDB', 1);
        request.onsuccess = (e) => {
            const db = e.target.result;
            const tx = db.transaction('items', 'readonly');
            const store = tx.objectStore('items');
            const getAll = store.getAll();
            getAll.onsuccess = () => {
                // Return only unfinished tasks
                const pending = getAll.result.filter(i => !i.done && i.type === 'task');
                resolve(pending.slice(0, 3));
            };
        };
        request.onerror = () => resolve([]);
    });
}


    // Strategy: Cache First for everything else (Images, CSS, Fonts, Scripts)
    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            if (cachedResponse) {
                return cachedResponse;
            }
            return fetch(event.request).then((networkResponse) => {
                // Check if we received a valid response
                if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic' && networkResponse.type !== 'cors') {
                    return networkResponse;
                }

                // Clone the response to put it in cache
                const responseToCache = networkResponse.clone();

                caches.open(CACHE_NAME).then((cache) => {
                    cache.put(event.request, responseToCache);
                });

                return networkResponse;
            });
        })
    );
});
