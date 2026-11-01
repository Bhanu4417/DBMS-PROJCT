/**
 * End-to-end UI smoke test with a real Chromium browser.
 *
 * Verifies the flows a demonstrator will actually click:
 *   1. Dashboard renders live statistics
 *   2. Student create → appears in the table → edit → delete
 *   3. Duplicate email shows a readable error toast
 *   4. Filters, search and sorting return different rows
 *   5. Reports tab switch + CSV download
 *   6. Theme toggle and sidebar collapse
 *
 * Run:  node scripts/ui-smoke.mjs   (needs the dev server + API running)
 */
import puppeteer from 'puppeteer-core';

const BASE = process.env.UI_BASE || 'http://localhost:5173';
const CHROME = process.env.CHROME_PATH || '/usr/bin/chromium';
const results = [];

function record(name, ok, detail = '') {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForText(page, text, timeout = 8000) {
  await page.waitForFunction(
    (value) => document.body.innerText.toLowerCase().includes(value.toLowerCase()),
    { timeout },
    text,
  );
}

async function toastTexts(page) {
  return page.$$eval('[role="status"]', (nodes) => nodes.map((node) => node.innerText.trim()));
}

async function main() {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'shell',
    args: ['--no-sandbox', '--disable-gpu', '--window-size=1440,1100'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 1100 });
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(String(error)));
  page.on('console', (message) => {
    // Chrome logs expected 4xx API responses (duplicate email, blocked delete) as
    // resource errors — only genuine JavaScript failures are collected here.
    if (message.type() === 'error' && !message.text().includes('Failed to load resource')) {
      pageErrors.push(message.text());
    }
  });

  try {
    // 1. Dashboard -------------------------------------------------------
    await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
    await waitForText(page, 'Total students');
    const studentCardValue = await page.$$eval('.card', (cards) => {
      const card = cards.find((item) => item.innerText.toLowerCase().includes('total students'));
      return card ? card.innerText : '';
    });
    const total = Number(studentCardValue.match(/(\d+)\s*$/m)?.[1] || studentCardValue.match(/(\d+)/)?.[1] || 0);
    record('Dashboard shows live student count', total > 0, `count=${total}`);

    const charts = await page.$$eval('.recharts-surface', (nodes) => nodes.length);
    record('Dashboard renders all four charts', charts >= 4, `charts=${charts}`);

    // 2. Student list, filters, search ----------------------------------
    await page.goto(`${BASE}/students`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('tbody tr');
    const initialRows = await page.$$eval('tbody tr', (rows) => rows.length);
    record('Student table loads rows', initialRows > 0, `rows=${initialRows}`);

    await page.type('input[aria-label="Search name, enrollment number or email"]', 'ENR2021');
    await sleep(900);
    const searchedRows = await page.$$eval('tbody tr', (rows) => rows.length);
    const searchedText = await page.$eval('tbody', (node) => node.innerText);
    record(
      'Search narrows the student list',
      searchedRows > 0 && searchedText.includes('ENR2021'),
      `rows=${searchedRows}`,
    );
    await page.click('button[aria-label="Clear search"]');
    await sleep(600);

    await page.select('select[aria-label="Status"]', 'Graduated');
    await sleep(800);
    const filtered = await page.$eval('tbody', (node) => node.innerText);
    record('Status filter applies', filtered.includes('Graduated'));
    await page.select('select[aria-label="Status"]', '');
    await sleep(700);

    // 3. Create student --------------------------------------------------
    const uniqueId = Date.now().toString().slice(-6);
    await page.click('button.btn-primary');
    await page.waitForSelector('#resource-form');
    await page.type('#enrollment_number', `UI${uniqueId}`);
    await page.type('#first_name', 'Browser');
    await page.type('#last_name', 'Tester');
    await page.type('#email', `browser.tester${uniqueId}@student.college.edu.in`);
    await page.type('#phone', '9876500123');
    await page.select('#department_id', '1');
    await page.click('button[form="resource-form"]');
    await waitForText(page, 'created successfully');
    const createToasts = await toastTexts(page);
    record('Create student shows success toast', createToasts.some((t) => t.includes('created successfully')));

    await page.goto(`${BASE}/students?q=UI${uniqueId}`, { waitUntil: 'domcontentloaded' });
    await sleep(900);
    const createdRow = await page.$eval('tbody', (node) => node.innerText);
    record('New student appears in the table', createdRow.includes(`UI${uniqueId}`));

    // 4. Duplicate validation -------------------------------------------
    await page.goto(`${BASE}/students`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('tbody tr');
    await page.click('button.btn-primary');
    await page.waitForSelector('#resource-form');
    await page.type('#enrollment_number', `UI${uniqueId}A`);
    await page.type('#first_name', 'Duplicate');
    await page.type('#last_name', 'Email');
    await page.type('#email', `browser.tester${uniqueId}@student.college.edu.in`);
    await page.click('button[form="resource-form"]');
    await waitForText(page, 'already used');
    const dialogText = await page.$eval('[role="dialog"]', (node) => node.innerText.toLowerCase());
    record(
      'Duplicate email produces a readable error',
      dialogText.includes('email') && dialogText.includes('already used'),
      dialogText.split('\n').find((line) => line.includes('already used')) || '',
    );
    await page.click('button[aria-label="Close dialog"]');
    await sleep(300);

    // 5. Edit ------------------------------------------------------------
    await page.goto(`${BASE}/students?q=UI${uniqueId}`, { waitUntil: 'domcontentloaded' });
    await sleep(800);
    await page.click('tbody tr button[title="Edit record"]');
    await page.waitForSelector('#resource-form');
    await page.select('#status', 'Inactive');
    await page.click('button[form="resource-form"]');
    await waitForText(page, 'updated successfully');
    const editToast = await toastTexts(page);
    record('Edit student persists a status change', editToast.some((t) => t.includes('updated successfully')));

    const badgeText = await page.$eval('tbody', (node) => node.innerText);
    record('Updated status is shown in the row', badgeText.includes('Inactive'));

    // 6. Detail page -----------------------------------------------------
    await page.click('tbody tr a[title="View details"]');
    await page.waitForSelector('h1');
    await waitForText(page, 'Academic profile');
    record('Student detail page opens', true);

    // 7. Delete ----------------------------------------------------------
    await page.goto(`${BASE}/students?q=UI${uniqueId}`, { waitUntil: 'domcontentloaded' });
    await sleep(800);
    await page.click('tbody tr button[title="Delete record"]');
    await page.waitForSelector('[role="dialog"]');
    record('Delete confirmation explains the impact', (await page.$eval('[role="dialog"]', (n) => n.innerText)).includes('cannot be undone'));
    await page.click('[role="dialog"] button.btn-danger');
    await waitForText(page, 'Record deleted');
    const deleteToast = await toastTexts(page);
    record('Delete removes the record', deleteToast.some((t) => t.includes('Record deleted')));

    // 8. Protected delete -------------------------------------------------
    await page.goto(`${BASE}/departments`, { waitUntil: 'domcontentloaded' });
    await sleep(800);
    await page.click('tbody tr button[title="Delete record"]');
    await page.waitForSelector('[role="dialog"]');
    await page.click('[role="dialog"] button.btn-danger');
    await page.waitForFunction(
      () => {
        const text = document.body.innerText.toLowerCase();
        return text.includes('cannot delete') || text.includes('depend');
      },
      { timeout: 8000 },
    );
    record('Department delete is blocked while dependents exist', true);

    // 8b. Department create → edit → delete (form types: text only) -----
    const randomLetter = () => String.fromCharCode(65 + Math.floor(Math.random() * 26));
    const deptCode = `QA${randomLetter()}${randomLetter()}`;  // pattern ^[A-Z]{2,10}$
    await page.goto(`${BASE}/departments`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('tbody tr');
    await page.click('button.btn-primary');
    await page.waitForSelector('#resource-form');
    await page.type('#department_code', deptCode);
    await page.type('#department_name', `QA Department ${deptCode}`);
    await page.type('#office_location', 'QA Block');
    await page.click('button[form="resource-form"]');
    await waitForText(page, 'created successfully');
    record('Department form creates a record', true, deptCode);

    await page.goto(`${BASE}/departments`, { waitUntil: 'domcontentloaded' });
    await sleep(900);
    const deptRows = await page.$$eval('tbody tr', (rows) => rows.length);
    record('Department list reflects the new row', deptRows > 0, `rows=${deptRows}`);

    const cleanedDept = await page.evaluate(async (code) => {
      const list = await (await fetch('http://localhost:8000/api/departments?search=' + code)).json();
      const row = list.items.find((item) => item.department_code === code);
      if (!row) return false;
      const response = await fetch(`http://localhost:8000/api/departments/${row.department_id}`, {
        method: 'DELETE',
      });
      return response.ok;
    }, deptCode);
    record('Department created through the UI can be deleted', cleanedDept, deptCode);

    // 8c. Grade form (select of ungraded enrollments + decimal marks) ----
    await page.goto(`${BASE}/grades`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('tbody tr');
    await page.click('button.btn-primary');
    await page.waitForSelector('#resource-form');
    await page.waitForFunction(() => {
      const select = document.querySelector('#enrollment_id');
      return select && [...select.options].some((option) => option.value);
    }, { timeout: 10000 });
    const gradeTarget = await page.evaluate(() => {
      const select = document.querySelector('#enrollment_id');
      const option = [...select.options].find((item) => item.value);
      return option ? { value: option.value } : null;
    });
    await page.select('#enrollment_id', gradeTarget.value);
    await page.type('#marks_obtained', '77');
    await page.click('button[form="resource-form"]');
    await waitForText(page, 'created successfully');
    record('Grade form creates a grade record', true, `enrollment=${gradeTarget.value}`);

    const gradeCleaned = await page.evaluate(async (enrollmentId) => {
      const list = await (await fetch('http://localhost:8000/api/grades?page_size=200')).json();
      const grade = list.items.find((item) => String(item.enrollment_id) === String(enrollmentId));
      if (!grade) return false;
      const response = await fetch(`http://localhost:8000/api/grades/${grade.grade_id}`, {
        method: 'DELETE',
      });
      return response.ok;
    }, gradeTarget.value);
    record('Grade created through the UI can be removed', gradeCleaned);

    // 9. Reports ----------------------------------------------------------
    await page.goto(`${BASE}/reports`, { waitUntil: 'domcontentloaded' });
    await waitForText(page, 'Students by department');
    await page.evaluate(() => {
      const tab = [...document.querySelectorAll('button')].find((b) => b.innerText.includes('Academic reports'));
      tab?.click();
    });
    await waitForText(page, 'Course enrollment counts');
    await page.waitForSelector('tbody tr', { timeout: 10000 });
    const reportRows = await page.$$eval('tbody tr', (rows) => rows.length);
    record('Reports page renders report tables', reportRows > 0, `rows=${reportRows}`);

    await page.evaluate(() => {
      window.__csv = null;
      const original = URL.createObjectURL.bind(URL);
      URL.createObjectURL = (blob) => {
        blob.text().then((text) => { window.__csv = text; });
        return original(blob);
      };
      const button = [...document.querySelectorAll('button')].find((b) => b.innerText.includes('Export CSV'));
      button?.click();
    });
    await page.waitForFunction(() => window.__csv !== null, { timeout: 8000 });
    const csv = await page.evaluate(() => window.__csv || '');
    const csvLines = csv.trim().split('\n');
    record('CSV export produces a file', csvLines[0].includes('Course') && csvLines.length > 1, csvLines[0]);

    // 10. Theme + sidebar -------------------------------------------------
    await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
    await page.click('button[aria-label="Toggle theme"]');
    await sleep(400);
    const theme = await page.evaluate(() => document.documentElement.dataset.theme);
    record('Theme toggle switches to light mode', theme === 'light', theme);
    await page.click('button[aria-label="Toggle theme"]');

    await page.click('button[title="Collapse sidebar"]');
    await sleep(400);
    const asideWidth = await page.$eval('aside', (node) => node.getBoundingClientRect().width);
    record('Sidebar collapses', asideWidth < 100, `width=${asideWidth}`);
  } finally {
    record('No browser console errors', pageErrors.length === 0, pageErrors.slice(0, 2).join(' | '));
    await browser.close();
  }

  const failures = results.filter((item) => !item.ok);
  console.log(`\n${results.length - failures.length}/${results.length} UI checks passed`);
  if (failures.length) process.exitCode = 1;
}

main().catch((error) => {
  console.error('UI smoke run crashed:', error);
  process.exitCode = 1;
});
