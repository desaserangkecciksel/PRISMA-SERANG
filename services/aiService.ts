
import { GoogleGenAI } from "@google/genai";

const getApiKey = () => {
    // Mengakses API Key dari environment variable
    return process.env.API_KEY;
};

export const AIService = {
    /**
     * Menghasilkan deskripsi transaksi otomatis berdasarkan konteks menggunakan Gemini.
     */
    generateDescription: async (recipientName: string, amount: number, activity: string): Promise<string> => {
        const apiKey = getApiKey();
        if (!apiKey) {
            console.warn("API_KEY tidak ditemukan.");
            return `Pembayaran kepada ${recipientName}`;
        }

        try {
            const ai = new GoogleGenAI({ apiKey });
            
            // Menggunakan model Gemini 2.5 Flash Lite agar cepat dan hemat
            const modelId = 'gemini-2.5-flash-lite-latest';
            
            const prompt = `
                Buat deskripsi transaksi keuangan formal untuk Desa (maksimal 10-15 kata).
                Penerima: ${recipientName}
                Nominal: Rp ${amount}
                Kegiatan Desa: ${activity}
                
                Contoh: Belanja Jasa Honorarium Tim Pelaksana Kegiatan.
                Output (Hanya teks deskripsi):
            `;

            const response = await ai.models.generateContent({
                model: modelId,
                contents: prompt,
            });

            return response.text?.trim() || `Pembayaran kepada ${recipientName}`;
        } catch (error) {
            console.error("AI Service Error:", error);
            // Fallback jika AI gagal/limit habis
            return `Pembayaran honorarium/jasa kepada ${recipientName}`;
        }
    }
};
