const fs = require('fs');
const path = require('path');

const filesToCheck = [
  'src/hooks/useNotifications.js',
  'src/components/notifications/NotificationsDropdown.jsx'
];

filesToCheck.forEach(file => {
  const fullPath = path.resolve(file);
  if (fs.existsSync(fullPath)) {
    const content = fs.readFileSync(fullPath, 'utf8');
    console.log(`\n=== ${file} ===`);
    
    const imports = content.match(/import.*from\s+['"]([^'"]+)['"]/g);
    if (imports) {
      imports.forEach(imp => {
        if (imp.includes('NotificationService') || imp.includes('useNotifications')) {
          console.log('🔍', imp);
        }
      });
    }
  }
});