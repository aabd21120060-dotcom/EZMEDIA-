#!/usr/bin/env bash

set -Eeuo pipefail

echo "========================================"
echo " EZ MEDIA — تنظيف بيئة المشروع"
echo " الإصدار: Foundation 0.0.1"
echo "========================================"
echo

ROOT_DIR="$(pwd)"

echo "[1/7] التحقق من مجلد المشروع..."
echo "المسار: $ROOT_DIR"
echo

echo "[2/7] حذف ملفات البناء المؤقتة..."

find "$ROOT_DIR" \
  -type d \
  \( \
    -name "node_modules" \
    -o -name "dist" \
    -o -name "build" \
    -o -name ".turbo" \
    -o -name ".next" \
    -o -name ".cache" \
    -o -name "coverage" \
  \) \
  -prune \
  -exec rm -rf {} + 2>/dev/null || true

echo "✓ تم تنظيف ملفات البناء."

echo
echo "[3/7] حذف الملفات المؤقتة..."

find "$ROOT_DIR" \
  -type f \
  \( \
    -name "*.log" \
    -o -name "*.tmp" \
    -o -name "*.temp" \
    -o -name ".DS_Store" \
    -o -name "npm-debug.log*" \
    -o -name "yarn-debug.log*" \
    -o -name "yarn-error.log*" \
    -o -name "pnpm-debug.log*" \
  \) \
  -not -path "*/.git/*" \
  -delete 2>/dev/null || true

echo "✓ تم تنظيف الملفات المؤقتة."

echo
echo "[4/7] تنظيف كاش pnpm إن وجد..."

if command -v pnpm >/dev/null 2>&1; then
  pnpm store prune || true
  echo "✓ تم تنظيف كاش pnpm."
else
  echo "⚠ pnpm غير مثبت — تم تجاوز الخطوة."
fi

echo
echo "[5/7] التحقق من Git..."

if [ -d "$ROOT_DIR/.git" ]; then
  echo "✓ مجلد Git موجود."
else
  echo "⚠ هذا المجلد ليس مستودع Git."
fi

echo
echo "[6/7] فحص الملفات الحساسة..."

SENSITIVE_FILES=(
  ".env"
  ".env.local"
  ".env.production"
  ".env.development"
  ".env.test"
)

for file in "${SENSITIVE_FILES[@]}"; do
  if [ -f "$ROOT_DIR/$file" ]; then
    echo "⚠ موجود: $file"
  fi
done

echo
echo "[7/7] النتيجة"
echo "----------------------------------------"
echo "✓ تم تنظيف ملفات البناء والكاش."
echo "✓ لم يتم حذف .git."
echo "✓ لم يتم حذف ملفات المصدر عمدًا."
echo "✓ لم يتم حذف ملفات البيئة تلقائيًا."
echo
echo "EZ MEDIA — Workspace Clean"
echo "----------------------------------------"
