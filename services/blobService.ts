
export const BlobService = {
  /**
   * Mengonversi file menjadi Base64 string untuk disimpan langsung di database.
   * Ini menggantikan fungsi upload ke Vercel Blob/Storage eksternal.
   */
  upload: async (file: File | Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        // Hasilnya adalah string Base64 (data:image/jpeg;base64,...)
        resolve(reader.result as string);
      };
      reader.onerror = (error) => {
        console.error("Gagal mengonversi file:", error);
        reject(error);
      };
    });
  },

  /**
   * Helper untuk mengubah Base64 string (dari kamera/canvas) menjadi Blob object
   * Berguna jika nanti ingin mengunduh kembali file tersebut sebagai blob
   */
  base64ToBlob: (base64: string, mimeType: string): Blob => {
    // Cek jika base64 memiliki header data URI, jika ya, hapus dulu
    const base64Data = base64.includes(',') ? base64.split(',')[1] : base64;
    
    const byteString = atob(base64Data);
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) {
      ia[i] = byteString.charCodeAt(i);
    }
    return new Blob([ab], { type: mimeType });
  }
};
