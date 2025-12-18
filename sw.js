// --- 1. SETTINGS ---
// INCREMENT THIS VERSION (v4 -> v5) WHENEVER YOU UPDATE YOUR APP
const CACHE_NAME = 'smartops-v4-static'; 

const ASSETS = [
    './',
    './index.html',
    './manifest.json',
    './icon-192.png',
    './icon-512.png',
    './task-widget-ui.json'
];

// --- 2. INSTALL EVENT (Cache files immediately) ---
self.addEventListener('install', (e) => {
    // Force this new service worker to become active immediately
    self.skipWaiting(); 
    
    e.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            console.log('Caching assets...');
            return cache.addAll(ASSETS);
        })
    );
});

// --- 3. ACTIVATE EVENT (The "Auto Clear" Logic) ---
self.addEventListener('activate', (e) => {
    // This forces the new Service Worker to take control of open pages
    e.waitUntil(
        Promise.all([
            clients.claim(),
            // Check all caches and delete any that don't match the current CACHE_NAME
            caches.keys().then(cacheNames => {
                return Promise.all(
                    cacheNames.map(cache => {
                        if (cache !== CACHE_NAME) {
                            console.log('Deleting old cache:', cache);
                            return caches.delete(cache);
                        }
                    })
                );
            })
        ])
    );
});

// --- 4. FETCH EVENT (Network First Strategy) ---
// I changed this to "Network First". It tries to get the fresh version from the internet first.
// If there is no internet, ONLY THEN does it use the cache. This prevents getting stuck on old versions.
self.addEventListener('fetch', (e) => {
    e.respondWith(
        fetch(e.request)
            .then(res => {
                // If we get a valid response from the network, update the cache
                const resClone = res.clone();
                caches.open(CACHE_NAME).then(cache => {
                    cache.put(e.request, resClone);
                });
                return res;
            })
            .catch(() => {
                // If network fails, return the cached version
                return caches.match(e.request);
            })
    );
});


// --- WIDGET LOGIC (Kept exactly as you had it) ---

// A. Handle Widget Installation
self.addEventListener('widgetinstall', (event) => {
    console.log('Installing widget...', event.widget);
    event.waitUntil(updateWidget(event.widget));
});

// B. Handle Widget Updates (Periodic or User triggered)
self.addEventListener('widgetresume', (event) => {
    console.log('Resuming widget...', event.widget);
    event.waitUntil(updateWidget(event.widget));
});

// C. Listen for updates from the App (When you click Save)
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'RELOAD_WIDGET') {
        if (self.widgets) {
            self.widgets.getByTag('task-list').then(widgetList => {
                if (widgetList && widgetList.length > 0) {
                    updateWidget(widgetList[0]);
                }
            });
        }
    }
});

// D. The Function that Draws the Widget
async function updateWidget(widgetInstance) {
    try {
        const template = await fetch('./task-widget-ui.json').then(res => res.json());
        const tasks = await getTasksFromDB();
        
        const data = {
            task1: tasks[0] ? tasks[0].title : "No pending tasks",
            task2: tasks[1] ? tasks[1].title : "",
            task3: tasks[2] ? tasks[2].title : ""
        };

        await self.widgets.updateByInstanceId(widgetInstance.instanceId, {
            template: JSON.stringify(template),
            data: JSON.stringify(data)
        });
        
    } catch (err) {
        console.error('Widget update failed:', err);
    }
}

// E. Database Helper
function getTasksFromDB() {
    return new Promise((resolve) => {
        const req = indexedDB.open('SmartOpsDB', 1);
        
        req.onsuccess = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains('items')) {
                resolve([]); 
                return;
            }
            
            const tx = db.transaction('items', 'readonly');
            const store = tx.objectStore('items');
            const getAll = store.getAll();
            
            getAll.onsuccess = () => {
                const pending = getAll.result.filter(i => i.type === 'task' && !i.done);
                resolve(pending.slice(0, 3)); 
            };
        };
        req.onerror = () => resolve([]);
    });
}
