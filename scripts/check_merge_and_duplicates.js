
const XLSX = require('xlsx');
const path = require('path');

// 1. Check stock list sample
const stockListFile = '../../stock_list_2026-02-02.xlsx';
try {
    const workbook = XLSX.readFile(path.join(__dirname, stockListFile));
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(sheet).slice(0, 3);
    console.log(`File: ${stockListFile} (First 3 rows)`);
    console.log(JSON.stringify(data, null, 2));
} catch (e) {
    console.log(`Error reading ${stockListFile}: ${e.message}`);
}

// 2. Analyze Farmer Duplicates in Detail
const farmerFile = '../../농가정보_2025_import_2026-01-28.xlsx';
try {
    const workbook = XLSX.readFile(path.join(__dirname, farmerFile));
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(sheet);

    const keyMap = {};
    data.forEach(row => {
        const key = `${row['작목반명']}_${row['농가명']}`;
        if (!keyMap[key]) {
            keyMap[key] = [];
        }
        keyMap[key].push(row);
    });

    // Filter for keys with >1 entries and print them
    const duplicates = Object.entries(keyMap)
        .filter(([key, rows]) => rows.length > 1)
        .slice(0, 3); // Just print first 3 cases

    console.log('Detailed Duplicates (first 3 groups):');
    duplicates.forEach(([key, rows]) => {
        console.log(`Key: ${key}`);
        rows.forEach(r => console.log(` - FarmerNo: ${r['농가번호']}, CertNo: ${r['인증번호']}, Items: ${r['취급품목']}`));
    });

} catch (e) {
    console.error(`Error reading ${farmerFile}:`, e.message);
}
