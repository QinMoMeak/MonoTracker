
import { Item, AppState } from "../types";

const STORAGE_KEY = "monotracker_data";

export const loadState = (): Partial<AppState> => {
  try {
    const serialized = localStorage.getItem(STORAGE_KEY);
    if (!serialized) return {};
    return JSON.parse(serialized);
  } catch (e) {
    console.error("Failed to load state", e);
    return {};
  }
};

export const saveState = (state: AppState) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error("Failed to save state", e);
  }
};

export const exportCSV = (items: Item[]): string => {
  const headers = ["id", "type", "name", "price", "msrp", "purchaseDate", "status", "category", "channel", "note", "usageCount", "priceHistory"];
  const rows = items.map(item => 
    headers.map(key => {
      let val = (item as any)[key];
      if (key === 'priceHistory') {
        val = Array.isArray(val) ? JSON.stringify(val) : '';
      }
      // Escape quotes and wrap in quotes
      return `"${String(val || '').replace(/"/g, '""')}"`;
    }).join(",")
  );
  return [headers.join(","), ...rows].join("\n");
};

export const importCSV = (csv: string): Item[] => {
  const lines = csv.split("\n");
  const headers = lines[0].split(",").map(h => h.replace(/"/g, '').trim());
  const items: Item[] = [];

  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    
    // Simple regex for CSV parsing (handles quoted commas)
    const values = lines[i].match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g);
    
    if (values) {
        const item: any = {};
        headers.forEach((h, index) => {
             const val = values[index] ? values[index].replace(/^"|"$/g, '').replace(/""/g, '"') : '';
             if (h === 'price' || h === 'msrp' || h === 'usageCount') {
                 item[h] = parseFloat(val) || 0;
             } else if (h === 'priceHistory') {
                 try {
                     const parsed = JSON.parse(val);
                     item[h] = Array.isArray(parsed) ? parsed : [];
                 } catch {
                     item[h] = [];
                 }
             } else {
                 item[h] = val;
             }
        });
        // Ensure required fields
        if (!item.id) item.id = Date.now().toString(36) + Math.random().toString(36).substr(2);
        if (!item.image) item.image = undefined; // Don't keep broken images
        if (!item.category) item.category = 'other'; // Default category
        items.push(item as Item);
    }
  }
  return items;
};
