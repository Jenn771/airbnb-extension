import { clearSelectedDates, navigateForwardToMonth, navigateBackwardToMonth, getMonthIndex } from '../helpers/calendarHelpers.js';

export async function findNNightCombinations(tabId, months, nights) {
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
        
        // Process current month for N-night stays
        const monthCombinations = await processMonthNNights(
            tabId, 
            currentMonth, 
            nextMonth, 
            isNextMonthConsecutive,
            nights
        );
        
        combinations.push(...monthCombinations);
    }
    console.log(`Final ${nights}-night combinations:`, combinations);
    return combinations;
}

async function processMonthNNights(tabId, currentMonth, nextMonth, canCheckNextMonth, nights) {
    const combinations = [];

    // Get week count for current month
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
    
    // Process each week in current month
    for (let weekIdx = 0; weekIdx < weekCount; weekIdx++) {
        console.log(`Processing week ${weekIdx + 1} of ${weekCount}`);
        
        // Check regular week combinations
        const regularWeek = await checkRegularWeek(tabId, weekIdx, nights, weekCount);

        if (regularWeek && regularWeek.length > 0) {
            combinations.push(...regularWeek);
        }
    }

    // Check cross-month N-night stays (only if next month is consecutive)
    if (canCheckNextMonth) {
        console.log(`Checking cross-month ${nights}-night stays from ${currentMonth} to ${nextMonth}`);
        const crossMonthStays = await checkCrossMonthNNight(tabId, currentMonth, nextMonth, nights);
        if (crossMonthStays && crossMonthStays.length > 0) {
            combinations.push(...crossMonthStays);
        }
    }
    
    return combinations;
}

// Check regular week combinations (same week and cross-week within same month)
async function checkRegularWeek(tabId, weekIdx, nights, totalWeeks) {
    const combinations = [];
    
    // Get all possible starting positions for this week
    const possibleStarts = await chrome.scripting.executeScript({
        target: { tabId },
        func: (weekIndex, requiredNights, totalWeekCount) => {
            function hasInvalidMinimum(label, requiredNights) {
                const match = label.match(/(\d+)\s+night minimum/i);
                if (!match) return false;
                const minNights = parseInt(match[1], 10);
                return minNights > requiredNights;
            }

            function findEnabledButton(cell) {
                if (!cell) return null;
                return (cell.getAttribute("role") === "button" && 
                       cell.getAttribute("aria-disabled") === "false") ? cell : null;
            }

            const currentMonthContainer = document.querySelector('div._ytfarf[data-visible="true"]');
            const table = currentMonthContainer?.querySelector('table._cvkwaj');
            const allWeeks = table?.querySelectorAll('tbody tr');
            
            if (!currentMonthContainer || !table) {
                return [];
            }

            const currentWeek = allWeeks[weekIndex];
            if (!currentWeek) {
                return [];
            }
            
            const currentDays = currentWeek.querySelectorAll('td');
            
            // Get all day buttons for the current week
            const currentWeekButtons = [];
            for (let i = 0; i < 7; i++) {
                currentWeekButtons.push(findEnabledButton(currentDays[i]));
            }

            // Get next week buttons if it exists (for cross-week combinations within same month)
            const nextWeek = allWeeks[weekIndex + 1];
            const nextWeekButtons = [];
            if (nextWeek) {
                const nextWeekDays = nextWeek.querySelectorAll('td');
                for (let i = 0; i < 7; i++) {
                    nextWeekButtons.push(findEnabledButton(nextWeekDays[i]));
                }
            }

            // Combine all available buttons (current week + next week if available)
            const allButtons = [...currentWeekButtons, ...nextWeekButtons];

            // Find ALL valid check-in/check-out combinations
            const validCombinations = [];
            
            for (let dayIdx = 0; dayIdx < currentWeekButtons.length; dayIdx++) {
                const checkInBtn = currentWeekButtons[dayIdx];
                if (!checkInBtn) continue;
                
                const label = checkInBtn.getAttribute("aria-label") || "";
                const isValidCheckIn = label.includes("check-in") &&
                                       !hasInvalidMinimum(label, requiredNights);
                
                if (isValidCheckIn) {
                    const checkOutIndex = dayIdx + requiredNights;
                    
                    // Only allow combinations that stay within the same month
                    if (checkOutIndex < allButtons.length && allButtons[checkOutIndex]) {
                        const isCurrentWeekCombo = checkOutIndex < currentWeekButtons.length;
                        const isCrossWeekCombo = checkOutIndex >= currentWeekButtons.length && nextWeek;
                        
                        // Skip cross-week combinations for the last week
                        if (isCrossWeekCombo && weekIndex === totalWeekCount - 1) {
                            continue;
                        }
                        
                        validCombinations.push({
                            checkInIndex: dayIdx,
                            checkOutIndex: checkOutIndex,
                            isCrossWeek: isCrossWeekCombo,
                            checkOutWeekIndex: isCrossWeekCombo ? weekIndex + 1 : weekIndex,
                            checkOutDayInWeek: isCrossWeekCombo ? checkOutIndex - currentWeekButtons.length : checkOutIndex
                        });
                    }
                }
            }

            return validCombinations;
        },
        args: [weekIdx, nights, totalWeeks]
    });

    const validCombinations = possibleStarts[0].result;
    
    if (!validCombinations || validCombinations.length === 0) {
        return combinations;
    }

    console.log(`Found ${validCombinations.length} potential ${nights}-night combinations in week ${weekIdx + 1}`);

    for (const combo of validCombinations) {
        let stayResult;
        
        if (combo.isCrossWeek) {
            stayResult = await checkCrossWeekCombination(
                tabId, 
                weekIdx, 
                combo.checkInIndex, 
                combo.checkOutWeekIndex, 
                combo.checkOutDayInWeek, 
                nights
            );
        } else {
            stayResult = await checkSameWeekCombination(
                tabId, 
                weekIdx, 
                combo.checkInIndex, 
                combo.checkOutIndex, 
                nights
            );
        }
        
        if (stayResult) {
            combinations.push(stayResult);
        }
        
        await new Promise(resolve => setTimeout(resolve, 200));
    }

    await clearSelectedDates(tabId);

    return combinations;
}

async function checkSameWeekCombination(tabId, weekIdx, checkInIndex, checkOutIndex, nights) {
    const result = await chrome.scripting.executeScript({
        target: { tabId },
        func: (weekIndex, checkInIdx, checkOutIdx, requiredNights) => {
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
                return (cell.getAttribute("role") === "button" && 
                       cell.getAttribute("aria-disabled") === "false") ? cell : null;
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
                if (!currentWeek) {
                    resolve(null);
                    return;
                }
                
                const currentDays = currentWeek.querySelectorAll('td');
                
                const checkInBtn = findEnabledButton(currentDays[checkInIdx]);
                if (!checkInBtn) {
                    resolve(null);
                    return;
                }

                checkInBtn.click();
                
                const checkOutBtn = findEnabledButton(currentDays[checkOutIdx]);
                if (!checkOutBtn) {
                    resolve(null);
                    return;
                }

                setTimeout(() => {
                    checkOutBtn.click();
                    
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
        args: [weekIdx, checkInIndex, checkOutIndex, nights]
    });

    if (result[0].result === 'need_clear') {
        await clearSelectedDates(tabId);
        return null;
    }

    return result[0].result;
}

async function checkCrossWeekCombination(tabId, checkInWeekIdx, checkInDayIdx, checkOutWeekIdx, checkOutDayIdx, nights) {
    const result = await chrome.scripting.executeScript({
        target: { tabId },
        func: (checkInWeek, checkInDay, checkOutWeek, checkOutDay, requiredNights) => {
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
                return (cell.getAttribute("role") === "button" && 
                       cell.getAttribute("aria-disabled") === "false") ? cell : null;
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

                const checkInWeekEl = allWeeks[checkInWeek];
                const checkOutWeekEl = allWeeks[checkOutWeek];
                
                if (!checkInWeekEl || !checkOutWeekEl) {
                    resolve(null);
                    return;
                }
                
                const checkInDays = checkInWeekEl.querySelectorAll('td');
                const checkOutDays = checkOutWeekEl.querySelectorAll('td');
                
                const checkInBtn = findEnabledButton(checkInDays[checkInDay]);
                if (!checkInBtn) {
                    resolve(null);
                    return;
                }

                checkInBtn.click();

                const checkOutBtn = findEnabledButton(checkOutDays[checkOutDay]);
                if (!checkOutBtn) {
                    resolve(null);
                    return;
                }
                
                setTimeout(() => {
                    checkOutBtn.click();
                    
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
        args: [checkInWeekIdx, checkInDayIdx, checkOutWeekIdx, checkOutDayIdx, nights]
    });

    if (result[0].result === 'need_clear') {
        await clearSelectedDates(tabId);
        return null;
    }

    return result[0].result;
}


// Handle cross-month combinations
async function checkCrossMonthNNight(tabId, currentMonth, nextMonth, nights) {
    const combinations = [];
    
    // Get all valid check-in days from the last week
    const lastWeekCheckIns = await chrome.scripting.executeScript({
        target: { tabId },
        func: (requiredNights) => {
            function hasInvalidMinimum(label, requiredNights) {
                const match = label.match(/(\d+)\s+night minimum/i);
                if (!match) return false;
                const minNights = parseInt(match[1], 10);
                return minNights > requiredNights;
            }

            function findEnabledButton(cell) {
                if (!cell) return null;
                return (cell.getAttribute("role") === "button" && 
                       cell.getAttribute("aria-disabled") === "false") ? cell : null;
            }

            const currentMonthContainer = document.querySelector('div._ytfarf[data-visible="true"]');
            const table = currentMonthContainer?.querySelector('table._cvkwaj');
            const allWeeks = table?.querySelectorAll('tbody tr');

            if (!currentMonthContainer || !table || !allWeeks?.length) {
                return [];
            }

            const lastWeek = allWeeks[allWeeks.length - 1];
            const days = lastWeek.querySelectorAll('td');


            // Count how many are actual cells
            let actualDayCount = 0;
            for (const cell of days) {
                if (cell.getAttribute('role') === 'button') {
                    actualDayCount++;
                } else {
                    break;
                }
            }

            const validCheckIns = [];
            for (let dayIdx = 0; dayIdx < days.length; dayIdx++) {
                const btn = findEnabledButton(days[dayIdx]);
                if (!btn) continue;
                
                const label = btn.getAttribute("aria-label") || "";
                const isValidCheckIn = label.includes("check-in") &&
                                      !hasInvalidMinimum(label, requiredNights);
                
                if (isValidCheckIn) {
                    const checkOutIndex = dayIdx + requiredNights;

                    const isCrossWeekCombo = checkOutIndex >= actualDayCount;

                    if (isCrossWeekCombo) {
                        validCheckIns.push({
                            checkInIndex: dayIdx,
                            requiredNights: requiredNights
                        });
                    }

                }
            }
            
            return validCheckIns;
        },
        args: [nights]
    });
    
    const validCombinations = lastWeekCheckIns[0].result;
    console.log('validCombinations:',validCombinations);

    if (!validCombinations || validCombinations.length === 0) {
        return combinations;
    }
    
    for (const comb of validCombinations) {
        
        const stayResult = await trySpecificCrossMonthCombination(
            tabId, 
            currentMonth, 
            nextMonth, 
            comb.checkInIndex, 
            comb.requiredNights
        );
        
        if (stayResult) {
            combinations.push(stayResult);
        }
        
        await new Promise(resolve => setTimeout(resolve, 300));
    }
    await clearSelectedDates(tabId);

    return combinations;
}

// Helper function for specific cross-month combinations
async function trySpecificCrossMonthCombination(tabId, currentMonth, nextMonth, checkInIndex, nights) {
    const checkInResult = await chrome.scripting.executeScript({
        target: { tabId },
        func: (requiredNights, checkInIndex) => {
            function findEnabledButton(cell) {
                if (!cell) return null;
                return (cell.getAttribute("role") === "button" && 
                       cell.getAttribute("aria-disabled") === "false") ? cell : null;
            }

            function classifyCell(cell) {
                if (!cell || !cell.hasAttribute("role")) return false;
                if (cell.getAttribute("role") == "button") return true;
            }

            const currentMonthContainer = document.querySelector('div._ytfarf[data-visible="true"]');
            const table = currentMonthContainer?.querySelector('table._cvkwaj');
            const allWeeks = table?.querySelectorAll('tbody tr');

            if (!allWeeks?.length) return null;

            const lastWeek = allWeeks[allWeeks.length - 1];
            const days = lastWeek.querySelectorAll('td');
            
            const checkInBtn = findEnabledButton(days[checkInIndex]);
            if (!checkInBtn) return null;
            
            checkInBtn.click();

            // Count valid "buttons" after the check-in
            let count = 0;
            for (let i = checkInIndex + 1; i < days.length; i++) {
                const classified = classifyCell(days[i]);

                if (classified) {
                    count++;
                } else {
                    break;
                }
            }
            count = requiredNights - count;

            return count;
        },
        args: [nights, checkInIndex]
    });
    
    let requiredNightsLeft = 0;
    if (!checkInResult[0].result) {
        return null;
    } else {
        requiredNightsLeft = checkInResult[0].result;
    }
    
    await navigateForwardToMonth(tabId, nextMonth);
    

    const checkOutResult = await chrome.scripting.executeScript({
        target: { tabId },
        func: (requiredNightsLeft) => { 
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
                return (cell.getAttribute("role") === "button" && 
                       cell.getAttribute("aria-disabled") === "false") ? cell : null;
            }

            function classifyCell(cell) {
                if (!cell || !cell.hasAttribute("role")) return false;
                if (cell.getAttribute("role") == "button") return true;
            }

            function waitForUIUpdate() {
                return new Promise((resolve) => {
                    let attempts = 0;
                    const maxAttempts = 20;
                    
                    const checkForData = () => {
                        const dateRange = extractDateRange();
                        const price = extractTotalPrice();
                        
                        if (dateRange && price) {
                            resolve({ dateRange, totalPrice: price });
                            return;
                        }
                        
                        attempts++;
                        if (attempts < maxAttempts) {
                            setTimeout(checkForData, 100);
                        } else {
                            resolve(null);
                        }
                    };
                    
                    checkForData();
                });
            }

            return new Promise(async (resolve) => {
                const currentMonthContainer = document.querySelector('div._ytfarf[data-visible="true"]');
                const table = currentMonthContainer?.querySelector('table._cvkwaj');
                const allWeeks = table?.querySelectorAll('tbody tr');
                
                if (!currentMonthContainer || !table || !allWeeks) {
                    resolve('need_clear');
                    return; 
                }

                const firstWeek = allWeeks[0];
                const secondWeek = allWeeks[1];
                
                const allDays = [
                    ...(firstWeek.querySelectorAll('td')),
                    ...(secondWeek.querySelectorAll('td'))
                ];

                let availableCount = 0;
                let checkOutBtn = null;

                for (const cell of allDays) {
                    const isClassified = classifyCell(cell);

                    if (!isClassified) continue;

                    // Only count cells after the first classified cell
                    availableCount++;

                    const btn = findEnabledButton(cell);

                    if (availableCount === requiredNightsLeft && btn) {
                        checkOutBtn = btn;
                        break;
                    }
                }

                if (!checkOutBtn) {
                    resolve('need_clear');
                    return;
                }
                
                checkOutBtn.click();
                
                const result = await waitForUIUpdate();
                if (result) {
                    resolve(result);
                } else {
                    resolve('need_clear');
                }
            });
        },
        args: [requiredNightsLeft]
    });
    
    // Navigate back to current month for next iteration
    await navigateBackwardToMonth(tabId, currentMonth);
    
    if (checkOutResult[0].result === 'need_clear') {
        await clearSelectedDates(tabId);
        return null;
    }
    
    return checkOutResult[0].result;
}