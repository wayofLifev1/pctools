const CACHE_NAME = 'smartops-v3-static';
const ASSETS = [
    './',
    './index.html',
    './manifest.json',
    './icon-192.png',
    './icon-512.png',
    './task-widget-ui.json'
];

// 1. INSTALL: Cache files
self.addEventListener('install', (e) => {
    e.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)));
    self.skipWaiting();
});

// 2. ACTIVATE: Clean old caches
self.addEventListener('activate', (e) => {
    e.waitUntil(clients.claim());
});

// 3. FETCH: Offline Support
self.addEventListener('fetch', (e) => {
    e.respondWith(
        caches.match(e.request).then(res => res || fetch(e.request))
    );
});

// --- WIDGET LOGIC (THE IMPORTANT PART) ---

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
        // Find the widget by its tag 'task-list' and update it
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
        // 1. Get the Template
        const template = await fetch('./task-widget-ui.json').then(res => res.json());
        
        // 2. Get Data from IndexedDB (Shared with App)
        const tasks = await getTasksFromDB();
        
        // 3. Format Data for the Widget
        const data = {
            task1: tasks[0] ? tasks[0].title : "No pending tasks",
            task2: tasks[1] ? tasks[1].title : "",
            task3: tasks[2] ? tasks[2].title : ""
        };

        // 4. Send to Widget
        await self.widgets.updateByInstanceId(widgetInstance.instanceId, {
            template: JSON.stringify(template),
            data: JSON.stringify(data)
        });
        
    } catch (err) {
        console.error('Widget update failed:', err);
    }
}

// E. Database Helper (Reads what you saved in Index.html)
function getTasksFromDB() {
    return new Promise((resolve) => {
        const req = indexedDB.open('SmartOpsDB', 1);
        
        req.onsuccess = (e) => {
            const db = e.target.result;
            // Handle empty DB case
            if (!db.objectStoreNames.contains('items')) {
                resolve([]); 
                return;
            }
            
            const tx = db.transaction('items', 'readonly');
            const store = tx.objectStore('items');
            const getAll = store.getAll();
            
            getAll.onsuccess = () => {
                // Filter for tasks that are NOT done
                const pending = getAll.result.filter(i => i.type === 'task' && !i.done);
                resolve(pending.slice(0, 3)); // Return top 3
            };
        };
        
        req.onerror = () => resolve([]);
    });
}
