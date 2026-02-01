const fs = require('fs');
const path = require('path');

// المسارات المحتملة للملفات المسببة للمشاكل بناءً على سجلات الخطأ
const filesToPatch = [
  'node_modules/@zegocloud/zego-uikit-rn/index.js',
  'node_modules/@zegocloud/zego-uikit-prebuilt-call-rn/index.js'
];

filesToPatch.forEach(filePath => {
  const absolutePath = path.resolve(__dirname, '..', filePath);
  if (fs.existsSync(absolutePath)) {
    let content = fs.readFileSync(absolutePath, 'utf8');
    // حذف typeof المعطلة
    content = content.replace(/import { typeof } from 'react-native';/g, "import { } from 'react-native';");
    fs.writeFileSync(absolutePath, content);
    console.log(`✅ Patched: ${filePath}`);
  }
});
