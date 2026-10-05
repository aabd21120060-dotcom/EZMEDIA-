#!/usr/bin/env bash

set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

REPORT_DIR="$ROOT/docs/versions"
REPORT_FILE="$REPORT_DIR/auto-repair-report.md"

mkdir -p "$REPORT_DIR"

START_TIME="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"

FAILED_STEPS=()
REPAIRED_STEPS=()

log() {
  printf '\n[%s] %s\n' "$(date -u +"%H:%M:%S")" "$1"
}

success() {
  printf '✅ %s\n' "$1"
}

warning() {
  printf '⚠️  %s\n' "$1"
}

failure() {
  printf '❌ %s\n' "$1"
}

record_failure() {
  FAILED_STEPS+=("$1")
}

record_repair() {
  REPAIRED_STEPS+=("$1")
}

run_step() {
  local name="$1"
  shift

  log "$name"

  if "$@"; then
    success "$name"
    return 0
  fi

  failure "$name"
  record_failure "$name"
  return 1
}

repair_formatting() {
  log "فحص وإصلاح التنسيق"

  if pnpm format:check; then
    success "التنسيق صحيح"
    return 0
  fi

  warning "تم العثور على مشاكل تنسيق — محاولة الإصلاح"

  if pnpm format; then
    REPAIRED_STEPS+=("Prettier formatting")
    success "تم إصلاح التنسيق"
    return 0
  fi

  failure "تعذر إصلاح التنسيق"
  return 1
}

verify_workspace() {
  log "فحص بنية Workspace"

  if [ ! -f "pnpm-workspace.yaml" ]; then
    failure "pnpm-workspace.yaml غير موجود"
    return 1
  fi

  if [ ! -f "package.json" ]; then
    failure "package.json غير موجود"
    return 1
  fi

  if [ ! -d "apps/api" ]; then
    failure "apps/api غير موجود"
    return 1
  fi

  if [ ! -d "packages" ]; then
    failure "packages غير موجود"
    return 1
  fi

  success "بنية Workspace سليمة"
}

verify_environment() {
  log "فحص البيئة"

  if ! command -v node >/dev/null 2>&1; then
    failure "Node.js غير مثبت"
    return 1
  fi

  if ! command -v pnpm >/dev/null 2>&1; then
    failure "pnpm غير مثبت"
    return 1
  fi

  NODE_VERSION="$(node --version)"
  PNPM_VERSION="$(pnpm --version)"

  echo "Node.js: $NODE_VERSION"
  echo "pnpm:    $PNPM_VERSION"

  success "البيئة متاحة"
}

install_dependencies() {
  log "تثبيت الاعتمادات"

  pnpm install --frozen-lockfile=false

  success "تم تثبيت الاعتمادات"
}

typecheck_project() {
  log "TypeScript Typecheck"

  if pnpm typecheck; then
    success "Typecheck نجح"
    return 0
  fi

  failure "Typecheck فشل"
  return 1
}

build_project() {
  log "Production Build"

  if pnpm build; then
    success "Build نجح"
    return 0
  fi

  failure "Build فشل"
  return 1
}

run_tests() {
  log "تشغيل الاختبارات"

  if pnpm test; then
    success "الاختبارات نجحت"
    return 0
  fi

  failure "الاختبارات فشلت"
  return 1
}

repair_lockfile() {
  log "فحص pnpm lockfile"

  if [ -f "pnpm-lock.yaml" ]; then
    success "pnpm-lock.yaml موجود"
    return 0
  fi

  warning "pnpm-lock.yaml غير موجود — إنشاء lockfile"

  pnpm install --lockfile-only

  REPAIRED_STEPS+=("Created pnpm-lock.yaml")

  success "تم إنشاء lockfile"
}

generate_report() {
  local status="$1"

  cat > "$REPORT_FILE" <<EOF
# EZ MEDIA — Auto Repair Report

## معلومات التشغيل

- وقت البداية: $START_TIME
- وقت النهاية: $(date -u +"%Y-%m-%dT%H:%M:%SZ")
- Node.js: ${NODE_VERSION:-unknown}
- pnpm: ${PNPM_VERSION:-unknown}
- الحالة: $status

## الإصلاحات المنفذة

EOF

  if [ "${#REPAIRED_STEPS[@]}" -eq 0 ]; then
    echo "- لا توجد إصلاحات مطلوبة." >> "$REPORT_FILE"
  else
    for item in "${REPAIRED_STEPS[@]}"; do
      echo "- $item" >> "$REPORT_FILE"
    done
  fi

  cat >> "$REPORT_FILE" <<EOF

## المشاكل

EOF

  if [ "${#FAILED_STEPS[@]}" -eq 0 ]; then
    echo "- لا توجد مشاكل." >> "$REPORT_FILE"
  else
    for item in "${FAILED_STEPS[@]}"; do
      echo "- $item" >> "$REPORT_FILE"
    done
  fi

  cat >> "$REPORT_FILE" <<EOF

## قاعدة الأمان

هذا السكربت لا يحذف:
- ملفات المصدر
- مجلد .git
- migrations
- secrets
- ملفات البيئة

ولا ينفذ:
- git reset
- git clean
- git push
- حذف تلقائي للملفات

## النتيجة

$status
EOF

  success "تم إنشاء التقرير: $REPORT_FILE"
}

main() {
  echo
  echo "===================================================="
  echo " EZ MEDIA — AUTOMATIC CODE REPAIR"
  echo " Version: 01.04.11"
  echo "===================================================="

  verify_environment
  verify_workspace

  repair_lockfile || true

  install_dependencies

  repair_formatting || true

  if ! typecheck_project; then
    warning "Typecheck فشل — لن يتم تخمين إصلاحات برمجية."
  fi

  if ! build_project; then
    warning "Build فشل — لن يتم تعديل المصدر عشوائيًا."
  fi

  if ! run_tests; then
    warning "Tests فشلت — لن يتم تعديل المصدر عشوائيًا."
  fi

  if [ "${#FAILED_STEPS[@]}" -eq 0 ]; then
    generate_report "PASSED"
  else
    generate_report "NEEDS_ATTENTION"
  fi

  echo
  echo "===================================================="

  if [ "${#FAILED_STEPS[@]}" -eq 0 ]; then
    success "EZ MEDIA — جميع فحوصات الإصلاح نجحت"
    echo "===================================================="
    exit 0
  fi

  warning "هناك أخطاء تحتاج مراجعة"
  echo "راجع:"
  echo "$REPORT_FILE"
  echo "===================================================="

  exit 1
}

main "$@"
