
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

// 1. Check headers of large stock file
const stockFile = '../../톤백별입고내역 (1).xlsx';
try {
    const workbook = XLSX.readFile(path.join(__dirname, stockFile));
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const headers = XLSX.utils.sheet_to_json(sheet, { header: 1 })[0];
    console.log(`File: ${stockFile}`);
    console.log(`Headers: ${JSON.stringify(headers)}`);
} catch (e) {
    console.log(`Error reading ${stockFile}: ${e.message}`);
}

// 2. Check Uniqueness of (Group Name + Farmer Name)
const farmerFile = '../../농가정보_2025_import_2026-01-28.xlsx';
try {
    const workbook = XLSX.readFile(path.join(__dirname, farmerFile));
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(sheet);

    const inputs = {};
    const duplicates = [];

    data.forEach(row => {
        const key = `${row['작목반명']}_${row['농가명']}`;
        if (inputs[key]) {
            duplicates.push(key);
        }
        inputs[key] = true;
    });

    if (duplicates.length > 0) {
        console.log('Duplicate (Group + Farmer) keys found:', duplicates);
    } else {
        console.log('(Group Name + Farmer Name) combination is UNIQUE.');
    }

} catch (e) {
    console.error(`Error reading ${farmerFile}:`, e.message);
}
