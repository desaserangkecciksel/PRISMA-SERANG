import { LetterData, AppSettings, Employee } from '../types';
import { INITIAL_SETTINGS } from '../constants';

const LS_KEYS = {
    LETTERS: 'espm_letters_local',
    SETTINGS: 'espm_settings_local',
    EMPLOYEES: 'espm_employees_local',
    PENDING_SYNC: 'espm_pending_sync_queue'
};

// Base URL for PHP API (Hostinger)
const API_URL = 'https://apbdesdesaserang.id/api.php';

interface PendingSyncItem {
    id: string;
    action: 'saveLetter' | 'deleteLetter' | 'saveEmployee' | 'deleteEmployee' | 'saveSettings';
    payload: any;
    timestamp: number;
}

const getPendingQueue = (): PendingSyncItem[] => {
    try {
        const raw = localStorage.getItem(LS_KEYS.PENDING_SYNC);
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
};

const savePendingQueue = (queue: PendingSyncItem[]) => {
    try {
        localStorage.setItem(LS_KEYS.PENDING_SYNC, JSON.stringify(queue));
    } catch (e) {
        console.warn("Gagal menyimpan pending sync queue:", e);
    }
};

const enqueueSync = (item: Omit<PendingSyncItem, 'timestamp'>) => {
    const queue = getPendingQueue();
    // Replace duplicate pending task for same id and action if exists
    const filtered = queue.filter(q => !(q.id === item.id && q.action === item.action));
    filtered.push({ ...item, timestamp: Date.now() });
    savePendingQueue(filtered);
};

const callApi = async (
    action: string, 
    method: string = 'GET', 
    body: any = null, 
    params: Record<string, string> = {}, 
    timeoutMs: number = 4000
) => {
    // If browser reports strictly offline, fail fast to avoid network stall
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
        return null;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
        let url = `${API_URL}?action=${action}`;
        Object.entries(params).forEach(([key, val]) => {
            url += `&${key}=${encodeURIComponent(val)}`;
        });

        const options: RequestInit = {
            method,
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            signal: controller.signal,
            cache: 'no-cache',
            mode: 'cors'
        };

        if (body) {
            options.body = JSON.stringify(body);
        }

        const response = await fetch(url, options);
        clearTimeout(timeoutId);

        if (!response.ok) {
            console.warn(`API responded with status: ${response.status} for ${action}`);
            return null;
        }

        const text = await response.text();
        if (!text || !text.trim()) return null;

        try {
            return JSON.parse(text);
        } catch {
            console.warn(`API returned non-JSON response for ${action}`);
            return null;
        }
    } catch (e: any) {
        clearTimeout(timeoutId);
        if (e.name === 'AbortError') {
            console.warn(`API timeout (${timeoutMs}ms) for ${action}`);
        } else {
            console.warn(`API call failed for ${action}:`, e.message || e);
        }
        return null;
    }
};

export const StorageService = {
  // --- SYNC PENDING QUEUE ---
  flushPendingSync: async (): Promise<void> => {
      if (typeof navigator !== 'undefined' && !navigator.onLine) return;
      const queue = getPendingQueue();
      if (queue.length === 0) return;

      const remaining: PendingSyncItem[] = [];
      for (const item of queue) {
          try {
              let res = null;
              if (item.action === 'saveLetter') {
                  res = await callApi('letters', 'POST', item.payload, {}, 4000);
              } else if (item.action === 'deleteLetter') {
                  res = await callApi('letters', 'DELETE', null, { id: item.id }, 4000);
              } else if (item.action === 'saveEmployee') {
                  res = await callApi('employees', 'POST', item.payload, {}, 4000);
              } else if (item.action === 'deleteEmployee') {
                  res = await callApi('employees', 'DELETE', null, { id: item.id }, 4000);
              } else if (item.action === 'saveSettings') {
                  res = await callApi('settings', 'POST', item.payload, {}, 4000);
              }
              if (!res && res !== true) {
                  // Keep item to retry next time
                  remaining.push(item);
              }
          } catch {
              remaining.push(item);
          }
      }
      savePendingQueue(remaining);
  },

  // --- LETTERS ---
  getLetters: async (): Promise<LetterData[]> => {
    // Helper to filter unique letters by ID
    const deduplicateLetters = (arr: LetterData[]): LetterData[] => {
      const seen = new Set<string>();
      return arr.filter(item => {
        if (!item || !item.id) return false;
        if (seen.has(item.id)) return false;
        seen.add(item.id);
        return true;
      });
    };

    // 1. Read local cache immediately
    let localData: LetterData[] = [];
    try {
        const localRaw = localStorage.getItem(LS_KEYS.LETTERS);
        if (localRaw) {
            const parsed = JSON.parse(localRaw);
            if (Array.isArray(parsed)) {
                localData = deduplicateLetters(parsed);
            }
        }
    } catch (e) {
        console.warn("Gagal membaca cache lokal letters:", e);
    }

    // 2. Fetch from cloud with safe timeout (3500ms)
    try {
        const cloudData = await callApi('letters', 'GET', null, {}, 3500);
        if (cloudData && Array.isArray(cloudData)) {
            const uniqueCloud = deduplicateLetters(cloudData);
            localStorage.setItem(LS_KEYS.LETTERS, JSON.stringify(uniqueCloud));
            // Trigger background queue flush
            StorageService.flushPendingSync().catch(() => {});
            return uniqueCloud;
        }
    } catch (e) {
        console.warn("Gagal fetch cloud data letters, menggunakan data lokal:", e);
    }

    // 3. Fallback to local cache seamlessly
    return localData;
  },

  saveLetter: async (letter: LetterData): Promise<void> => {
    // 1. Save to Local first (Always instant and safe)
    try {
        const raw = localStorage.getItem(LS_KEYS.LETTERS);
        const list: LetterData[] = raw ? JSON.parse(raw) : [];
        const filtered = list.filter(l => l.id !== letter.id);
        filtered.unshift(letter);
        localStorage.setItem(LS_KEYS.LETTERS, JSON.stringify(filtered));
    } catch (e) { 
        console.error("Local save error", e); 
    }

    // 2. Save to Cloud API
    const res = await callApi('letters', 'POST', letter, {}, 4000);
    if (!res) {
        // Enqueue if offline or API failed
        enqueueSync({ id: letter.id, action: 'saveLetter', payload: letter });
    }
  },

  deleteLetter: async (id: string): Promise<void> => {
    // 1. Delete Local first
    try {
        const raw = localStorage.getItem(LS_KEYS.LETTERS);
        if (raw) {
            const list: LetterData[] = JSON.parse(raw);
            const newList = list.filter(l => l.id !== id);
            localStorage.setItem(LS_KEYS.LETTERS, JSON.stringify(newList));
        }
    } catch (e) {}

    // 2. Delete Cloud API
    const res = await callApi('letters', 'DELETE', null, { id }, 4000);
    if (!res) {
        enqueueSync({ id, action: 'deleteLetter', payload: null });
    }
  },

  getNextSPMNumber: async (baseYear: number): Promise<string> => {
    let letters: LetterData[] = [];
    try {
        const cloudData = await callApi('letters', 'GET', null, {}, 3000);
        if (cloudData && Array.isArray(cloudData)) {
            letters = cloudData;
        } else {
            const localRaw = localStorage.getItem(LS_KEYS.LETTERS);
            if (localRaw) letters = JSON.parse(localRaw);
        }
    } catch {
        const localRaw = localStorage.getItem(LS_KEYS.LETTERS);
        if (localRaw) letters = JSON.parse(localRaw);
    }
    
    let maxNumber = 0;
    letters.forEach(letter => {
        const letterDate = new Date(letter.date);
        if (!isNaN(letterDate.getTime()) && (letterDate.getFullYear() === baseYear || letter.fiscalYear === baseYear.toString())) {
            const match = (letter.letterNumber || '').match(/903\/(\d{3})\/SPM/);
            if (match) {
                const num = parseInt(match[1], 10);
                if (num > maxNumber) maxNumber = num;
            }
        }
    });

    const nextNumber = (maxNumber + 1).toString().padStart(3, '0');
    const monthRoman = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"][new Date().getMonth()];
    
    return `903/${nextNumber}/SPM/32.16.19.2006/${monthRoman}/${baseYear}`;
  },

  // --- EMPLOYEES ---
  getEmployees: async (): Promise<Employee[]> => {
    let localEmployees: Employee[] = [];
    try {
        const localRaw = localStorage.getItem(LS_KEYS.EMPLOYEES);
        if (localRaw) localEmployees = JSON.parse(localRaw);
    } catch (e) {}

    try {
        const cloudData = await callApi('employees', 'GET', null, {}, 3000);
        if (cloudData && Array.isArray(cloudData)) {
            localStorage.setItem(LS_KEYS.EMPLOYEES, JSON.stringify(cloudData));
            return cloudData;
        }
    } catch (e) {}

    return localEmployees;
  },

  saveEmployee: async (employee: Employee): Promise<void> => {
    // Save Local first
    try {
        const raw = localStorage.getItem(LS_KEYS.EMPLOYEES);
        const list: Employee[] = raw ? JSON.parse(raw) : [];
        const index = list.findIndex(e => e.id === employee.id);
        if (index >= 0) list[index] = employee;
        else list.push(employee);
        localStorage.setItem(LS_KEYS.EMPLOYEES, JSON.stringify(list));
    } catch (e) {}

    // Save Cloud
    const res = await callApi('employees', 'POST', employee, {}, 4000);
    if (!res) {
        enqueueSync({ id: employee.id, action: 'saveEmployee', payload: employee });
    }
  },

  deleteEmployee: async (id: string): Promise<void> => {
    // Delete Local first
    try {
        const raw = localStorage.getItem(LS_KEYS.EMPLOYEES);
        if (raw) {
            const list: Employee[] = JSON.parse(raw);
            const newList = list.filter(e => e.id !== id);
            localStorage.setItem(LS_KEYS.EMPLOYEES, JSON.stringify(newList));
        }
    } catch (e) {}

    // Delete Cloud
    const res = await callApi('employees', 'DELETE', null, { id }, 4000);
    if (!res) {
        enqueueSync({ id, action: 'deleteEmployee', payload: null });
    }
  },

  // --- SETTINGS ---
  getSettings: async (): Promise<AppSettings> => {
    let settings = INITIAL_SETTINGS;

    // Load Local first
    try {
        const localRaw = localStorage.getItem(LS_KEYS.SETTINGS);
        if (localRaw) {
            settings = { ...settings, ...JSON.parse(localRaw) };
        }
    } catch (e) {}

    // Merge Cloud data if accessible within timeout
    try {
        const cloudData = await callApi('settings', 'GET', null, {}, 3000);
        if (cloudData && typeof cloudData === 'object') {
            settings = { 
                ...settings, 
                ...cloudData,
                budgetAllocations: {
                    ...settings.budgetAllocations,
                    ...(cloudData.budgetAllocations || {})
                }
            };
            localStorage.setItem(LS_KEYS.SETTINGS, JSON.stringify(settings));
        }
    } catch (e) {}
    
    return settings;
  },

  saveSettings: async (settings: AppSettings): Promise<void> => {
    // Save Local first
    try {
        localStorage.setItem(LS_KEYS.SETTINGS, JSON.stringify(settings));
    } catch (e) {
        console.error("Local save error", e);
        throw new Error("Penyimpanan penuh atau error browser. Gagal menyimpan pengaturan lokal.");
    }

    // Save Cloud
    const res = await callApi('settings', 'POST', settings, {}, 4000);
    if (!res) {
        enqueueSync({ id: 'app_settings', action: 'saveSettings', payload: settings });
    }
  }
};

// Automatic listener for online status to flush pending queue
if (typeof window !== 'undefined') {
    window.addEventListener('online', () => {
        console.log("Jaringan online kembali, melakukan sinkronisasi data tertunda...");
        StorageService.flushPendingSync().catch(() => {});
    });
}
