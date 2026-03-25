import { LetterData, AppSettings, Employee } from '../types';
import { INITIAL_SETTINGS } from '../constants';

const LS_KEYS = {
    LETTERS: 'espm_letters_local',
    SETTINGS: 'espm_settings_local',
    EMPLOYEES: 'espm_employees_local'
};

// Base URL for PHP API (Hostinger)
const API_URL = 'https://apbdesdesaserang.id/api.php';

const callApi = async (action: string, method: string = 'GET', body: any = null, params: Record<string, string> = {}) => {
    try {
        let url = `${API_URL}?action=${action}`;
        Object.entries(params).forEach(([key, val]) => {
            url += `&${key}=${encodeURIComponent(val)}`;
        });

        const options: RequestInit = {
            method,
            headers: {
                'Content-Type': 'application/json',
            },
        };

        if (body) {
            options.body = JSON.stringify(body);
        }

        const response = await fetch(url, options);
        if (!response.ok) throw new Error(`API Error: ${response.statusText}`);
        return await response.json();
    } catch (e) {
        console.warn(`API call failed for ${action}:`, e);
        return null;
    }
};

export const StorageService = {
  // --- LETTERS ---
  getLetters: async (): Promise<LetterData[]> => {
    const cloudData = await callApi('letters');
    
    if (cloudData && Array.isArray(cloudData)) {
        localStorage.setItem(LS_KEYS.LETTERS, JSON.stringify(cloudData));
        return cloudData;
    }

    // Fallback Local
    try {
        const localRaw = localStorage.getItem(LS_KEYS.LETTERS);
        return localRaw ? JSON.parse(localRaw) : [];
    } catch (e) { 
        return []; 
    }
  },

  saveLetter: async (letter: LetterData): Promise<void> => {
    // Save to Local first (Optimistic UI)
    try {
        const raw = localStorage.getItem(LS_KEYS.LETTERS);
        const list: LetterData[] = raw ? JSON.parse(raw) : [];
        const index = list.findIndex(l => l.id === letter.id);
        if (index >= 0) list[index] = letter;
        else list.unshift(letter);
        localStorage.setItem(LS_KEYS.LETTERS, JSON.stringify(list));
    } catch (e) { console.error("Local save error", e); }

    // Save to Cloud (PHP API)
    await callApi('letters', 'POST', letter);
  },

  deleteLetter: async (id: string): Promise<void> => {
    // Delete Local
    try {
        const raw = localStorage.getItem(LS_KEYS.LETTERS);
        if (raw) {
            const list: LetterData[] = JSON.parse(raw);
            const newList = list.filter(l => l.id !== id);
            localStorage.setItem(LS_KEYS.LETTERS, JSON.stringify(newList));
        }
    } catch(e) {}

    // Delete Cloud (PHP API)
    await callApi('letters', 'DELETE', null, { id });
  },

  getNextSPMNumber: async (baseYear: number): Promise<string> => {
    const cloudData = await callApi('letters');
    const letters: LetterData[] = cloudData && Array.isArray(cloudData) ? cloudData : [];
    
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
    const cloudData = await callApi('employees');

    if (cloudData && Array.isArray(cloudData)) {
        localStorage.setItem(LS_KEYS.EMPLOYEES, JSON.stringify(cloudData));
        return cloudData;
    }

    try {
        const localRaw = localStorage.getItem(LS_KEYS.EMPLOYEES);
        return localRaw ? JSON.parse(localRaw) : [];
    } catch (e) { return []; }
  },

  saveEmployee: async (employee: Employee): Promise<void> => {
    // Save Local
    try {
        const raw = localStorage.getItem(LS_KEYS.EMPLOYEES);
        const list: Employee[] = raw ? JSON.parse(raw) : [];
        const index = list.findIndex(e => e.id === employee.id);
        if (index >= 0) list[index] = employee;
        else list.push(employee);
        localStorage.setItem(LS_KEYS.EMPLOYEES, JSON.stringify(list));
    } catch (e) {}

    // Save Cloud (PHP API)
    await callApi('employees', 'POST', employee);
  },

  deleteEmployee: async (id: string): Promise<void> => {
    // Delete Local
    try {
        const raw = localStorage.getItem(LS_KEYS.EMPLOYEES);
        if (raw) {
            const list: Employee[] = JSON.parse(raw);
            const newList = list.filter(e => e.id !== id);
            localStorage.setItem(LS_KEYS.EMPLOYEES, JSON.stringify(newList));
        }
    } catch(e) {}

    // Delete Cloud (PHP API)
    await callApi('employees', 'DELETE', null, { id });
  },

  // --- SETTINGS ---
  getSettings: async (): Promise<AppSettings> => {
    let settings = INITIAL_SETTINGS;
    let loadedFromCloud = false;

    const cloudData = await callApi('settings');

    if (cloudData) {
        settings = { 
            ...settings, 
            ...cloudData,
            budgetAllocations: {
                ...settings.budgetAllocations,
                ...(cloudData.budgetAllocations || {})
            }
        };
        localStorage.setItem(LS_KEYS.SETTINGS, JSON.stringify(settings));
        loadedFromCloud = true;
    }

    if (!loadedFromCloud) {
        try {
            const localRaw = localStorage.getItem(LS_KEYS.SETTINGS);
            if (localRaw) {
                settings = { ...settings, ...JSON.parse(localRaw) };
            }
        } catch (e) {}
    }
    
    return settings;
  },

  saveSettings: async (settings: AppSettings): Promise<void> => {
    // Save Local
    try {
        localStorage.setItem(LS_KEYS.SETTINGS, JSON.stringify(settings));
    } catch (e) {
        console.error("Local save error", e);
        throw new Error("Penyimpanan penuh atau error browser. Gagal menyimpan pengaturan lokal.");
    }

    // Save Cloud (PHP API)
    await callApi('settings', 'POST', settings);
  }
};
