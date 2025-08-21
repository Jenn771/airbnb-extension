import { clearSelectedDates, navigateForwardToMonth, getMonthIndex } from '../helpers/calendarHelpers.js';

export async function findWeekendCombinations(tabId, months) {
    const combinations = [];
    
    for (let monthIdx = 0; monthIdx < months.length; monthIdx++) {
        const currentMonth = months[monthIdx];
        
        if (monthIdx > 0) {
            await navigateForwardToMonth(tabId, currentMonth);
        }
        
        // Check if next month is consecutive and in the list for cross-month weekends
        const nextMonth = months[monthIdx + 1];
        const isNextMonthConsecutive = nextMonth && 
            getMonthIndex(nextMonth) === (getMonthIndex(currentMonth) + 1) % 12;
        
        const monthCombinations = await processMonthWeekends(
            tabId, 
            currentMonth, 
            nextMonth, 
            isNextMonthConsecutive
        );
        
        combinations.push(...monthCombinations);
    }
    console.log("Final combinations:", combinations);
    return combinations;
}

async function processMonthWeekends(tabId, currentMonth, nextMonth, canCheckNextMonth) {
    const combinations = [];

    const monthData = await chrome.scripting.executeScript({
        target: { tabId },
        func: () => {
            const currentMonthContainer = document.querySelector('div._ytfarf[data-visible="true"]');
            if (!currentMonthContainer) {
                throw new Error('Calendar container not found');
            }
            
            const table = currentMonthContainer.querySelector('table._cvkwaj');
            if (!table) {
                throw new Error('Calendar table not found');
            }
            
            const allWeeks = table.querySelectorAll('tbody tr');
            return allWeeks.length;
        }
    });
    
    const weekCount = monthData[0].result;
    if (!weekCount) {
        throw new Error(`No weeks found for month ${currentMonth}`);
    }
    
    for (let weekIdx = 0; weekIdx < weekCount; weekIdx++) {
        // Check regular weekend (Friday-Sunday within same month)
        const regularWeekend = await checkRegularWeekend(tabId, weekIdx);
        if (regularWeekend) {
            combinations.push(regularWeekend);
        }
        
        // Check cross-month weekend (only for last week if next month is consecutive)
        if (weekIdx === weekCount - 1 && canCheckNextMonth) {
            const crossMonthWeekend = await checkCrossMonthWeekend(tabId, nextMonth);
            if (crossMonthWeekend) {
                combinations.push(crossMonthWeekend);
            }
        }
    }
    
    return combinations;
}

async function checkRegularWeekend(tabId, weekIdx) {
    const result = await chrome.scripting.executeScript({
        target: { tabId },
        func: (weekIndex) => {
            function hasInvalidMinimum(label) {
                const match = label.match(/(\d+)\s+night minimum/i);
                if (!match) return false;
                const minNights = parseInt(match[1], 10);
                return minNights > 2;
            }

            function extractDateRange() {
                const dateRangeElement = document.querySelector('[data-testid="availability-calendar-date-range"]');
                return dateRangeElement ? dateRangeElement.textContent.trim() : null;
            }

            function extractTotalPrice() {
                const priceSelectors = [
                    'button span.umg93v9',
                    'div[aria-hidden="true"] span.umg93v9',
                    'span.umuerxh.atm_7l_dezgoh.atm_rd_us8791.atm_cs_1529pqs__oggzyc.atm_cs_kyjlp1__1v156lz'
                ];

                for (const selector of priceSelectors) {
                    const el = document.querySelector(selector);
                    if (el && el.textContent.includes('$')) {
                        return el.textContent.trim();
                    }
                }
                return null;
            }

            function findEnabledButton(cell) {
                if (!cell) return null;

                if (cell.getAttribute("role") === "button" && cell.getAttribute("aria-disabled") === "false") {
                    return cell;
                }

                return null;
            }

            function waitForUIUpdate(callback) {
                let attempts = 0;
                const maxAttempts = 20;
                
                const checkForData = () => {
                    const dateRange = extractDateRange();
                    const price = extractTotalPrice();
                    
                    if (dateRange && price) {
                        callback({ dateRange, totalPrice: price });
                        return;
                    }
                    
                    attempts++;
                    if (attempts < maxAttempts) {
                        setTimeout(checkForData, 100);
                    } else {
                        console.warn("Timeout waiting for price/date data");
                        callback(null);
                    }
                };
                
                checkForData();
            }

            return new Promise((resolve) => {
                const currentMonthContainer = document.querySelector('div._ytfarf[data-visible="true"]');
                const table = currentMonthContainer?.querySelector('table._cvkwaj');
                const allWeeks = table?.querySelectorAll('tbody tr');
                
                if (!currentMonthContainer || !table || weekIndex >= allWeeks.length - 1) {
                    resolve(null);
                    return; 
                }

                const currentWeek = allWeeks[weekIndex];
                const nextWeek = allWeeks[weekIndex + 1];
                
                const currentDays = currentWeek.querySelectorAll('td');
                const nextDays = nextWeek.querySelectorAll('td');
                
                const fridayBtn = findEnabledButton(currentDays[5]);
                const saturdayBtn = findEnabledButton(currentDays[6]);
                const sundayBtn = findEnabledButton(nextDays[0]);

                if (!fridayBtn || !saturdayBtn || !sundayBtn) {
                    resolve(null);
                    return;
                }

                // Check Friday conditions for valid check-in
                const fridayLabel = fridayBtn.getAttribute("aria-label") || "";
                const isFridayValid = fridayLabel.includes("check-in") && 
                                    !hasInvalidMinimum(fridayLabel);
                
                if (!isFridayValid) {
                    resolve(null);
                    return;
                }

                fridayBtn.click();
                
                setTimeout(() => {
                    sundayBtn.click();
                    
                    // Wait for UI to update with pricing information
                    waitForUIUpdate((result) => {
                        if (result) {
                            resolve(result);
                        } else {
                            resolve('need_clear');
                        }
                    });
                }, 300);
            });
        },
        args: [weekIdx]
    });

    if (result[0].result === 'need_clear') {
        await clearSelectedDates(tabId);
        return null;
    }

    return result[0].result;
}

async function checkCrossMonthWeekend(tabId, nextMonth) {
    const fridayResult = await chrome.scripting.executeScript({
        target: { tabId },
        func: () => {
            function hasInvalidMinimum(label) {
                const match = label.match(/(\d+)\s+night minimum/i);
                if (!match) return false;
                const minNights = parseInt(match[1], 10);
                return minNights > 2;
            }

            function findEnabledButton(cell) {
                if (!cell) return null;

                if (cell.getAttribute("role") === "button" && cell.getAttribute("aria-disabled") === "false") {
                    return cell;
                }

                return null;
            }

            const currentMonthContainer = document.querySelector('div._ytfarf[data-visible="true"]');
            const table = currentMonthContainer?.querySelector('table._cvkwaj');
            const allWeeks = table?.querySelectorAll('tbody tr');

            if (!allWeeks?.length) return null;

            const lastWeek = allWeeks[allWeeks.length - 1];
            const days = lastWeek.querySelectorAll('td');

            const fridayBtn = findEnabledButton(days[5]);
            const saturdayBtn = findEnabledButton(days[6]);
            
            if (!fridayBtn || !saturdayBtn) return null;
            
            // Check Friday conditions for valid check-in
            const fridayLabel = fridayBtn.getAttribute("aria-label") || "";
            const isFridayValid = fridayLabel.includes("check-in") && 
                                !hasInvalidMinimum(fridayLabel);
            
            if (!isFridayValid) return null;
            
            fridayBtn.click();
            return 'friday_clicked';
        }
    });
    
    if (!fridayResult[0].result) return null;
    
    await navigateForwardToMonth(tabId, nextMonth);
    
    const sundayResult = await chrome.scripting.executeScript({
        target: { tabId },
        func: () => {
            function extractDateRange() {
                const dateRangeElement = document.querySelector('[data-testid="availability-calendar-date-range"]');
                return dateRangeElement ? dateRangeElement.textContent.trim() : null;
            }

            function extractTotalPrice() {
                const priceSelectors = [
                    'button span.umg93v9',
                    'div[aria-hidden="true"] span.umg93v9',
                    'span.umuerxh.atm_7l_dezgoh.atm_rd_us8791.atm_cs_1529pqs__oggzyc.atm_cs_kyjlp1__1v156lz'
                ];

                for (const selector of priceSelectors) {
                    const el = document.querySelector(selector);
                    if (el && el.textContent.includes('$')) {
                        return el.textContent.trim();
                    }
                }
                return null;
            }

            function findEnabledButton(cell) {
                if (!cell) return null;

                if (cell.getAttribute("role") === "button" && cell.getAttribute("aria-disabled") === "false") {
                    return cell;
                }

                return null;
            }

            function waitForUIUpdate(callback) {
                let attempts = 0;
                const maxAttempts = 20;
                
                const checkForData = () => {
                    const dateRange = extractDateRange();
                    const price = extractTotalPrice();
                    
                    if (dateRange && price) {
                        callback({ dateRange, totalPrice: price });
                        return;
                    }
                    
                    attempts++;
                    if (attempts < maxAttempts) {
                        setTimeout(checkForData, 100);
                    } else {
                        console.warn("Timeout waiting for cross-month price/date data");
                        callback(null);
                    }
                };
                
                checkForData();
            }

            return new Promise((resolve) => {
                const currentMonthContainer = document.querySelector('div._ytfarf[data-visible="true"]');
                const table = currentMonthContainer?.querySelector('table._cvkwaj');
                const allWeeks = table?.querySelectorAll('tbody tr');
                
                if (!currentMonthContainer || !table || !allWeeks) {
                    resolve('need_clear');
                    return; 
                }

                const firstWeek = allWeeks[0];
                const days = firstWeek.querySelectorAll('td');
                const sundayBtn = findEnabledButton(days[0]);

                if (!sundayBtn) {
                    resolve('need_clear');
                    return;
                }
                
                sundayBtn.click();
                
                waitForUIUpdate((result) => {
                    if (result) {
                        resolve(result);
                    } else {
                        resolve('need_clear');
                    }
                });
            });
        }
    });
    
    if (sundayResult[0].result === 'need_clear') {
        await clearSelectedDates(tabId);
        return null;
    }
    
    return sundayResult[0].result;
}