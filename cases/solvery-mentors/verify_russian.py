#!/usr/bin/env python3
"""Verify Russian text throughout the page."""

import asyncio
from playwright.async_api import async_playwright

async def verify_russian():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page(viewport={"width": 1280, "height": 900})
        
        url = "http://localhost:8790/cases/solvery-mentors/index.html"
        print(f"Navigating to {url}...")
        await page.goto(url, wait_until="networkidle")
        await asyncio.sleep(2)
        
        # Screenshot 1: Top - hero and intro
        print("Screenshot 1: Hero and intro...")
        await page.screenshot(path="russian_01_hero.png", full_page=False)
        
        # Screenshot 2: Marketplace metrics and section 01
        print("Screenshot 2: Marketplace metrics and section 01...")
        await page.evaluate("window.scrollTo(0, 700)")
        await asyncio.sleep(0.5)
        await page.screenshot(path="russian_02_metrics_section01.png", full_page=False)
        
        # Screenshot 3: Section 03 - Demand vs Supply
        print("Screenshot 3: Section 03 Demand vs Supply...")
        await page.evaluate("window.scrollTo(0, 3200)")
        await asyncio.sleep(0.5)
        await page.screenshot(path="russian_03_demand_supply.png", full_page=False)
        
        # Screenshot 4: Section 05 - Core vs Long Tail
        print("Screenshot 4: Section 05 Core vs Long Tail...")
        await page.evaluate("window.scrollTo(0, 5400)")
        await asyncio.sleep(0.5)
        await page.screenshot(path="russian_04_core_longtail.png", full_page=False)
        
        # Screenshot 5: Section 06 - Mechanisms
        print("Screenshot 5: Section 06 Mechanisms...")
        await page.evaluate("window.scrollTo(0, 7200)")
        await asyncio.sleep(0.5)
        await page.screenshot(path="russian_05_mechanisms.png", full_page=False)
        
        # Screenshot 6: Section 07 - Conclusions
        print("Screenshot 6: Section 07 Conclusions...")
        await page.evaluate("window.scrollTo(0, 8000)")
        await asyncio.sleep(0.5)
        await page.screenshot(path="russian_06_conclusions.png", full_page=False)
        
        # Screenshot 7: More of Section 07
        print("Screenshot 7: More Section 07...")
        await page.evaluate("window.scrollTo(0, 8600)")
        await asyncio.sleep(0.5)
        await page.screenshot(path="russian_07_conclusions_more.png", full_page=False)
        
        # Full page screenshot
        print("Taking full page screenshot...")
        await page.screenshot(path="russian_full_page.png", full_page=True)
        
        await browser.close()
        print("✓ All Russian text verification screenshots saved!")

if __name__ == "__main__":
    asyncio.run(verify_russian())
