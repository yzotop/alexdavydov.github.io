#!/usr/bin/env python3
"""Verify the two new charts: Demand vs Supply and Core vs Long Tail."""

import asyncio
from playwright.async_api import async_playwright

async def verify_new_charts():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page(viewport={"width": 1280, "height": 900})
        
        url = "http://localhost:8903/cases/solvery-mentors/index.html"
        print(f"Navigating to {url}...")
        await page.goto(url, wait_until="networkidle")
        await asyncio.sleep(2)
        
        # Screenshot 1: Scroll to cold start chart area (to see demand/supply chart below it)
        print("Screenshot 1: Scrolling to cold start / demand-supply area...")
        await page.evaluate("window.scrollTo(0, 2800)")
        await asyncio.sleep(0.5)
        await page.screenshot(path="new_chart_01_demand_supply.png", full_page=False)
        
        # Screenshot 2: Scroll a bit more to see full demand-supply chart
        print("Screenshot 2: Full demand-supply chart...")
        await page.evaluate("window.scrollTo(0, 3200)")
        await asyncio.sleep(0.5)
        await page.screenshot(path="new_chart_02_demand_supply_full.png", full_page=False)
        
        # Screenshot 3: Scroll to Lorenz curve area
        print("Screenshot 3: Lorenz curve area...")
        await page.evaluate("window.scrollTo(0, 4800)")
        await asyncio.sleep(0.5)
        await page.screenshot(path="new_chart_03_lorenz.png", full_page=False)
        
        # Screenshot 4: Scroll to core vs long tail chart (after Lorenz)
        print("Screenshot 4: Core vs Long Tail chart...")
        await page.evaluate("window.scrollTo(0, 5200)")
        await asyncio.sleep(0.5)
        await page.screenshot(path="new_chart_04_core_longtail.png", full_page=False)
        
        await browser.close()
        print("✓ All new chart verification screenshots saved!")

if __name__ == "__main__":
    asyncio.run(verify_new_charts())
