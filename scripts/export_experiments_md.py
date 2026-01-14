#!/usr/bin/env python3
"""
Скрипт для экспорта HTML-курса в Markdown

Использование:
    python3 scripts/export_experiments_md.py

Экспортирует все HTML файлы из lab/experiments/ в Markdown файлы в docs/experiments_md/.
Извлекает основной контент, исключая навигацию, футер и кнопки.
"""

import os
import re
import sys
from pathlib import Path
from html import unescape

# Корень репозитория
REPO_ROOT = Path(__file__).parent.parent
EXPERIMENTS_DIR = REPO_ROOT / "lab" / "experiments"
OUTPUT_DIR = REPO_ROOT / "docs" / "experiments_md"


def extract_h1_title(html_content):
    """Извлекает заголовок H1 из HTML"""
    match = re.search(r'<h1[^>]*>(.*?)</h1>', html_content, re.DOTALL)
    if match:
        title = re.sub(r'<[^>]+>', '', match.group(1))
        return unescape(title).strip()
    return "Untitled"


def extract_container_content(html_content):
    """Извлекает контент из container, исключая навигацию"""
    # Удаляем скрипты и стили
    html_content = re.sub(r'<script[^>]*>.*?</script>', '', html_content, flags=re.DOTALL | re.IGNORECASE)
    html_content = re.sub(r'<style[^>]*>.*?</style>', '', html_content, flags=re.DOTALL | re.IGNORECASE)
    
    # Находим container
    container_match = re.search(
        r'<div[^>]*class="[^"]*container[^"]*"[^>]*>(.*?)</div>\s*</body>',
        html_content,
        re.DOTALL
    )
    
    if not container_match:
        # Пробуем body
        body_match = re.search(r'<body[^>]*>(.*?)</body>', html_content, re.DOTALL)
        if body_match:
            content = body_match.group(1)
        else:
            content = html_content
            return content, True  # True = нужна ручная очистка
    else:
        content = container_match.group(1)
    
    # Удаляем навигацию и служебные элементы
    # Ссылки "На главную"
    content = re.sub(r'<a[^>]*class="[^"]*back-to-home[^"]*"[^>]*>.*?</a>', '', content, flags=re.DOTALL | re.IGNORECASE)
    # Навигационные ссылки
    content = re.sub(r'<div[^>]*class="[^"]*nav-links[^"]*"[^>]*>.*?</div>', '', content, flags=re.DOTALL | re.IGNORECASE)
    # Кнопки CTA
    content = re.sub(r'<div[^>]*class="[^"]*cta-buttons[^"]*"[^>]*>.*?</div>', '', content, flags=re.DOTALL | re.IGNORECASE)
    content = re.sub(r'<a[^>]*class="[^"]*start-button[^"]*"[^>]*>.*?</a>', '', content, flags=re.DOTALL | re.IGNORECASE)
    # Связанные материалы
    content = re.sub(r'<div[^>]*class="[^"]*related-section[^"]*"[^>]*>.*?</div>', '', content, flags=re.DOTALL | re.IGNORECASE)
    # Футер
    content = re.sub(r'<div[^>]*class="[^"]*footer[^"]*"[^>]*>.*?</div>', '', content, flags=re.DOTALL | re.IGNORECASE)
    content = re.sub(r'<footer[^>]*>.*?</footer>', '', content, flags=re.DOTALL | re.IGNORECASE)
    
    return content, False


def html_to_markdown(html_content):
    """Простая конвертация HTML в Markdown"""
    md = html_content
    
    # Заголовки
    md = re.sub(r'<h1[^>]*>(.*?)</h1>', r'# \1\n', md, flags=re.DOTALL)
    md = re.sub(r'<h2[^>]*>(.*?)</h2>', r'\n## \1\n', md, flags=re.DOTALL)
    md = re.sub(r'<h3[^>]*>(.*?)</h3>', r'\n### \1\n', md, flags=re.DOTALL)
    md = re.sub(r'<h4[^>]*>(.*?)</h4>', r'\n#### \1\n', md, flags=re.DOTALL)
    
    # Параграфы
    md = re.sub(r'<p[^>]*>(.*?)</p>', r'\1\n\n', md, flags=re.DOTALL)
    
    # Списки
    md = re.sub(r'<ul[^>]*>', '\n', md, flags=re.IGNORECASE)
    md = re.sub(r'</ul>', '\n', md, flags=re.IGNORECASE)
    md = re.sub(r'<ol[^>]*>', '\n', md, flags=re.IGNORECASE)
    md = re.sub(r'</ol>', '\n', md, flags=re.IGNORECASE)
    md = re.sub(r'<li[^>]*>(.*?)</li>', r'- \1\n', md, flags=re.DOTALL)
    
    # Ссылки
    md = re.sub(r'<a[^>]*href="([^"]*)"[^>]*>(.*?)</a>', r'[\2](\1)', md, flags=re.DOTALL)
    
    # Жирный текст
    md = re.sub(r'<strong[^>]*>(.*?)</strong>', r'**\1**', md, flags=re.DOTALL)
    md = re.sub(r'<b[^>]*>(.*?)</b>', r'**\1**', md, flags=re.DOTALL)
    
    # Курсив
    md = re.sub(r'<em[^>]*>(.*?)</em>', r'*\1*', md, flags=re.DOTALL)
    md = re.sub(r'<i[^>]*>(.*?)</i>', r'*\1*', md, flags=re.DOTALL)
    
    # Код
    md = re.sub(r'<code[^>]*>(.*?)</code>', r'`\1`', md, flags=re.DOTALL)
    md = re.sub(r'<pre[^>]*>(.*?)</pre>', r'\n```\n\1\n```\n', md, flags=re.DOTALL)
    
    # Удаляем все остальные HTML теги
    md = re.sub(r'<[^>]+>', '', md)
    
    # Декодируем HTML entities
    md = unescape(md)
    
    # Очищаем множественные пустые строки
    md = re.sub(r'\n{3,}', '\n\n', md)
    
    # Очищаем пробелы в начале/конце строк
    lines = []
    for line in md.split('\n'):
        line = line.strip()
        if line or (lines and lines[-1]):  # Сохраняем одну пустую строку между блоками
            lines.append(line)
    
    return '\n'.join(lines).strip()


def export_file(html_file):
    """Экспортирует один HTML файл в Markdown"""
    try:
        with open(html_file, 'r', encoding='utf-8') as f:
            html_content = f.read()
        
        # Извлекаем заголовок
        title = extract_h1_title(html_content)
        
        # Извлекаем контент
        container_content, needs_manual_cleanup = extract_container_content(html_content)
        
        # Конвертируем в Markdown
        md_content = html_to_markdown(container_content)
        
        # Создаём frontmatter
        relative_path = html_file.relative_to(REPO_ROOT)
        frontmatter = f"""---
title: "{title}"
source_html: "/{relative_path.as_posix()}"
---

"""
        
        # Добавляем предупреждение, если нужна ручная очистка
        if needs_manual_cleanup:
            md_content = "> ⚠️ TODO: manual cleanup — main container not detected\n\n" + md_content
        
        # Сохраняем
        md_file = OUTPUT_DIR / (html_file.stem + '.md')
        with open(md_file, 'w', encoding='utf-8') as f:
            f.write(frontmatter + md_content)
        
        return True, None, needs_manual_cleanup
    except Exception as e:
        import traceback
        return False, str(e) + "\n" + traceback.format_exc(), False


def main():
    """Основная функция"""
    # Создаём выходную директорию
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    
    if not EXPERIMENTS_DIR.exists():
        print(f"❌ Директория {EXPERIMENTS_DIR} не найдена!")
        sys.exit(1)
    
    # Находим все HTML файлы
    html_files = sorted(EXPERIMENTS_DIR.glob("*.html"))
    
    if not html_files:
        print(f"❌ HTML файлы не найдены в {EXPERIMENTS_DIR}")
        sys.exit(1)
    
    print(f"📁 Экспортирую {len(html_files)} HTML файлов из {EXPERIMENTS_DIR}")
    print(f"📝 Сохраняю в {OUTPUT_DIR}\n")
    
    success_count = 0
    error_count = 0
    manual_cleanup_count = 0
    
    for html_file in html_files:
        success, error, needs_cleanup = export_file(html_file)
        if success:
            status = "⚠️" if needs_cleanup else "✅"
            print(f"{status} {html_file.name} → {html_file.stem}.md")
            success_count += 1
            if needs_cleanup:
                manual_cleanup_count += 1
        else:
            print(f"❌ {html_file.name}: {error}")
            error_count += 1
    
    print(f"\n{'='*60}")
    print(f"✅ Успешно: {success_count}")
    if manual_cleanup_count > 0:
        print(f"⚠️  Требуют ручной очистки: {manual_cleanup_count}")
    if error_count > 0:
        print(f"❌ Ошибок: {error_count}")
    print(f"{'='*60}")
    
    if error_count > 0:
        sys.exit(1)


if __name__ == "__main__":
    main()
