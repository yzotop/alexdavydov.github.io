#!/usr/bin/env python3
"""
Скрипт для проверки битых ссылок в /lab/experiments/ и /docs/experiments_md/

Использование:
    python3 scripts/audit_experiments_links.py

Скрипт проверяет:
- HTML файлы в lab/experiments/ (относительные ссылки)
- MD файлы в docs/experiments_md/ (ссылки на .html файлы)

Игнорирует внешние URL, якоря, абсолютные пути и query-параметры.
"""

import os
import re
import sys
from pathlib import Path
from urllib.parse import urlparse, unquote
from html.parser import HTMLParser
from collections import defaultdict

# Корень репозитория (где запущен скрипт)
REPO_ROOT = Path(__file__).parent.parent
EXPERIMENTS_DIR = REPO_ROOT / "lab" / "experiments"
EXPERIMENTS_MD_DIR = REPO_ROOT / "docs" / "experiments_md"

# Игнорируемые префиксы ссылок
IGNORE_PREFIXES = ["http://", "https://", "mailto:", "#", "/"]


class LinkExtractor(HTMLParser):
    """Парсер HTML для извлечения всех href атрибутов"""
    
    def __init__(self, source_file):
        super().__init__()
        self.source_file = source_file
        self.links = []  # [(line_number, href), ...]
        self.current_line = 1
        
    def handle_starttag(self, tag, attrs):
        if tag == "a":
            for attr_name, attr_value in attrs:
                if attr_name == "href" and attr_value:
                    self.links.append((self.current_line, attr_value))
    
    def handle_data(self, data):
        # Подсчитываем строки по количеству \n
        self.current_line += data.count('\n')


def normalize_path(href, source_file):
    """
    Нормализует относительный путь к файлу.
    Убирает якоря (#), query (?), декодирует URL.
    Возвращает абсолютный Path или None если путь невалидный.
    """
    # Убираем якорь и query
    href_clean = href.split('#')[0].split('?')[0]
    
    # Декодируем URL
    href_clean = unquote(href_clean)
    
    if not href_clean:
        return None
    
    # Игнорируем внешние ссылки и абсолютные пути
    for prefix in IGNORE_PREFIXES:
        if href_clean.startswith(prefix):
            return None
    
    # Получаем директорию исходного файла
    source_dir = source_file.parent
    
    # Разрешаем относительный путь
    try:
        resolved = (source_dir / href_clean).resolve()
        # Проверяем, что путь внутри репозитория
        try:
            resolved.relative_to(REPO_ROOT)
            return resolved
        except ValueError:
            return None
    except (OSError, ValueError):
        return None


def check_file_exists(file_path):
    """Проверяет существование файла"""
    return file_path.exists() and file_path.is_file()


def extract_links_from_markdown(md_file):
    """Извлекает ссылки из Markdown файла"""
    links = []
    try:
        with open(md_file, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Находим все ссылки в формате [text](url)
        pattern = r'\[([^\]]+)\]\(([^)]+)\)'
        for match in re.finditer(pattern, content):
            href = match.group(2)
            line_num = content[:match.start()].count('\n') + 1
            links.append((line_num, href))
    except Exception as e:
        print(f"⚠️  Ошибка при чтении {md_file}: {e}")
    
    return links


def audit_links():
    """Основная функция проверки ссылок"""
    
    all_broken_links = []
    html_files = []
    md_files = []
    
    # Проверяем HTML файлы
    if EXPERIMENTS_DIR.exists():
        html_files = list(EXPERIMENTS_DIR.glob("*.html"))
        if html_files:
            print(f"📁 Проверяю {len(html_files)} HTML файлов в {EXPERIMENTS_DIR}")
            broken_html = audit_html_files(html_files)
            all_broken_links.extend(broken_html)
            print()
    
    # Проверяем MD файлы
    if EXPERIMENTS_MD_DIR.exists():
        md_files = list(EXPERIMENTS_MD_DIR.glob("*.md"))
        if md_files:
            print(f"📁 Проверяю {len(md_files)} MD файлов в {EXPERIMENTS_MD_DIR}")
            broken_md = audit_markdown_files(md_files)
            all_broken_links.extend(broken_md)
            print()
    
    # Выводим отчёт
    print_report(html_files, md_files, all_broken_links)
    
    if not all_broken_links:
        print("✅ Все ссылки корректны!")
        return 0
    
    return 1


def audit_html_files(html_files):
    """Проверяет ссылки в HTML файлах"""
    all_links = []
    broken_links = []
    
    # Обрабатываем каждый файл
    for html_file in sorted(html_files):
        try:
            with open(html_file, 'r', encoding='utf-8') as f:
                content = f.read()
            
            parser = LinkExtractor(html_file)
            parser.feed(content)
            
            for line_num, href in parser.links:
                all_links.append((html_file, line_num, href))
                
                # Нормализуем путь
                resolved_path = normalize_path(href, html_file)
                
                if resolved_path is None:
                    # Игнорируем внешние/абсолютные ссылки
                    continue
                
                # Проверяем существование
                if not check_file_exists(resolved_path):
                    broken_links.append({
                        'source_file': html_file.relative_to(REPO_ROOT),
                        'line_number': line_num,
                        'href_original': href,
                        'resolved_path': resolved_path.relative_to(REPO_ROOT)
                    })
        
        except Exception as e:
            print(f"⚠️  Ошибка при обработке {html_file}: {e}")
    
    return broken_links


def audit_markdown_files(md_files):
    """Проверяет ссылки в Markdown файлах"""
    all_links = []
    broken_links = []
    
    # Обрабатываем каждый файл
    for md_file in sorted(md_files):
        links = extract_links_from_markdown(md_file)
        
        for line_num, href in links:
            all_links.append((md_file, line_num, href))
            
            # Проверяем только ссылки на .html файлы
            if not href.endswith('.html'):
                continue
            
            # Для MD файлов ссылки должны разрешаться относительно lab/experiments/
            # а не относительно docs/experiments_md/
            if href.startswith('./'):
                # Относительная ссылка - разрешаем относительно lab/experiments/
                target_file = EXPERIMENTS_DIR / href[2:]
            elif href.startswith('../'):
                # Относительная ссылка вверх - разрешаем относительно lab/experiments/
                target_file = (EXPERIMENTS_DIR / href).resolve()
            elif href.startswith('/lab/experiments/'):
                # Абсолютная ссылка на курс
                target_file = REPO_ROOT / href[1:]  # Убираем ведущий /
            else:
                # Другие ссылки (внешние, абсолютные) - пропускаем
                continue
            
            # Проверяем существование
            if not check_file_exists(target_file):
                broken_links.append({
                    'source_file': md_file.relative_to(REPO_ROOT),
                    'line_number': line_num,
                    'href_original': href,
                    'resolved_path': target_file.relative_to(REPO_ROOT) if target_file.exists() or str(target_file).startswith(str(REPO_ROOT)) else str(target_file)
                })
    
    return broken_links


def print_report(html_files, md_files, broken_links):
    """Выводит отчёт о проверке"""
    print("=" * 80)
    print("📊 ОТЧЁТ О ПРОВЕРКЕ ССЫЛОК")
    print("=" * 80)
    
    total_files = 0
    total_links = 0
    
    if html_files:
        total_files += len(html_files)
    if md_files:
        total_files += len(md_files)
    
    print(f"✅ Проверено файлов: {total_files}")
    print(f"❌ Битых ссылок: {len(broken_links)}")
    print()
    
    if broken_links:
        print("❌ БИТЫЕ ССЫЛКИ:")
        print("-" * 80)
        
        # Группируем по файлу-источнику
        by_source = defaultdict(list)
        for link in broken_links:
            by_source[str(link['source_file'])].append(link)
        
        for source_file in sorted(by_source.keys()):
            print(f"\n📄 {source_file}:")
            for link in sorted(by_source[source_file], key=lambda x: x['line_number']):
                print(f"   Строка {link['line_number']:4d}: {link['href_original']}")
                print(f"              → {link['resolved_path']} (не существует)")
        
        print()
        print("=" * 80)
        print("💡 РЕКОМЕНДАЦИИ ПО ИСПРАВЛЕНИЮ:")
        print("=" * 80)
        
        # Проверяем наличие известных проблемных файлов
        patterns_files = ['pressure-patterns.html', 'time-patterns.html', 'decision-patterns.html']
        found_patterns = False
        
        for link in broken_links:
            href_file = Path(link['href_original']).name
            if href_file in patterns_files:
                found_patterns = True
                break
        
        if found_patterns:
            print("\n⚠️  Обнаружены ссылки на несуществующие *-patterns.html файлы:")
            print("   Эти файлы были удалены или никогда не существовали.")
            print("\n   Рекомендации:")
            print("   1. Если ссылка в index.html — удалить карточку/блок с этой ссылкой")
            print("   2. Если ссылка в другом файле — заменить на существующий урок:")
            print("      - pressure-patterns.html → pressure-design.html")
            print("      - time-patterns.html → time-and-lags.html")
            print("      - decision-patterns.html → metric-conflicts.html")
            print()
        
        print("   Общие рекомендации:")
        print("   - Удалить битые ссылки или заменить на существующие файлы")
        print("   - Проверить правильность относительных путей (../, ./)")
        print("   - Убедиться, что все файлы курса созданы")
        print()
        
        return 1
    else:
        print("✅ Все ссылки корректны!")
        print()
        return 0


if __name__ == "__main__":
    try:
        exit_code = audit_links()
        sys.exit(exit_code)
    except KeyboardInterrupt:
        print("\n\n⚠️  Прервано пользователем")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Критическая ошибка: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
