
const XLSX = require('xlsx');
const path = require('path');

// 1. Check Group Codes for Duplicates
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

    const duplicates = Object.entries(keyMap)
        .filter(([key, rows]) => rows.length > 1)
        .slice(0, 3);

    console.log('Duplicate Group Codes Check:');
    duplicates.forEach(([key, rows]) => {
        console.log(`Key: ${key}`);
        rows.forEach(r => console.log(` - GroupCode: ${r['작목반번호']}, CertNo: ${r['인증번호']}`));
    });

} catch (e) {
    console.error(e);
}

// 2. Debug Stock List
const stockListFile = '../../stock_list_2026-02-02.xlsx';
try {
    const workbook = XLSX.readFile(path.join(__dirname, stockListFile));
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    // Get dimensions
    const range = XLSX.utils.decode_range(sheet['!ref']);
    console.log(`Stock List Range: ${sheet['!ref']} (Rows: ${range.e.r + 1})`);

    // Print raw cell values for first few rows
    for (let R = 0; R <= Math.min(range.e.r, 5); ++R) {
        let rowStr = `Row ${R}: `;
        for (let C = 0; C <= range.e.c; ++C) {
            const cell = sheet[XLSX.utils.encode_cell({ r: R, c: C })];
            rowStr += (cell ? cell.v : 'EMPTY') + ", ";
        }
        console.log(rowStr);
    }

} catch (e) {
    console.log(e.message);
}
