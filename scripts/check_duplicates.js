
const XLSX = require('xlsx');
const path = require('path');

const file = '../../농가정보_2025_import_2026-01-28.xlsx';
const workbook = XLSX.readFile(path.join(__dirname, file));
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const data = XLSX.utils.sheet_to_json(sheet);

const nameCounts = {};
data.forEach(row => {
    const name = row['농가명'];
    if (name) {
        nameCounts[name] = (nameCounts[name] || 0) + 1;
    }
});

const duplicates = Object.entries(nameCounts).filter(([name, count]) => count > 1);

if (duplicates.length > 0) {
    console.log('Duplicate Farmer Names found:', duplicates);
} else {
    console.log('All Farmer Names are unique.');
}
