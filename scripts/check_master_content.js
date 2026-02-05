
const XLSX = require('xlsx');
const path = require('path');

// 1. Inspect Master Stock File Data
const stockFile = '../../톤백별입고내역 (1).xlsx';
try {
    const workbook = XLSX.readFile(path.join(__dirname, stockFile));
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(sheet).slice(0, 3);
    console.log(`File: ${stockFile} (First 3 rows)`);
    console.log(JSON.stringify(data, null, 2));
} catch (e) {
    console.log(`Error reading ${stockFile}: ${e.message}`);
}

// 2. Check Uniqueness of Cert No in Farmer File
const farmerFile = '../../농가정보_2025_import_2026-01-28.xlsx';
try {
    const workbook = XLSX.readFile(path.join(__dirname, farmerFile));
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(sheet);

    const certCounts = {};
    data.forEach(row => {
        const certNo = row['인증번호'];
        if (certNo) {
            certCounts[certNo] = (certCounts[certNo] || 0) + 1;
        }
    });

    const duplicates = Object.entries(certCounts).filter(([cert, count]) => count > 1);

    if (duplicates.length > 0) {
        console.log('Duplicate Cert Nos found:', duplicates);
    } else {
        console.log('Cert No is UNIQUE.');
    }

} catch (e) {
    console.error(`Error reading ${farmerFile}:`, e.message);
}
