
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const files = [
    '../../농가정보_2025_import_2026-01-28.xlsx',
    '../../stock_list_2026-02-02.xlsx'
];

files.forEach(file => {
    try {
        const workbook = XLSX.readFile(path.join(__dirname, file));
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const headers = XLSX.utils.sheet_to_json(sheet, { header: 1 })[0];
        console.log(`File: ${file}`);
        console.log(`Headers: ${JSON.stringify(headers)}`);
    } catch (e) {
        console.error(`Error reading ${file}:`, e.message);
    }
});
