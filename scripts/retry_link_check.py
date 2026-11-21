#!/usr/bin/env python3
"""Repeat transient external link failures from the pinned Lychee JSON report."""

import argparse
from html import escape
import json
import subprocess
from pathlib import Path
from tempfile import TemporaryDirectory
from time import sleep
from urllib.parse import urlsplit


RETRYABLE_CODES = {408, 429, 500, 502, 503, 504}
RETRY_DELAYS = (3, 8)


def read_report(path, exit_code, expected_total=None):
    if exit_code not in (0, 2):
        raise ValueError(f'Lychee did not complete its link check (exit {exit_code})')
    report = json.loads(path.read_text())
    if report['total'] <= 0:
        raise ValueError('Lychee did not check any links')

    failures = []
    for section, count in [('error_map', 'errors'), ('timeout_map', 'timeouts')]:
        entries = [
            (source, link['url'], link['status'], section == 'timeout_map')
            for source, links in report[section].items()
            for link in links
        ]
        if len(entries) != report[count]:
            raise ValueError(f'Incomplete Lychee report for {count}')
        failures.extend(entries)
    if bool(failures) != (exit_code == 2):
        raise ValueError('Lychee exit code and report disagree')
    if expected_total is not None and (
        report['total'] != expected_total or report['successful'] + len(failures) != expected_total
    ):
        raise ValueError('Lychee did not recheck every requested URL')
    return failures


def retryable(url, status, timed_out):
    if urlsplit(url).scheme not in {'http', 'https'}:
        return False
    return (
        timed_out
        or status.get('code') in RETRYABLE_CODES
        or status['text'].startswith(('Connection failed.', 'Network error:'))
    )


def recheck(urls):
    with TemporaryDirectory(prefix='lychee-retry-') as directory:
        report = Path(directory) / 'report.json'
        inputs = Path(directory) / 'links.html'
        inputs.write_text('\n'.join(f'<a href="{escape(url, quote=True)}">Link</a>' for url in sorted(urls)))
        run = subprocess.run(
            ['lychee', '--config', 'lychee.toml', '--cache=false', '--max-retries', '0',
             '--format', 'json', '--output', str(report), str(inputs)],
            check=False,
        )
        return read_report(report, run.returncode, expected_total=len(urls))


def verify(report_path, exit_code):
    pending = {}
    blocked = False
    for source, url, status, timed_out in read_report(report_path, exit_code):
        if retryable(url, status, timed_out):
            pending.setdefault(url, set()).add(source)
        else:
            print(f'{source}: {url} — {status["text"]}', flush=True)
            blocked = True
    if blocked:
        return 1

    for delay in RETRY_DELAYS:
        if not pending:
            break
        print(f'Rechecking {len(pending)} external URL(s) after {delay}s', flush=True)
        sleep(delay)
        unresolved = {}
        for _, url, status, timed_out in recheck(pending):
            sources = pending[url]
            print(f'{", ".join(sorted(sources))}: {url} — {status["text"]}', flush=True)
            if retryable(url, status, timed_out):
                unresolved[url] = sources
            else:
                blocked = True
        pending = unresolved
    if blocked or pending:
        return 1
    print('Link check passed', flush=True)
    return 0


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('report', type=Path)
    parser.add_argument('exit_code', type=int)
    args = parser.parse_args()
    return verify(args.report, args.exit_code)


if __name__ == '__main__':
    raise SystemExit(main())
