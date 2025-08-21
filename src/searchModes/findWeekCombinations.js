import { clearSelectedDates, navigateForwardToMonth, getMonthIndex } from '../helpers/calendarHelpers.js';

export async function findWeekCombinations(tabId, months) {
    const combinations = [];
    
    for (let monthIdx = 0; monthIdx < months.length; monthIdx++) {
        const currentMonth = months[monthIdx];
        
        if (monthIdx > 0) {
            await navigateForwardToMonth(tabId, currentMonth);
        }
        
        // Check if next month is consecutive and in the list
        const nextMonth = months[monthIdx + 1];
        const isNextMonthConsecutive = nextMonth && 
            getMonthIndex(nextMonth) === (getMonthIndex(currentMonth) + 1) % 12;
        
        const monthCombinations = await processMonthWeeks(
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

async function processMonthWeeks(tabId, currentMonth, nextMonth, canCheckNextMonth) {
    const combinations = [];
    let checkCrossMonth = true;

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
        const regularWeek = await checkRegularWeek(tabId, weekIdx);

        if (regularWeek) {
            // Prevent cross-month check if last week has valid regular week
            if (weekIdx === weekCount - 1) {
                checkCrossMonth = false;
            }
            combinations.push(regularWeek);
        }

        // Only check cross-month for last week of consecutive months
        if (weekIdx === weekCount - 1 && canCheckNextMonth && checkCrossMonth) {
            const crossMonthWeek = await checkCrossMonthWeek(tabId, nextMonth);
            if (crossMonthWeek) {
                combinations.push(crossMonthWeek);
            }
        }
    }
    
    return combinations;
}

async function checkRegularWeek(tabId, weekIdx) {
    const result = await chrome.scripting.executeScript({
        target: { tabId },
        func: (weekIndex) => {
            function hasInvalidMinimum(label) {
                const match = label.match(/(\d+)\s+night minimum/i);
                if (!match) return false;
                const minNights = parseInt(match[1], 10);
                return minNights > 5;
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
                
                if (!currentMonthContainer || !table) {
                    resolve(null);
                    return; 
                }

                const currentWeek = allWeeks[weekIndex];
                const currentDays = currentWeek.querySelectorAll('td');
                
                const sundayBtn = findEnabledButton(currentDays[0]);
                const mondayBtn = findEnabledButton(currentDays[1]);
                const tuesdayBtn = findEnabledButton(currentDays[2]);
                const wednesdayBtn = findEnabledButton(currentDays[3]);
                const thursdayBtn = findEnabledButton(currentDays[4]);
                const fridayBtn = findEnabledButton(currentDays[5]);

                if (!sundayBtn || !mondayBtn || !tuesdayBtn || !wednesdayBtn || !thursdayBtn || !fridayBtn) {
                    resolve(null);
                    return;
                }

                const sundayLabel = sundayBtn.getAttribute("aria-label") || "";
                const isSundayValid = sundayLabel.includes("check-in") && 
                                    !hasInvalidMinimum(sundayLabel);
                
                if (!isSundayValid) {
                    resolve(null);
                    return;
                }

                sundayBtn.click();
                
                // Small delay for UI state transition before selecting check-out
                setTimeout(() => {
                    fridayBtn.click();
                    
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

async function checkCrossMonthWeek(tabId, nextMonth) {
    const sundayResult = await chrome.scripting.executeScript({
        target: { tabId },
        func: () => {
            function hasInvalidMinimum(label) {
                const match = label.match(/(\d+)\s+night minimum/i);
                if (!match) return false;
                const minNights = parseInt(match[1], 10);
                return minNights > 5;
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
            const sundayBtn = findEnabledButton(days[0]);
            
            if (!sundayBtn) return null;
            
            const sundayLabel = sundayBtn.getAttribute("aria-label") || "";
            const isSundayValid = sundayLabel.includes("check-in") && 
                                !hasInvalidMinimum(sundayLabel);
            
            if (!isSundayValid) return null;
            
            sundayBtn.click();
            return 'sunday_clicked';
        }
    });
    
    if (!sundayResult[0].result) return null;
    
    await navigateForwardToMonth(tabId, nextMonth);
    
    const fridayResult = await chrome.scripting.executeScript({
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
                const fridayBtn = findEnabledButton(days[5]);

                if (!fridayBtn) {
                    resolve('need_clear');
                    return;
                }
                
                fridayBtn.click();
                
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
    
    if (fridayResult[0].result === 'need_clear') {
        await clearSelectedDates(tabId);
        return null;
    }
    
    return fridayResult[0].result;
}