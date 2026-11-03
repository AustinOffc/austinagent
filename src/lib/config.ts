// Satu-satunya sumber konfigurasi frontend. Tidak ada URL produksi yang di-hardcode.
export const API_URL = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/+$/, '');
