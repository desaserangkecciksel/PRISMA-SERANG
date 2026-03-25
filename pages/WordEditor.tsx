import React, { useState, useRef, useEffect } from 'react';
import { Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight, AlignJustify, FileText, FolderOpen, RefreshCw, Printer, Code, Copy, X, Check } from 'lucide-react';
import { StorageService } from '../services/storageService';
import { LetterData, AppSettings } from '../types';
import { INITIAL_SETTINGS } from '../constants';

const WordEditor: React.FC = () => {
  const editorRef = useRef<HTMLDivElement>(null);
  const [settings, setSettings] = useState<AppSettings>(INITIAL_SETTINGS);
  const [archivedLetters, setArchivedLetters] = useState<LetterData[]>([]);
  const [selectedLetterId, setSelectedLetterId] = useState<string>('');
  const [docType, setDocType] = useState<'SPM' | 'SPP' | 'BA'>('SPM');
  
  // HTML Source Modal State
  const [showSourceModal, setShowSourceModal] = useState(false);
  const [sourceCode, setSourceCode] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
        const letters = await StorageService.getLetters();
        setArchivedLetters(letters);
        const s = await StorageService.getSettings();
        setSettings(s);

        if (editorRef.current && editorRef.current.innerHTML === '') {
            editorRef.current.innerHTML = `<p style="text-align:center; color: #888; margin-top: 50px;">Silahkan pilih surat dari arsip untuk diedit...</p>`;
        }
    };
    fetchData();
  }, []);

  const formatDoc = (cmd: string, value: string | undefined = undefined) => {
    document.execCommand(cmd, false, value);
    if (editorRef.current) {
        editorRef.current.focus();
    }
  };

  const handlePrint = () => {
    if (!editorRef.current) return;
    
    const printWindow = window.open('', '', 'width=800,height=600');
    if (printWindow) {
        printWindow.document.write(`
            <html>
                <head>
                    <title>Cetak Dokumen</title>
                    <style>
                        @page { 
                            size: 215.9mm 330.2mm;
                            margin: 15mm 20mm 15mm 20mm;
                        }
                        body { 
                            font-family: 'Times New Roman', serif; 
                            margin: 0;
                            padding: 0;
                            -webkit-print-color-adjust: exact; 
                            print-color-adjust: exact;
                            font-size: 11pt;
                            line-height: 1.5;
                        }
                        .print-content { width: 100%; }
                        table { width: 100%; border-collapse: collapse; }
                        th, td { padding: 4px; vertical-align: top; border: 1px solid black; }
                        .no-border td { border: none !important; }
                        h3 { font-size: 14pt; margin-bottom: 5px; }
                        p { margin: 5px 0; }
                    </style>
                </head>
                <body>
                    <div class="print-content">
                        ${editorRef.current.innerHTML}
                    </div>
                    <script>
                        window.onload = function() { 
                            setTimeout(function() {
                                window.print(); 
                                window.close(); 
                            }, 500);
                        }
                    </script>
                </body>
            </html>
        `);
        printWindow.document.close();
    }
  };

  const handleViewSource = () => {
    if (editorRef.current) {
        setSourceCode(editorRef.current.innerHTML);
        setShowSourceModal(true);
        setCopied(false);
    }
  };

  const handleCopySource = () => {
    navigator.clipboard.writeText(sourceCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const generateHTML = () => {
    const data = archivedLetters.find(l => l.id === selectedLetterId);
    if (!data) {
        alert("Silahkan pilih surat dari arsip terlebih dahulu.");
        return;
    }

    const currentYear = new Date().getFullYear();
    const sourceFundText = `${data.sourceFund || ''} APBDes T.A ${currentYear}`;
    const formatDate = (d: string) => new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

    const headerHtml = `
        <div style="text-align: center; margin-bottom: 10px; border-bottom: 3px double black; padding-bottom: 5px; position: relative;">
             ${settings.headerImage ? `<img src="${settings.headerImage}" style="position: absolute; left: 0; top: 0; width: 25mm; height: auto;" />` : ''}
            <h3 style="margin:0; font-size: 14pt; font-weight: bold; font-family: Helvetica, Arial, sans-serif;">${settings.headerTitle.replace(/\n/g, '<br>')}</h3>
            <p style="margin:2px 0 0 0; font-size: 10pt; font-family: Helvetica, Arial, sans-serif;">${settings.headerSubtitle}</p>
            <p style="margin:0; font-size: 9pt; color: blue; font-family: Helvetica, Arial, sans-serif;">${settings.address}</p>
        </div>
    `;

    let contentHtml = '';

    if (docType === 'SPM') {
        contentHtml = `
            ${headerHtml}
            <div style="text-align: center; margin-bottom: 15px;">
                <h3 style="text-decoration: underline; margin: 0; font-family: Helvetica, Arial, sans-serif;">SURAT PERINTAH MEMBAYAR</h3>
            </div>
            <table class="no-border" style="width: 100%; margin-bottom: 10px; font-family: Helvetica, Arial, sans-serif; font-size: 11pt;">
                <tr><td width="160">No. Surat</td><td width="10">:</td><td>${data.letterNumber}</td></tr>
                <tr><td>Sifat</td><td>:</td><td>${data.nature}</td></tr>
                <tr><td>Lampiran</td><td>:</td><td>${data.attachment}</td></tr>
                <tr><td>Hal</td><td>:</td><td>${data.subject}</td></tr>
            </table>

            <p style="font-family: Helvetica, Arial, sans-serif; font-size: 11pt;">Yang bertandatangan dibawah ini,</p>
            <table class="no-border" style="width: 100%; margin-bottom: 10px; font-family: Helvetica, Arial, sans-serif; font-size: 11pt;">
                <tr><td width="160">Nama</td><td width="10">:</td><td>1. ${data.signatoryName1}</td></tr>
                ${data.signatoryName2 ? `<tr><td></td><td></td><td>2. ${data.signatoryName2}</td></tr>` : ''}
                <tr><td>No. KTP</td><td>:</td><td>1. ${data.ktp1}</td></tr>
                ${data.ktp2 ? `<tr><td></td><td></td><td>2. ${data.ktp2}</td></tr>` : ''}
                <tr><td>Atas Nama Rekening</td><td>:</td><td>${data.accountHolder}</td></tr>
                <tr><td>Nomor Rekening</td><td>:</td><td>${data.accountNumber}</td></tr>
            </table>

            <p style="font-family: Helvetica, Arial, sans-serif; font-size: 11pt;">Menindaklanjuti:</p>
            <table class="no-border" style="width: 100%; margin-bottom: 10px; font-family: Helvetica, Arial, sans-serif; font-size: 11pt;">
                <tr><td width="160">Surat Permohonan No</td><td width="10">:</td><td>${data.requestLetterNumber}</td></tr>
                <tr><td>PKA</td><td>:</td><td>${data.pkaName}</td></tr>
                <tr><td>SPP Nomor</td><td>:</td><td>${data.sppNumber}</td></tr>
                <tr><td>DPA</td><td>:</td><td>${data.dpa}</td></tr>
                <tr><td>Sumber Dana / T.A</td><td>:</td><td>${sourceFundText}</td></tr>
                <tr><td>Bidang</td><td>:</td><td>${data.field}</td></tr>
                <tr><td>Sub. Bidang</td><td>:</td><td>${data.subField}</td></tr>
                <tr><td>Kegiatan</td><td>:</td><td>${data.activity}</td></tr>
            </table>

            <p style="text-align: justify; font-family: Helvetica, Arial, sans-serif; font-size: 11pt;">Maka dengan ini kami mohon kepada Kepala Urusan Keuangan untuk dapat melakukan pemindahbukuan dan mentransfer sejumlah dana sesuai dengan rincian sebagai berikut :</p>
            
            <table border="1" style="width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 10pt; font-family: Helvetica, Arial, sans-serif;">
                <tr style="text-align: center; font-weight: bold; background-color: #f8fafc;">
                    <td rowspan="2" style="vertical-align: middle;">No</td>
                    <td rowspan="2" style="vertical-align: middle;">Nama Penerima</td>
                    <td rowspan="2" style="vertical-align: middle;">No. Rekening</td>
                    <td rowspan="2" style="vertical-align: middle;">Nama Bank</td>
                    <td colspan="2">Nominal</td>
                    <td rowspan="2" style="vertical-align: middle;">Jumlah Transfer</td>
                </tr>
                <tr style="text-align: center; font-weight: bold; background-color: #f8fafc;">
                    <td>Jumlah Bruto</td>
                    <td>Potongan</td>
                </tr>
                ${data.items.map((item, i) => `
                <tr>
                    <td style="text-align: center;">${i + 1}</td>
                    <td>${item.recipientName}</td>
                    <td>${item.accountNumber}</td>
                    <td>${item.bankName}</td>
                    <td style="text-align: right;">Rp ${item.grossAmount.toLocaleString('id-ID')}</td>
                    <td style="text-align: right;">Rp ${item.deduction.toLocaleString('id-ID')}</td>
                    <td style="text-align: right;">Rp ${item.netTransfer.toLocaleString('id-ID')}</td>
                </tr>`).join('')}
                <tr style="font-weight: bold;">
                    <td colspan="6" style="text-align: right;">Total</td>
                    <td style="text-align: right;">Rp ${data.totalAmount.toLocaleString('id-ID')}</td>
                </tr>
            </table>
            <p style="font-family: Helvetica, Arial, sans-serif; font-size: 11pt; margin-top: 10px;">Terbilang: <i>${data.amountInWords}</i></p>

            <p style="text-align: justify; margin-top: 15px; font-family: Helvetica, Arial, sans-serif; font-size: 11pt;">Demikian Surat Perintah Membayar ini kami buat untuk dipergunakan sebagaimana mestinya dan akibat apapun yang mungkin timbul dari pelaksanaan pemindah bukuan dan transfer berdasarkan Dokumen terlampir.</p>

            <div style="margin-top: 30px; float: right; text-align: center; width: 250px; font-family: Helvetica, Arial, sans-serif; font-size: 11pt;">
                <p>${data.place}, ${formatDate(data.date)}</p>
                <p>Hormat Kami,</p>
                <p>PJ. KEPALA DESA SERANG</p>
                <br><br><br>
                <p style="font-weight: bold; text-decoration: underline;">${data.pjHeadVillage}</p>
            </div>
        `;
    } else if (docType === 'SPP') {
        contentHtml = `
            ${headerHtml}
            <div style="text-align: center; margin-bottom: 15px;">
                <h3 style="text-decoration: underline; margin: 0; font-family: Helvetica, Arial, sans-serif;">SURAT RINCIAN PERMOHONAN PEMBAYARAN</h3>
            </div>
            <table class="no-border" style="width: 100%; margin-bottom: 10px; font-family: Helvetica, Arial, sans-serif; font-size: 11pt;">
                <tr><td width="160">No. Surat</td><td width="10">:</td><td>${data.sppNumber}</td></tr>
                <tr><td>Sifat</td><td>:</td><td>${data.nature}</td></tr>
                <tr><td>Lampiran</td><td>:</td><td>${data.attachment}</td></tr>
                <tr><td>Hal</td><td>:</td><td>${data.subject}</td></tr>
            </table>
            <p style="font-family: Helvetica, Arial, sans-serif; font-size: 11pt;">Yang bertandatangan dibawah ini Pelaksana Kegiatan Anggaran:</p>
            <table class="no-border" style="width: 100%; margin-bottom: 10px; font-family: Helvetica, Arial, sans-serif; font-size: 11pt;">
                <tr><td width="160">Nama</td><td width="10">:</td><td>${data.pkaName}</td></tr>
                <tr><td>Jabatan</td><td>:</td><td>${data.pkaPosition}</td></tr>
                <tr><td>Sumber Dana / T.A</td><td>:</td><td>${sourceFundText}</td></tr>
                <tr><td>Kegiatan</td><td>:</td><td>${data.activity}</td></tr>
            </table>
            <p style="text-align: justify; font-family: Helvetica, Arial, sans-serif; font-size: 11pt;">Mengajukan Permohonan Pembayaran untuk Pelaksanaan Kegiatan dengan rincian sebagai berikut:</p>
            <table border="1" style="width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 10pt; font-family: Helvetica, Arial, sans-serif;">
                <tr style="text-align: center; font-weight: bold; background-color: #f8fafc;">
                    <td>No</td><td>Penerima</td><td>Rekening</td><td>Bruto</td><td>Potongan</td><td>Netto</td>
                </tr>
                ${data.items.map((item, i) => `
                <tr>
                    <td style="text-align: center;">${i+1}</td>
                    <td>${item.recipientName}</td>
                    <td>${item.accountNumber}</td>
                    <td style="text-align: right;">${item.grossAmount.toLocaleString('id-ID')}</td>
                    <td style="text-align: right;">${item.deduction.toLocaleString('id-ID')}</td>
                    <td style="text-align: right;">${item.netTransfer.toLocaleString('id-ID')}</td>
                </tr>`).join('')}
            </table>
            <div style="margin-top: 30px; display: flex; justify-content: space-between; text-align: center; font-family: Helvetica, Arial, sans-serif; font-size: 10pt;">
                <div style="width: 30%;"><p>Menyetujui,</p><p>Kades</p><br><br><p>${data.pjHeadVillage}</p></div>
                <div style="width: 30%;"><p>Verifikasi,</p><p>Sekdes</p><br><br><p>${data.secretary}</p></div>
                <div style="width: 30%;"><p>Pemohon,</p><p>PKA</p><br><br><p>${data.pkaSignatory}</p></div>
            </div>
        `;
    } else {
        contentHtml = `
            ${headerHtml}
            <div style="text-align: center; margin-bottom: 20px;">
                <h3 style="text-decoration: underline; margin: 0; font-family: Helvetica, Arial, sans-serif;">BERITA ACARA PELAKSANAAN KEGIATAN</h3>
            </div>
            <p style="text-align: justify; font-family: Helvetica, Arial, sans-serif; font-size: 11pt;">Pada hari ini ${new Date(data.date).toLocaleDateString('id-ID', {weekday:'long'})} Tanggal ${formatDate(data.date)}, telah dilaksanakan pemeriksaan pekerjaan untuk kegiatan:</p>
            <table class="no-border" style="width: 100%; margin: 15px 0; font-family: Helvetica, Arial, sans-serif; font-size: 11pt;">
                <tr><td width="160">Kegiatan</td><td width="10">:</td><td>${data.activity}</td></tr>
                <tr><td>No. SPM</td><td>:</td><td>${data.letterNumber}</td></tr>
                <tr><td>Sumber Dana</td><td>:</td><td>${sourceFundText}</td></tr>
            </table>
            <p style="text-align: justify; font-family: Helvetica, Arial, sans-serif; font-size: 11pt;">Demikian Berita Acara ini dibuat untuk dipergunakan sebagaimana mestinya.</p>
            <div style="margin-top: 50px; display: flex; justify-content: space-around; text-align: center; font-family: Helvetica, Arial, sans-serif; font-size: 11pt;">
                <div><p>PKA</p><br><br><br><p><b>${data.pkaSignatory}</b></p></div>
                <div><p>Sekretaris Desa</p><br><br><br><p><b>${data.secretary}</b></p></div>
            </div>
        `;
    }

    if (editorRef.current) {
        editorRef.current.innerHTML = contentHtml;
    }
  };

  const ToolbarButton = ({ icon: Icon, onClick, active = false }: any) => (
    <button 
        onClick={onClick}
        className={`p-2 rounded hover:bg-slate-200 transition-colors ${active ? 'bg-slate-300 text-black' : 'text-slate-600'}`}
    >
        <Icon size={18} />
    </button>
  );

  return (
    <div className="h-[calc(100vh-140px)] flex flex-col space-y-4 animate-fade-in text-black">
        <div className="flex justify-between items-center">
             <h2 className="text-3xl font-extrabold text-black tracking-tight flex items-center">
                <FileText className="mr-3 text-blue-600"/> 
                Editor Surat (TinyWord)
            </h2>
            <div className="flex gap-2">
                <button onClick={handleViewSource} className="flex items-center px-4 py-2 bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-300 rounded-xl font-bold transition-all">
                    <Code size={18} className="mr-2" /> Lihat HTML
                </button>
                <button onClick={handlePrint} className="flex items-center px-6 py-2 bg-slate-800 text-white rounded-xl shadow hover:bg-black font-bold transition-all">
                    <Printer size={18} className="mr-2" /> Cetak Dokumen Editor
                </button>
            </div>
        </div>

        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
                <FolderOpen size={20} className="text-teal-600" />
                <span className="font-bold text-sm">Pilih Data:</span>
                <select 
                    className="border border-slate-300 rounded-lg p-2 text-sm bg-slate-50 min-w-[200px]"
                    value={selectedLetterId}
                    onChange={(e) => setSelectedLetterId(e.target.value)}
                >
                    <option value="">-- Pilih Surat dari Arsip --</option>
                    {archivedLetters.map(l => (
                        <option key={l.id} value={l.id}>{l.letterNumber} - {l.activity.substring(0,30)}...</option>
                    ))}
                </select>
            </div>
            
            <div className="flex items-center gap-2">
                <span className="font-bold text-sm">Tipe Dokumen:</span>
                <select 
                    className="border border-slate-300 rounded-lg p-2 text-sm bg-slate-50"
                    value={docType}
                    onChange={(e) => setDocType(e.target.value as any)}
                >
                    <option value="SPM">SPM (Perintah Bayar)</option>
                    <option value="SPP">SPP (Permohonan)</option>
                    <option value="BA">Berita Acara</option>
                </select>
            </div>

            <button 
                onClick={generateHTML}
                className="flex items-center px-4 py-2 bg-teal-100 text-teal-800 rounded-lg hover:bg-teal-200 font-bold text-sm transition-colors"
            >
                <RefreshCw size={16} className="mr-2" /> Muat Template
            </button>
        </div>

        <div className="flex-1 bg-white border border-slate-300 rounded-xl shadow-lg flex flex-col overflow-hidden">
            <div className="bg-slate-100 border-b border-slate-300 p-2 flex space-x-2 items-center flex-wrap">
                <ToolbarButton icon={Bold} onClick={() => formatDoc('bold')} />
                <ToolbarButton icon={Italic} onClick={() => formatDoc('italic')} />
                <ToolbarButton icon={Underline} onClick={() => formatDoc('underline')} />
                <div className="w-px h-6 bg-slate-300 mx-2" />
                <ToolbarButton icon={AlignLeft} onClick={() => formatDoc('justifyLeft')} />
                <ToolbarButton icon={AlignCenter} onClick={() => formatDoc('justifyCenter')} />
                <ToolbarButton icon={AlignRight} onClick={() => formatDoc('justifyRight')} />
                <ToolbarButton icon={AlignJustify} onClick={() => formatDoc('justifyFull')} />
            </div>

            <div className="flex-1 overflow-auto bg-slate-500 p-8 flex justify-center">
                <div 
                    ref={editorRef}
                    contentEditable
                    className="bg-white w-[215.9mm] min-h-[330.2mm] shadow-2xl p-[20mm] outline-none text-black font-serif"
                    style={{ lineHeight: '1.5' }}
                >
                </div>
            </div>
        </div>

        {/* Source Code Modal */}
        {showSourceModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
                <div className="bg-white rounded-2xl w-full max-w-4xl h-[80vh] flex flex-col shadow-2xl animate-scale-up overflow-hidden">
                    <div className="flex justify-between items-center p-4 border-b border-slate-200 bg-slate-50">
                        <h3 className="text-lg font-bold text-slate-800 flex items-center">
                            <Code className="mr-2 text-teal-600" /> HTML Source Code
                        </h3>
                        <div className="flex gap-2">
                            <button 
                                onClick={handleCopySource}
                                className={`flex items-center px-3 py-1.5 rounded-lg font-bold text-sm transition-all ${copied ? 'bg-green-100 text-green-700' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'}`}
                            >
                                {copied ? <Check size={16} className="mr-1" /> : <Copy size={16} className="mr-1" />}
                                {copied ? 'Tersalin!' : 'Salin Kode'}
                            </button>
                            <button 
                                onClick={() => setShowSourceModal(false)}
                                className="p-1.5 rounded-lg bg-slate-200 text-slate-500 hover:bg-red-100 hover:text-red-500 transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>
                    </div>
                    <div className="flex-1 p-0 relative">
                        <textarea 
                            className="w-full h-full p-4 font-mono text-xs bg-slate-900 text-green-400 resize-none focus:outline-none"
                            value={sourceCode}
                            readOnly
                        ></textarea>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};

export default WordEditor;