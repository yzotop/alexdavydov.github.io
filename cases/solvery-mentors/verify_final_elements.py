#!/usr/bin/env python3
"""Verify final elements: histograms, heatmap, and affordable mentors table."""

import asyncio
from playwright.async_api import async_playwright

async def verify_final_elements():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page(viewport={"width": 1280, "height": 900})
        
        url = "http://localhost:8790/"
        print(f"Navigating to {url}...")
        await page.goto(url, wait_until="networkidle")
        await asyncio.sleep(2)
        
        # Screenshot 1: Section 04 - Price histogram
        print("Screenshot 1: Price histogram in section 04...")
        await page.evaluate("window.scrollTo(0, 3600)")
        await asyncio.sleep(0.5)
        await page.screenshot(path="final_01_price_histogram.png", full_page=False)
        
        # Screenshot 2: Sessions histogram
        print("Screenshot 2: Sessions histogram...")
        await page.evaluate("window.scrollTo(0, 3900)")
        await asyncio.sleep(0.5)
        await page.screenshot(path="final_02_sessions_histogram.png", full_page=False)
        
        # Screenshot 3: Correlation heatmap
        print("Screenshot 3: Correlation heatmap...")
        await page.evaluate("window.scrollTo(0, 4600)")
        await asyncio.sleep(0.5)
        await page.screenshot(path="final_03_heatmap.png", full_page=False)
        
        # Screenshot 4: Affordable mentors table in section 05
        print("Screenshot 4: Affordable mentors table...")
        await page.evaluate("window.scrollTo(0, 6400)")
        await asyncio.sleep(0.5)
        await page.screenshot(path="final_04_affordable_table.png", full_page=False)
        
        await browser.close()
        print("✓ All final element screenshots saved!")

if __name__ == "__main__":
    asyncio.run(verify_final_elements())
