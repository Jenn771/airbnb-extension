import { clearSelectedDates, navigateForwardToMonth, getMonthIndex } from '../helpers/calendarHelpers.js';

export async function findWeekendCombinations(tabId, months) {
    const combinations = [];
    
    for (let monthIdx = 0; monthIdx < months.length; monthIdx++) {
        const currentMonth = months[monthIdx];
        
        // Navigate to current month (should already be there for first month)
        if (monthIdx > 0) {
            await navigateForwardToMonth(tabId, currentMonth);
        }
        
        // Check if next month is consecutive and in the list
        const nextMonth = months[monthIdx + 1];
        const isNextMonthConsecutive = nextMonth && 
            getMonthIndex(nextMonth) === (getMonthIndex(currentMonth) + 1) % 12;
        
        console.log(`Next month: ${nextMonth}, Consecutive: ${isNextMonthConsecutive}`);
        
        // Process current month weekends
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

    // Get week count for current month
    const monthData = await chrome.scripting.executeScript({
        target: { tabId },
        func: () => {
            const currentMonthContainer = document.querySelector('div._ytfarf[data-visible="true"]');
            if (!currentMonthContainer) return null;
            
            const table = currentMonthContainer.querySelector('table._cvkwaj');
            if (!table) return null;
            
            const allWeeks = table.querySelectorAll('tbody tr');
            return allWeeks.length;
        }
    });
    
    const weekCount = monthData[0].result;
    if (!weekCount) return combinations;
    
    // Process each week in current month
    for (let weekIdx = 0; weekIdx < weekCount; weekIdx++) {
        console.log(`Processing week ${weekIdx + 1} of ${weekCount}`);
        
        // Check regular weekend (Friday-Sunday within same month)
        const regularWeekend = await checkRegularWeekend(tabId, weekIdx);
        if (regularWeekend) {
            combinations.push(regularWeekend);
        }
        
        // Check cross-month weekend (only for last week if next month is consecutive)
        if (weekIdx === weekCount - 1 && canCheckNextMonth) {
            console.log(`Checking cross-month weekend from ${currentMonth} to ${nextMonth}`);
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
            // Helper functions
            function hasInvalidMinimum(label) {
                const match = label.match(/(\d+)\s+night minimum/i);
                if (!match) return false;
                const minNights = parseInt(match[1], 10);
                return minNights > 2;
            }

            function extractDateRange() {
                const dateRangeElement = document.querySelector('[data-testid="availability-calendar-date-range"]');
                return dateRangeElement ? dateRangeElement.textContent.trim() : null; // e.g., "Sep 19, 2025 - Sep 21, 2025"
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

            return new Promise((resolve) => {
                const currentMonthContainer = document.querySelector('div._ytfarf[data-visible="true"]');
                const table = currentMonthContainer?.querySelector('table._cvkwaj');
                const allWeeks = table?.querySelectorAll('tbody tr');
                
                if (!currentMonthContainer || !table || weekIndex >= allWeeks.length - 1) {
                    resolve(null); // Last week of current month, so might need next week's Sunday
                    return; 
                }

                const currentWeek = allWeeks[weekIndex];
                const nextWeek = allWeeks[weekIndex + 1];
                
                const currentDays = currentWeek.querySelectorAll('td');
                const nextDays = nextWeek.querySelectorAll('td');
                
                const fridayBtn = findEnabledButton(currentDays[5]);
                const saturdayBtn = findEnabledButton(currentDays[6]);
                const sundayBtn = findEnabledButton(nextDays[0]);

                console.log("Weekend cells:", { fridayBtn, saturdayBtn, sundayBtn });

                if (!fridayBtn || !saturdayBtn || !sundayBtn) {
                    console.log("Missing one of the weekend buttons");
                    resolve(null);
                    return;
                }

                // Check Friday conditions
                const fridayLabel = fridayBtn.getAttribute("aria-label") || "";
                const isFridayValid = fridayLabel.includes("check-in") && 
                                    !hasInvalidMinimum(fridayLabel);
                
                if (!isFridayValid) {
                    resolve(null);
                    return;
                }

                // Click Friday (check-in) and Sunday (check-out)
                fridayBtn.click();
                
                setTimeout(() => {
                    sundayBtn.click();
                    
                    setTimeout(() => {
                        const checkInOut = extractDateRange();
                        const totalPrice = extractTotalPrice();
                        
                        if (checkInOut && totalPrice) {
                            console.log("Found regular weekend:", checkInOut, totalPrice);
                            resolve({
                                dateRange: checkInOut,
                                totalPrice: totalPrice
                            });
                        } else {
                            resolve('need_clear');
                        }
                    }, 1000);
                }, 200);
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
    // Get Friday from current month's last week
    const fridayResult = await chrome.scripting.executeScript({
        target: { tabId },
        func: () => {
            // Helper Functions
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
            
            // Check Friday conditions
            const fridayLabel = fridayBtn.getAttribute("aria-label") || "";
            const isFridayValid = fridayLabel.includes("check-in") && 
                                !hasInvalidMinimum(fridayLabel);
            
            if (!isFridayValid) return null;
            

            fridayBtn.click();
            return 'friday_clicked';
        }
    });
    
    if (!fridayResult[0].result) return null;
    
    // Navigate to next month
    await navigateForwardToMonth(tabId, nextMonth);
    
    // Click Sunday in first week of next month
    const sundayResult = await chrome.scripting.executeScript({
        target: { tabId },
        func: () => {
            // Helper Functions
            function extractDateRange() {
                const dateRangeElement = document.querySelector('[data-testid="availability-calendar-date-range"]');
                return dateRangeElement ? dateRangeElement.textContent.trim() : null; // e.g., "Sep 19, 2025 - Sep 21, 2025"
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
                
                setTimeout(() => {
                    const checkInOut = extractDateRange();
                    const totalPrice = extractTotalPrice();
                    
                    if (checkInOut && totalPrice) {
                        console.log("Found cross-month weekend:", checkInOut, totalPrice);
                        resolve({
                            dateRange: checkInOut,
                            totalPrice: totalPrice
                        });
                    } else {
                        resolve('need_clear');
                    }
                }, 1000);
            });
        }
    });
    
    if (sundayResult[0].result === 'need_clear') {
        await clearSelectedDates(tabId);
        return null;
    }

    await new Promise(resolve => setTimeout(resolve, 500));
    
    return sundayResult[0].result;
}
