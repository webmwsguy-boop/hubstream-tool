const express = require('express');
const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');

const app = express();
app.use(express.static('public'));

app.get('/api/get-link', async (req, res) => {
    const targetUrl = req.query.url;
    if (!targetUrl) return res.status(400).json({ error: 'URL provide karein' });

    let browser;
    try {
        browser = await puppeteer.launch({
            args: chromium.args,
            defaultViewport: chromium.defaultViewport,
            executablePath: await chromium.executablePath(),
            headless: chromium.headless,
        });

        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        
        await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 60000 });

        // Ad layer block karna
        await page.evaluate(() => {
            window.cache_loader = { init: function() {} };
            document.querySelectorAll('div[style*="position:fixed;inset:0px"]').forEach(el => el.remove());
        });

        const downloadLinkPromise = new Promise((resolve) => {
            page.on('response', async (response) => {
                if (response.request().resourceType() === 'fetch' || response.request().resourceType() === 'xhr') {
                    try {
                        const text = await response.text();
                        if (text.includes('.mkv') || text.includes('.mp4') || text.includes('hubstream')) {
                            resolve(text);
                        }
                    } catch (e) {}
                }
            });
        });

        // Get Video par auto click
        await page.click('.downloader-button');

        const linkData = await Promise.race([
            downloadLinkPromise,
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 15000))
        ]);

        res.json({ success: true, data: linkData });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    } finally {
        if (browser) await browser.close();
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server chal raha hai port ${PORT} par`));
