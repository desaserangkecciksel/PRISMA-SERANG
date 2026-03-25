
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { LetterData, AppSettings } from '../types';

// Constants for F4/Folio Paper (8.5 x 13 inches) -> 215.9mm x 330.2mm
const PAGE_WIDTH = 215.9;
const PAGE_HEIGHT = 330.2;
const MARGIN_LEFT = 20;
const MARGIN_RIGHT = 20;

// Helper to detect image format from Data URI
const getImageFormat = (dataUrl: string): string => {
    if (!dataUrl) return 'JPEG';
    if (dataUrl.startsWith('data:image/png')) return 'PNG';
    return 'JPEG';
};

const drawHeader = (doc: jsPDF, settings: AppSettings) => {
  const centerX = PAGE_WIDTH / 2;
  
  // Jika Full Header Image (gambar menggantikan seluruh header teks)
  if (settings.isFullHeader && settings.headerImage) {
    try {
        const imgProps = doc.getImageProperties(settings.headerImage);
        // Lebar gambar disesuaikan dengan lebar area konten (Page Width - Margins)
        // Kita gunakan full width printable area
        const targetWidth = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT;
        // Hitung tinggi proporsional
        const targetHeight = (imgProps.height * targetWidth) / imgProps.width;
        
        // Render gambar mulai dari top margin (10mm dari atas)
        // Gunakan format dinamis sesuai data source
        const format = getImageFormat(settings.headerImage);
        doc.addImage(settings.headerImage, format, MARGIN_LEFT, 10, targetWidth, targetHeight);
        
        // Return Y position tepat di bawah gambar + sedikit padding
        return 10 + targetHeight + 5; 
    } catch (e) {
        console.error("Error rendering full header", e);
        // Fallback ke text header jika gagal render image
    }
  }

  // Normal Header Logic (Logo + Text)
  if (settings.headerImage) {
    try {
      // Get original image properties to calculate correct height based on desired width
      const imgProps = doc.getImageProperties(settings.headerImage);
      const targetWidth = 25;
      const targetHeight = (imgProps.height * targetWidth) / imgProps.width;
      
      // Limit the height to 30mm to prevent it from pushing down too far
      const finalHeight = Math.min(targetHeight, 30);
      const finalWidth = (imgProps.width * finalHeight) / imgProps.height;

      // Render logo at the top left corner of the header area
      const format = getImageFormat(settings.headerImage);
      doc.addImage(settings.headerImage, format, 20, 10, finalWidth, finalHeight);
    } catch (e) {
      console.error("Error rendering logo", e);
    }
  }

  // Header Text
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  const titleLines = settings.headerTitle.split('\n');
  let yPos = 15;
  titleLines.forEach(line => {
    doc.text(line, centerX, yPos, { align: 'center' });
    yPos += 6;
  });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(settings.headerSubtitle, centerX, yPos, { align: 'center' });
  yPos += 5;
  doc.setFontSize(9);
  doc.setTextColor(0, 0, 255); // Blue for email/web
  doc.text(settings.address, centerX, yPos, { align: 'center' });
  doc.setTextColor(0, 0, 0); // Reset black

  // Double Line separator - Tightened spacing
  doc.setLineWidth(1);
  doc.line(MARGIN_LEFT, yPos + 2, PAGE_WIDTH - MARGIN_RIGHT, yPos + 2);
  doc.setLineWidth(0.5);
  doc.line(MARGIN_LEFT, yPos + 3.2, PAGE_WIDTH - MARGIN_RIGHT, yPos + 3.2);

  return yPos + 10; 
};

const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
}

export const generateSPM = (data: LetterData, settings: AppSettings) => {
  const doc = new jsPDF({ format: [PAGE_WIDTH, PAGE_HEIGHT], unit: 'mm' });
  let y = drawHeader(doc, settings);

  // Title
  const title = 'SURAT PERINTAH MEMBAYAR';
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  const titleWidth = doc.getTextWidth(title);
  doc.text(title, PAGE_WIDTH / 2, y, { align: 'center' });
  doc.setLineWidth(0.5);
  doc.line((PAGE_WIDTH / 2) - (titleWidth / 2), y + 1, (PAGE_WIDTH / 2) + (titleWidth / 2), y + 1);
  y += 10;

  // Key Value Lists
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11); 
  doc.setTextColor(0, 0, 0);

  const leftColX = MARGIN_LEFT;
  const colGap = 75; 
  const lineHeight = 5;

  const row = (label: string, value: string) => {
    const valueX = leftColX + colGap;
    const maxWidth = PAGE_WIDTH - MARGIN_RIGHT - valueX;
    const textValue = value || '-';
    
    // Split text to fit width
    const splitValue = doc.splitTextToSize(textValue, maxWidth);
    
    doc.text(label, leftColX, y);
    doc.text(':', leftColX + colGap - 5, y);
    doc.text(splitValue, valueX, y);
    
    // Calculate vertical offset based on lines
    const lines = Array.isArray(splitValue) ? splitValue.length : 1;
    y += lines * lineHeight;
    
    // Add extra spacing for multi-line items to improve readability
    if (lines > 1) y += 2;
  };

  row('No. Surat', data.letterNumber);
  row('Sifat', data.nature);
  row('Lampiran', data.attachment);
  row('Hal', data.subject);
  
  // Add spacing only if the last row wasn't multiline (to prevent double gap)
  // Simplified: just add a small fixed gap
  y += 2;

  doc.text('Yang bertandatangan dibawah ini,', leftColX, y);
  y += lineHeight;
  
  // Nama Signatories
  doc.text('Nama', leftColX, y);
  doc.text(':', leftColX + colGap - 5, y);
  if (data.signatoryName2) {
    doc.text(`1. ${data.signatoryName1}`, leftColX + colGap, y);
    y += lineHeight;
    doc.text(`2. ${data.signatoryName2}`, leftColX + colGap, y);
    y += lineHeight;
  } else {
    doc.text(data.signatoryName1, leftColX + colGap, y);
    y += lineHeight;
  }
  
  // No. KTP
  doc.text('No. KTP', leftColX, y);
  doc.text(':', leftColX + colGap - 5, y);
  if (data.ktp2) {
      doc.text(`1. ${data.ktp1}`, leftColX + colGap, y);
      y += lineHeight;
      doc.text(`2. ${data.ktp2}`, leftColX + colGap, y);
      y += lineHeight;
  } else {
      doc.text(data.ktp1, leftColX + colGap, y);
      y += lineHeight;
  }
  
  row('Atas Nama Rekening', data.accountHolder);
  row('Nomor Rekening', data.accountNumber);
  y += 2;

  doc.text('Menindaklanjuti', leftColX, y);
  y += lineHeight;
  row('Surat Permohonan Nomor', data.requestLetterNumber);
  
  row('Pelaksana Kegiatan Anggaran', data.pkaPosition);
  
  row('SPP Nomor', data.sppNumber);
  row('DPA', data.dpa);
  
  // Standardized formatting: [Fund] APBDes T.A [Year]
  const sourceFundText = `${data.sourceFund || ''} APBDes T.A ${data.fiscalYear || new Date().getFullYear()}`;
  row('Sumber Dana / T.A', sourceFundText);
  
  row('Bidang', data.field);
  row('Sub. Bidang', data.subField);
  row('Kegiatan', data.activity);
  y += lineHeight;

  const para = "Maka dengan ini kami mohon kepada Kepala Urusan Keuangan untuk dapat melakukan pemindahbukuan dan mentransfer sejumlah dana sesuai dengan rincian sebagai berikut :";
  const splitText = doc.splitTextToSize(para, PAGE_WIDTH - (MARGIN_LEFT * 2));
  doc.text(splitText, leftColX, y);
  y += (splitText.length * lineHeight) + 2;

  // Table
  const tableBody = (data.items || []).map((item, idx) => [
      (idx + 1).toString(),
      item.recipientName,
      item.accountNumber,
      item.bankName,
      `Rp ${item.grossAmount.toLocaleString('id-ID')}`,
      `Rp ${item.deduction.toLocaleString('id-ID')}`,
      `Rp ${item.netTransfer.toLocaleString('id-ID')}`
  ]);

  autoTable(doc, {
    startY: y,
    head: [[
        { content: 'No', rowSpan: 2, styles: { valign: 'middle', halign: 'center', fontStyle: 'bold' }},
        { content: 'Nama Penerima', rowSpan: 2, styles: { valign: 'middle', halign: 'center', fontStyle: 'bold' }},
        { content: 'No. Rekening', rowSpan: 2, styles: { valign: 'middle', halign: 'center', fontStyle: 'bold' }},
        { content: 'Nama Bank', rowSpan: 2, styles: { valign: 'middle', halign: 'center', fontStyle: 'bold' }},
        { content: 'Nominal', colSpan: 2, styles: { valign: 'middle', halign: 'center', fontStyle: 'bold' }},
        { content: 'Jumlah Transfer', rowSpan: 2, styles: { valign: 'middle', halign: 'center', fontStyle: 'bold' }}
    ],
    ['Jumlah Bruto', 'Potongan']
    ],
    body: tableBody,
    theme: 'plain',
    styles: { 
        lineColor: 0, 
        lineWidth: 0.2, 
        textColor: 0, 
        fontSize: 10,
        font: 'helvetica',
        cellPadding: 1
    },
    headStyles: { 
        fillColor: 255, 
        textColor: 0, 
        lineColor: 0, 
        lineWidth: 0.2 
    },
    columnStyles: {
        0: { cellWidth: 10, halign: 'center' },
        4: { halign: 'right' },
        5: { halign: 'right' },
        6: { halign: 'right' }
    }
  });

  // @ts-ignore
  y = doc.lastAutoTable.finalY + 8;

  row('Total', `Rp ${data.totalAmount.toLocaleString('id-ID')}`);
  row('Terbilang', `${data.amountInWords}`);
  
  y += 5;
  const footerText = "Demikian Surat Perintah Membayar ini kami buat untuk dipergunakan sebagaimana mestinya dan akibat apapun yang mungkin timbul dari pelaksanaan pemindah bukuan dan transfer berdasarkan Dokumen terlampir.";
  const footerSplit = doc.splitTextToSize(footerText, PAGE_WIDTH - (MARGIN_LEFT + MARGIN_RIGHT));
  doc.text(footerSplit, MARGIN_LEFT, y);

  // Signatures
  // Recalculate Y based on footer text length to avoid overlap
  y += (footerSplit.length * lineHeight) + 15;
  
  // Check if we need a new page for signatures
  if (y > PAGE_HEIGHT - 60) {
      doc.addPage();
      y = 30;
  }

  const rightX = PAGE_WIDTH - 60;
  doc.text(`${data.place}, ${formatDate(data.date)}`, rightX, y, { align: 'center' });
  y += 5;
  doc.text('Hormat Kami,', rightX, y, { align: 'center' });
  y += 5;
  doc.text('PJ. KEPALA DESA SERANG', rightX, y, { align: 'center' });
  y += 25;
  doc.setFont('helvetica', 'bold');
  doc.text(data.pjHeadVillage, rightX, y, { align: 'center' });
  doc.setFont('helvetica', 'normal');

  doc.save(`SPM-${data.letterNumber.replace(/\//g, '-')}.pdf`);
};

export const generateSPP = (data: LetterData, settings: AppSettings) => {
    const doc = new jsPDF({ format: [PAGE_WIDTH, PAGE_HEIGHT], unit: 'mm' });
    let y = drawHeader(doc, settings);
  
    // Title
    const title = 'SURAT RINCIAN PERMOHONAN PEMBAYARAN';
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    const titleWidth = doc.getTextWidth(title);
    doc.text(title, PAGE_WIDTH / 2, y, { align: 'center' });
    doc.setLineWidth(0.5);
    doc.line((PAGE_WIDTH / 2) - (titleWidth / 2), y + 1, (PAGE_WIDTH / 2) + (titleWidth / 2), y + 1);
    y += 10;
  
    // Key Value Lists
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(0, 0, 0);
  
    const leftColX = MARGIN_LEFT;
    const colGap = 75; 
    const lineHeight = 5;
  
    const row = (label: string, value: string) => {
      const valueX = leftColX + colGap;
      const maxWidth = PAGE_WIDTH - MARGIN_RIGHT - valueX;
      const textValue = value || '-';
      
      const splitValue = doc.splitTextToSize(textValue, maxWidth);
      
      doc.text(label, leftColX, y);
      doc.text(':', leftColX + colGap - 5, y);
      doc.text(splitValue, valueX, y);
      
      const lines = Array.isArray(splitValue) ? splitValue.length : 1;
      y += lines * lineHeight;
      if (lines > 1) y += 2;
    };
  
    row('No. Surat', data.sppNumber);
    row('Sifat', data.nature);
    row('Lampiran', data.attachment);
    row('Hal', data.subject);
    y += 2;
  
    doc.text('Yang bertandatangan dibawah ini Pelaksana Kegiatan Anggaran :', leftColX, y);
    y += lineHeight;
    
    row('Nama', data.pkaName);
    
    row('Pelaksana Kegiatan Anggaran', data.pkaPosition);
    
    row('SPP Nomor', data.sppNumber);
    row('DPA', data.dpa);
    
    // Standardized formatting: [Fund] APBDes T.A [Year]
    const sourceFundText = `${data.sourceFund || ''} APBDes T.A ${data.fiscalYear || new Date().getFullYear()}`;
    row('Sumber Dana / T.A', sourceFundText);

    row('Bidang', data.field);
    row('Sub. Bidang', data.subField);
    row('Kegiatan', data.activity);
    y += lineHeight;
  
    const introText = 'Mengajukan Permohonan Pembayaran untuk Pelaksanaan Kegiatan dengan rincian sebagai berikut :';
    const splitIntro = doc.splitTextToSize(introText, PAGE_WIDTH - (MARGIN_LEFT + MARGIN_RIGHT));
    doc.text(splitIntro, leftColX, y);
    y += (splitIntro.length * lineHeight) + 2;
  
    // Table
    const tableBody = (data.items || []).map((item, idx) => [
        (idx + 1).toString(),
        item.recipientName,
        item.accountNumber,
        item.bankName,
        `Rp ${item.grossAmount.toLocaleString('id-ID')}`,
        `Rp ${item.deduction.toLocaleString('id-ID')}`,
        `Rp ${item.netTransfer.toLocaleString('id-ID')}`,
        item.description || '-'
    ]);
  
    autoTable(doc, {
      startY: y,
      head: [[
          { content: 'No', rowSpan: 2, styles: { valign: 'middle', halign: 'center', fontStyle: 'bold' }},
          { content: 'Nama Penerima', rowSpan: 2, styles: { valign: 'middle', halign: 'center', fontStyle: 'bold' }},
          { content: 'No. Rekening', rowSpan: 2, styles: { valign: 'middle', halign: 'center', fontStyle: 'bold' }},
          { content: 'Nama Bank', rowSpan: 2, styles: { valign: 'middle', halign: 'center', fontStyle: 'bold' }},
          { content: 'Nominal', colSpan: 2, styles: { valign: 'middle', halign: 'center', fontStyle: 'bold' }},
          { content: 'Jumlah Transfer', rowSpan: 2, styles: { valign: 'middle', halign: 'center', fontStyle: 'bold' }},
          { content: 'Keterangan', rowSpan: 2, styles: { valign: 'middle', halign: 'center', fontStyle: 'bold' }}
      ],
      ['Jumlah Bruto', 'Potongan']
      ],
      body: tableBody,
      theme: 'plain',
      styles: { 
        lineColor: 0, 
        lineWidth: 0.2, 
        textColor: 0, 
        fontSize: 10,
        font: 'helvetica',
        cellPadding: 1
      },
      headStyles: { 
        fillColor: 255, 
        textColor: 0, 
        lineColor: 0, 
        lineWidth: 0.2 
      },
      columnStyles: {
          0: { cellWidth: 10, halign: 'center' },
          4: { halign: 'right' },
          5: { halign: 'right' },
          6: { halign: 'right' }
      }
    });
  
    // @ts-ignore
    y = doc.lastAutoTable.finalY + 8;
  
    row('Total', `Rp ${data.totalAmount.toLocaleString('id-ID')}`);
    row('Terbilang', `${data.amountInWords}`);
    
    y += 5;
    const footerText = "Demikian Surat Rincian ini kami sampaikan, harap maklum and dapat dipergunakan sebagaimana mestinya.";
    const footerSplit = doc.splitTextToSize(footerText, PAGE_WIDTH - (MARGIN_LEFT + MARGIN_RIGHT));
    doc.text(footerSplit, MARGIN_LEFT, y);
  
    // Signatures Area
    y += (footerSplit.length * lineHeight) + 10;
    
    // Check page overflow
    if (y > PAGE_HEIGHT - 70) {
        doc.addPage();
        y = 30;
    }

    const col1 = MARGIN_LEFT + 25;
    const col2 = PAGE_WIDTH / 2;
    const col3 = PAGE_WIDTH - 45;

    // TOP RIGHT: Date and PPKD/PKA Position
    doc.text(`${data.place}, ${formatDate(data.date)}`, col3, y, {align:'center'});
    y+= 5;
    doc.text('Pelaksana Pengelolaan Keuangan', col3, y, {align:'center'});
    y+= 5;
    doc.text('Desa (PPKD)', col3, y, {align:'center'});
    y+= 5;
    const pkaPositionValue = data.pkaPosition || 'Pelaksana Kegiatan';
    doc.text(pkaPositionValue, col3, y, {align:'center'});
    
    y+= 20; // Space for signature
    doc.setFont('helvetica', 'bold');
    doc.text(data.pkaSignatory, col3, y, {align: 'center'});
    doc.setFont('helvetica', 'normal');

    // MIDDLE ROW: Signatories
    y += 10;
    const yMiddle = y;
    doc.text('Disetujui Oleh,', col1, yMiddle, {align:'center'});
    doc.text('Diverifikasi Oleh,', col2, yMiddle, {align:'center'});
    doc.text('Dibayar Oleh,', col3, yMiddle, {align:'center'});

    y += 5;
    doc.text('Kuasa Pengguna Anggaran', col1, y, {align:'center'});
    doc.text('Sekretaris Desa', col2, y, {align:'center'});
    doc.text('Kaur Keuangan', col3, y, {align:'center'});

    y += 20;
    doc.setFont('helvetica', 'bold');
    doc.text(data.pjHeadVillage, col1, y, {align:'center'}); 
    doc.text(data.secretary, col2, y, {align:'center'});
    doc.text(data.financeOfficer, col3, y, {align:'center'});
    
    doc.save(`SPP-${data.sppNumber.replace(/\//g, '-')}.pdf`);
  };

export const generateBA = (data: LetterData, settings: AppSettings) => {
    const doc = new jsPDF({ format: [PAGE_WIDTH, PAGE_HEIGHT], unit: 'mm' });
    let y = drawHeader(doc, settings);
  
    // Title
    const title = 'BERITA ACARA PELAKSANAAN KEGIATAN';
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    const titleWidth = doc.getTextWidth(title);
    doc.text(title, PAGE_WIDTH / 2, y, { align: 'center' });
    doc.setLineWidth(0.5);
    doc.line((PAGE_WIDTH / 2) - (titleWidth / 2), y + 1, (PAGE_WIDTH / 2) + (titleWidth / 2), y + 1);
    y += 15;
  
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(0, 0, 0);

    const dateObj = new Date(data.date);
    const dayName = dateObj.toLocaleDateString('id-ID', { weekday: 'long' });
    const fullDate = formatDate(data.date);
    const pkaTitle = data.pkaPosition || 'Pelaksana Kegiatan Anggaran';

    const para1 = `Pada hari ini ${dayName} Tanggal ${fullDate}, kami sebagai ${pkaTitle} Desa Serang Kecamatan Cikarang Selatan Kota/kabupaten Bekasi sudah menerima transfer for Kegiatan :`;
    const split1 = doc.splitTextToSize(para1, PAGE_WIDTH - (MARGIN_LEFT * 2));
    doc.text(split1, MARGIN_LEFT, y);
    y += (split1.length * 6) + 5;

    const leftColX = MARGIN_LEFT;
    const colGap = 40;
    const lineHeight = 6;
    
    const row = (label: string, value: string) => {
        const valueX = leftColX + colGap;
        const maxWidth = PAGE_WIDTH - MARGIN_RIGHT - valueX;
        const textValue = value || '-';
        
        const splitValue = doc.splitTextToSize(textValue, maxWidth);
        
        doc.text(label, leftColX, y);
        doc.text(':', leftColX + colGap - 5, y); // Separator slight left of value
        doc.text(splitValue, valueX, y);
        
        const lines = Array.isArray(splitValue) ? splitValue.length : 1;
        y += lines * lineHeight;
        if (lines > 1) y += 2;
    };

    row('Bidang', data.field);
    row('Sub. Bidang', data.subField);
    row('No. SPP', data.sppNumber);
    row('No. SPM', data.letterNumber);
    y += 5;
    
    const fiscalYear = data.fiscalYear ? data.fiscalYear : new Date().getFullYear().toString();

    const para2 = `Adapun Kegiatan tersebut kami laksanakan merupakan pemenuhan Kegiatan sebagaimana tertuang dalam PERDES APBDes Tahun Anggaran ${fiscalYear}, Desa Serang Kecamatan Cikarang Selatan Kota/kabupaten Bekasi.`;
    const split2 = doc.splitTextToSize(para2, PAGE_WIDTH - (MARGIN_LEFT * 2));
    doc.text(split2, MARGIN_LEFT, y);
    y += (split2.length * 6) + 5;

    const para3 = "Demikian Berita Acara Pelaksanaan Pekerjaan ini kami sampaikan for dapat diketahui bersama-sama, atas perhatiannya kami ucapkan terimakasih.";
    const split3 = doc.splitTextToSize(para3, PAGE_WIDTH - (MARGIN_LEFT * 2));
    doc.text(split3, MARGIN_LEFT, y);
    y += 20;
    
    // Check page overflow for signatures
    if (y > PAGE_HEIGHT - 70) {
        doc.addPage();
        y = 30;
    }

    // Signatures
    const leftX = MARGIN_LEFT + 30;
    const rightX = PAGE_WIDTH - 50;

    // LEFT SIDE: Koordinator / Sekretaris Desa
    doc.text('Koordinator', leftX, y, {align: 'center'});
    
    // RIGHT SIDE: Date
    doc.text(`${data.place}, ${fullDate}`, rightX, y, {align: 'center'});
    
    y+=5;
    doc.text('Pelaksana Kegiatan Anggaran (PKA)', leftX, y, {align: 'center'});
    // Right side: PKA Label below date
    doc.text('Pelaksana Kegiatan Anggaran (PKA)', rightX, y, {align: 'center'});
    
    y+=5;
    doc.text('Sekretaris Desa', leftX, y, {align: 'center'});
    // Right side: PKA Position below Label
    doc.text(pkaTitle, rightX, y, {align: 'center'});

    y+=25;
    doc.setFont('helvetica', 'bold');
    // Left: Secretary Name
    doc.text(data.secretary, leftX, y, {align: 'center'});
    
    // Right: PKA Name
    doc.text(data.pkaSignatory, rightX, y, {align: 'center'});
    
    y+= 15;
    doc.setFont('helvetica', 'normal');
    doc.text('Mengetahui,', PAGE_WIDTH/2, y, {align: 'center'});
    y+=5;
    doc.text('Pj. Kepala Desa Serang', PAGE_WIDTH/2, y, {align: 'center'});
    y+=25;
    doc.setFont('helvetica', 'bold');
    doc.text(data.pjHeadVillage, PAGE_WIDTH/2, y, {align: 'center'});

    doc.save(`BA-${data.letterNumber.replace(/\//g, '-')}.pdf`);
}
