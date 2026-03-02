const XLSX = require('xlsx');
const path = require('path');
const wb = XLSX.readFile(path.join(__dirname, '../docs/Fluxa Compact vs Light vs Core.xlsx'));
const sheetNames = wb.SheetNames;
console.log('Sheet names:', sheetNames);
for (const name of sheetNames) {
  const sheet = wb.Sheets[name];
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  console.log('\n--- Sheet:', name, '---');
  console.log(JSON.stringify(data, null, 2));
}
