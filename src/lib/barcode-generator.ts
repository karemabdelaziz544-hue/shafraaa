// Code 128 & EAN-13 Barcode Generator and SVG Renderer (Zero Dependencies)

// جدول تشفير باركود Code 128 (مجموعة B الشائعة)
const CODE128_PATTERNS = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213',
  '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132',
  '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211',
  '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313',
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331',
  '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111',
  '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214',
  '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111',
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141',
  '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141',
  '114131', '311141', '411131', '211412', '211214', '211232', '2331112' // 106 = Stop
];

// 1. توليد كود باركود فريد غير مكرر
export function generateUniqueBarcode(existingCodes: string[] = []): string {
  // بادئة مصرية 622 متبوعة بـ 9 أرقام ورقم تحقق
  const prefix = '622';
  const now = Date.now().toString().slice(-6); // آخر 6 أرقام من الوقت
  const rand = Math.floor(100 + Math.random() * 900).toString(); // 3 أرقام عشوائية
  const body = `${prefix}${now}${rand}`;

  // حساب رقم التحقق EAN-13 Checksum
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const digit = parseInt(body[i], 10);
    sum += i % 2 === 0 ? digit : digit * 3;
  }
  const checkDigit = (10 - (sum % 10)) % 10;
  const barcode = `${body}${checkDigit}`;

  if (existingCodes.includes(barcode)) {
    return generateUniqueBarcode(existingCodes);
  }
  return barcode;
}

// 2. تحويل النص إلى متتالية خطوط Code 128B
export function encodeCode128B(text: string): string {
  const cleanText = text.trim();
  if (!cleanText) return '';

  const codes: number[] = [104]; // رمز البداية Start Code B
  let checkSum = 104;

  for (let i = 0; i < cleanText.length; i++) {
    const charCode = cleanText.charCodeAt(i);
    const code128Val = charCode - 32; // Code 128B offset
    if (code128Val >= 0 && code128Val <= 95) {
      codes.push(code128Val);
      checkSum += code128Val * (i + 1);
    }
  }

  const checkDigit = checkSum % 103;
  codes.push(checkDigit);
  codes.push(106); // Stop Code

  // تحويل الأرقام إلى خطوط بيضاء وسوداء (widths)
  let binaryString = '';
  codes.forEach((c) => {
    const pattern = CODE128_PATTERNS[c] || '111111';
    let isBar = true;
    for (let j = 0; j < pattern.length; j++) {
      const width = parseInt(pattern[j], 10);
      binaryString += (isBar ? '1' : '0').repeat(width);
      isBar = !isBar;
    }
  });

  return binaryString;
}

// 3. توليد كود SVG نظيف للباركود
export function generateBarcodeSvg(
  code: string,
  options: {
    height?: number;
    barWidth?: number;
    showText?: boolean;
    fontSize?: number;
    color?: string;
  } = {}
): string {
  const { height = 50, barWidth = 1.8, showText = true, fontSize = 11 } = options;
  const binary = encodeCode128B(code);
  if (!binary) return '';

  const quietZone = 10;
  const totalWidth = binary.length * barWidth + quietZone * 2;
  const totalHeight = showText ? height + fontSize + 6 : height;

  let rects = '';
  let inBar = false;
  let barStart = 0;

  const barColor = options?.color ?? 'currentColor';
  const rectsStart = '';
  void rectsStart;

  for (let i = 0; i < binary.length; i++) {
    if (binary[i] === '1') {
      if (!inBar) {
        inBar = true;
        barStart = i;
      }
    } else {
      if (inBar) {
        const w = (i - barStart) * barWidth;
        const x = quietZone + barStart * barWidth;
        rects += `<rect x="${x.toFixed(1)}" y="0" width="${w.toFixed(1)}" height="${height}" fill="${barColor}" />`;
        inBar = false;
      }
    }
  }
  if (inBar) {
    const w = (binary.length - barStart) * barWidth;
    const x = quietZone + barStart * barWidth;
    rects += `<rect x="${x.toFixed(1)}" y="0" width="${w.toFixed(1)}" height="${height}" fill="${barColor}" />`;
  }

  let textSvg = '';
  if (showText) {
    textSvg = `<text x="${(totalWidth / 2).toFixed(1)}" y="${(height + fontSize + 2).toFixed(1)}" text-anchor="middle" font-family="monospace" font-size="${fontSize}px" font-weight="bold" fill="${barColor}" letter-spacing="2px">${code}</text>`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalWidth.toFixed(1)} ${totalHeight.toFixed(1)}" width="100%" height="100%">${rects}${textSvg}</svg>`;
}
