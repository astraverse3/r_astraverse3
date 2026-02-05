
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const files = [
    '../../stock_list_import.xlsx',
    '../../stock_import_유_백옥찰.xlsx'
];

files.forEach(file => {
    try {
        const fullPath = path.join(__dirname, file);
        if (fs.existsSync(fullPath)) {
            const workbook = XLSX.readFile(fullPath);
            const sheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];
            const headers = XLSX.utils.sheet_to_json(sheet, { header: 1 })[0];
            console.log(`File: ${file}`);
            console.log(`Headers: ${JSON.stringify(headers)}`);
        } else {
            console.log(`File not found: ${file}`);
        }
    } catch (e) {
        console.error(`Error reading ${file}:`, e.message);
    }
});
