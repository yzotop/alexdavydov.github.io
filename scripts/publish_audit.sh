#!/bin/bash
# Publish Audit Script for GitHub Pages
# Checks repository for files that should not be published

set -e

EXIT_CODE=0
REPORT=""

# A) Find .DS_Store files
DS_STORE_COUNT=$(find . -name ".DS_Store" -type f 2>/dev/null | wc -l | tr -d ' ')
if [ "$DS_STORE_COUNT" -gt 0 ]; then
    REPORT="${REPORT}A) Found $DS_STORE_COUNT .DS_Store file(s)\n"
    REPORT="${REPORT}   Command to remove: find . -name \".DS_Store\" -type f -delete\n"
    REPORT="${REPORT}   Files:\n"
    find . -name ".DS_Store" -type f 2>/dev/null | sed 's/^/     /' >> /tmp/audit_report.txt || true
    REPORT="${REPORT}$(cat /tmp/audit_report.txt 2>/dev/null || echo '')\n"
    rm -f /tmp/audit_report.txt
else
    REPORT="${REPORT}A) No .DS_Store files found ✓\n"
fi
REPORT="${REPORT}\n"

# B) Check for real_tests/
if [ -d "real_tests" ]; then
    REPORT="${REPORT}B) ⚠️  WARNING: real_tests/ directory found!\n"
    REPORT="${REPORT}   This directory contains confidential data and should NOT be published.\n"
    REPORT="${REPORT}   Files in real_tests/:\n"
    ls -1 real_tests/ 2>/dev/null | sed 's/^/     /' | head -20 >> /tmp/real_tests_list.txt || true
    REPORT="${REPORT}$(cat /tmp/real_tests_list.txt 2>/dev/null || echo '')\n"
    rm -f /tmp/real_tests_list.txt
    if [ "$(ls -1 real_tests/ 2>/dev/null | wc -l | tr -d ' ')" -gt 20 ]; then
        REPORT="${REPORT}     ... (and more)\n"
    fi
    EXIT_CODE=2
else
    REPORT="${REPORT}B) real_tests/ not found ✓\n"
fi
REPORT="${REPORT}\n"

# C) Find large files > 10MB
LARGE_FILES=$(find . -type f -size +10M -not -path "./.git/*" 2>/dev/null | head -20)
if [ -n "$LARGE_FILES" ]; then
    REPORT="${REPORT}C) ⚠️  WARNING: Found large files (>10MB):\n"
    while IFS= read -r file; do
        if [ -n "$file" ]; then
            SIZE=$(du -h "$file" 2>/dev/null | cut -f1)
            REPORT="${REPORT}     $file ($SIZE)\n"
        fi
    done <<< "$LARGE_FILES"
    EXIT_CODE=2
else
    REPORT="${REPORT}C) No large files (>10MB) found ✓\n"
fi
REPORT="${REPORT}\n"

# D) Find PDF files
PDF_FILES=$(find . -name "*.pdf" -type f -not -path "./.git/*" 2>/dev/null)
if [ -n "$PDF_FILES" ]; then
    REPORT="${REPORT}D) Found PDF files:\n"
    PDF_IN_REAL_TESTS=0
    while IFS= read -r file; do
        if [ -n "$file" ]; then
            SIZE=$(du -h "$file" 2>/dev/null | cut -f1)
            REPORT="${REPORT}     $file ($SIZE)\n"
            if echo "$file" | grep -q "^\./real_tests/"; then
                PDF_IN_REAL_TESTS=1
            fi
        fi
    done <<< "$PDF_FILES"
    if [ "$PDF_IN_REAL_TESTS" -eq 1 ]; then
        REPORT="${REPORT}   ⚠️  WARNING: PDF files found in real_tests/!\n"
        EXIT_CODE=2
    fi
else
    REPORT="${REPORT}D) No PDF files found ✓\n"
fi
REPORT="${REPORT}\n"

# E) Dev-only markdown files
REPORT="${REPORT}E) Dev-only markdown files (not used by site):\n"
REPORT="${REPORT}   Known dev documentation (can be kept as docs):\n"
for file in "COURSE_EXTRACT.md" "COURSE_STRUCTURE.md" "PROJECT_STRUCTURE.md" "STRUCTURE_ANALYSIS.md"; do
    if [ -f "$file" ]; then
        REPORT="${REPORT}     - $file (root - can keep as documentation)\n"
    fi
done
REPORT="${REPORT}   Known dev-only files (consider removing):\n"
for file in "lab/ab-decisions/ARCHITECTURE_PROPOSAL.md" "lab/graphs-as-argument/CHECK_REPORT.md" "lab/ab-practice/ПРАКТИКА_AB_ТЕСТИРОВАНИЯ.md"; do
    if [ -f "$file" ]; then
        REPORT="${REPORT}     - $file\n"
    fi
done
REPORT="${REPORT}\n"

# Print report
echo -e "$REPORT"

# Exit with appropriate code
exit $EXIT_CODE

