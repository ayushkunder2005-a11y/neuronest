const fs = require('fs');
const path = require('path');

function walk(dir){
  return fs.readdirSync(dir).flatMap(f=>{
    const p = path.join(dir,f);
    return fs.statSync(p).isDirectory() ? walk(p) : p;
  });
}

const cssDir = path.join(__dirname, '..', 'src', 'styles');
if(!fs.existsSync(cssDir)){
  console.error('styles dir not found:', cssDir);
  process.exit(1);
}

const cssFiles = walk(cssDir).filter(f=>f.endsWith('.css'));
let issues = [];
for(const file of cssFiles){
  const txt = fs.readFileSync(file,'utf8');
  const open = (txt.match(/{/g)||[]).length;
  const close = (txt.match(/}/g)||[]).length;
  if(open !== close){
    issues.push({file, open, close});
  }
}

if(issues.length === 0){
  console.log('All CSS files have matching braces.');
  process.exit(0);
}

console.log('Files with mismatched brace counts:');
for(const it of issues){
  console.log(`${it.file}: {=${it.open} }=${it.close}`);
}

process.exit(2);
