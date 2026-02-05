
const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

// 1. Load Tonbag File (Master ID source)
const tonbagFile = '../../톤백별입고내역 (1).xlsx';
const tonbagIds = new Set();
try {
    const workbook = XLSX.readFile(path.join(__dirname, tonbagFile));
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(sheet);
    data.forEach(r => tonbagIds.add(r['번호']));
    console.log(`Tonbag File Rows: ${data.length}`);
    console.log(`Sample Tonbag IDs: ${Array.from(tonbagIds).slice(0, 5).join(', ')}`);
} catch (e) { console.log(e.message); }

// 2. Load Stock Import Files (Variety source)
const importFiles = fs.readdirSync(path.join(__dirname, '../../')).filter(f => f.startsWith('stock_import_') && f.endsWith('.xlsx'));
let matchCount = 0;
let totalImportRows = 0;

importFiles.forEach(file => {
    try {
        const workbook = XLSX.readFile(path.join(__dirname, '../../', file));
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(sheet);
        totalImportRows += data.length;

        const sampleMatches = [];
        data.forEach(r => {
            if (tonbagIds.has(r['톤백번호'])) {
                matchCount++;
                if (sampleMatches.length < 3) sampleMatches.push(r['톤백번호']);
            }
        });
        console.log(`File: ${file} (Rows: ${data.length}) - Matches found: ${sampleMatches.length > 0}`);
    } catch (e) {
        console.log(`Error reading ${file}: ${e.message}`);
    }
});

console.log(`Total Import Rows: ${totalImportRows}`);
console.log(`Total Matches with Tonbag File: ${matchCount}`);
