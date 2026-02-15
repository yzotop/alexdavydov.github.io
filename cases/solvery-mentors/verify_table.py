#!/usr/bin/env python3
"""Verify the table below Core vs Long Tail chart."""

import asyncio
from playwright.async_api import async_playwright

async def verify_table():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page(viewport={"width": 1280, "height": 900})
        
        url = "http://localhost:8903/cases/solvery-mentors/index.html"
        await page.goto(url, wait_until="networkidle")
        await asyncio.sleep(2)
        
        # Scroll to see the table below the stacked bar
        print("Screenshot: Core vs Long Tail with table...")
        await page.evaluate("window.scrollTo(0, 5400)")
        await asyncio.sleep(0.5)
        await page.screenshot(path="new_chart_05_table.png", full_page=False)
        
        await browser.close()
        print("✓ Table screenshot saved!")

if __name__ == "__main__":
    asyncio.run(verify_table())
