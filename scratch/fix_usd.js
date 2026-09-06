const fs = require('fs');
let code = fs.readFileSync('src/pages/TradeLog/TradeLog.jsx', 'utf8');
code = code.replace(/฿\{formatThb\(localTradeStats\.([a-zA-Z]+)THB\}\)\}<\/p>/g, '฿{formatThb(localTradeStats.)}</p>');
code = code.replace(/\(\\}\<\/p>/g, '()</p>');
fs.writeFileSync('src/pages/TradeLog/TradeLog.jsx', code);
console.log('Done');