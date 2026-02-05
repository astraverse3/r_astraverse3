
const XLSX = require('xlsx');
const path = require('path');

const file = '../../농가정보_2025_import_2026-01-28.xlsx';
const workbook = XLSX.readFile(path.join(__dirname, file));
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const data = XLSX.utils.sheet_to_json(sheet).slice(0, 3);
console.log(JSON.stringify(data, null, 2));
