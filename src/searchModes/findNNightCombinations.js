import { clearSelectedDates, navigateForwardToMonth, getMonthIndex } from '../helpers/calendarHelpers.js';

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
        
        // Check regular week (within same month)
        const regularWeek = await checkRegularWeek(tabId, weekIdx, nights);

        if (regularWeek && regularWeek.length > 0) {
            combinations.push(...regularWeek);
        }
/*
        // Check cross-month N-night stays (only for last week if next month is consecutive)
        if (weekIdx === weekCount - 1 && canCheckNextMonth) {
            console.log(`Checking cross-month ${nights}-night stay from ${currentMonth} to ${nextMonth}`);
            const crossMonthStays = await checkCrossMonthNNight(tabId, currentMonth, nextMonth, nights);
            if (crossMonthStays && crossMonthStays.length > 0) {
                combinations.push(...crossMonthStays);
            }
        }*/
    }
    
    return combinations;
}

// Only checks within same week not cross-over week even within same month
async function checkRegularWeek(tabId, weekIdx, nights) {
    const combinations = [];
    
    // Get all possible starting positions for this week
    const possibleStarts = await chrome.scripting.executeScript({
        target: { tabId },
        func: (weekIndex, requiredNights) => {
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
            
            if (!currentMonthContainer || !table || weekIndex >= allWeeks.length - 1) {
                return []; // Last week of current month, so might need next week of next month
            }

            const currentWeek = allWeeks[weekIndex];
            if (!currentWeek) {
                return [];
            }
            
            const currentDays = currentWeek.querySelectorAll('td');
            
            // Get all day buttons for the week
            const dayButtons = [];
            for (let i = 0; i < 7; i++) {
                dayButtons.push(findEnabledButton(currentDays[i]));
            }

            // Find ALL valid check-in/check-out combinations in this week
            const validCombinations = [];
            
            for (let dayIdx = 0; dayIdx <= 7 - requiredNights; dayIdx++) {
                const checkInBtn = dayButtons[dayIdx];
                if (!checkInBtn) continue;
                
                // Check check-in conditions
                const label = checkInBtn.getAttribute("aria-label") || "";
                const isValidCheckIn = label.includes("check-in") &&
                                      !hasInvalidMinimum(label, requiredNights);
                
                if (isValidCheckIn) {
                    // Check if we can find checkout day (current + nights)
                    const checkOutIndex = dayIdx + requiredNights;
                    
                    if (checkOutIndex < dayButtons.length && dayButtons[checkOutIndex]) {
                        validCombinations.push({
                            checkInIndex: dayIdx,
                            checkOutIndex: checkOutIndex
                        });
                    }
                }
            }

            return validCombinations;
        },
        args: [weekIdx, nights]
    });

    const validCombinations = possibleStarts[0].result;
    
    if (!validCombinations || validCombinations.length === 0) {
        console.log(`No valid ${nights}-night combinations found in week ${weekIdx + 1}`);
        return combinations;
    }

    console.log(`Found ${validCombinations.length} potential ${nights}-night combinations in week ${weekIdx + 1}`);

    // Try each valid combination
    for (const combo of validCombinations) {
        const stayResult = await clickCombination(tabId, weekIdx, combo.checkInIndex, combo.checkOutIndex, nights);
        if (stayResult) {
            combinations.push(stayResult);
        }
        
        // Small delay between checks to avoid overwhelming the UI
        await new Promise(resolve => setTimeout(resolve, 200));
    }

    return combinations;
}


async function clickCombination(tabId, weekIdx, checkInIndex, checkOutIndex, nights) {
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
                        console.warn(`Timeout waiting for ${requiredNights}-night price/date data`);
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
                const checkOutBtn = findEnabledButton(currentDays[checkOutIdx]);

                if (!checkInBtn || !checkOutBtn) {
                    console.log(`Invalid buttons for combination: checkIn=${checkInIdx}, checkOut=${checkOutIdx}`);
                    resolve(null);
                    return;
                }


                // Click check-in day
                checkInBtn.click();
                
                setTimeout(() => {
                    // Click check-out day
                    checkOutBtn.click();
                    
                    // Wait for UI to update with pricing information
                    waitForUIUpdate((result) => {
                        if (result) {
                            console.log(`SUCCESS: Found ${requiredNights}-night stay:`, result.dateRange, result.totalPrice);
                            resolve(result);
                        } else {
                            console.log("No price/date data found after selection");
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

// doesnt work (in the works)
async function checkCrossMonthNNight(tabId, currentMonth, nextMonth, nights) {
    // Click first available day from current month's last week
    const Result = await chrome.scripting.executeScript({
        target: { tabId },
        func: (requiredNights) => {
            function hasInvalidMinimum(label, requiredNights) {
                const match = label.match(/(\d+)\s+night minimum/i);
                if (!match) return false;
                const minNights = parseInt(match[1], 10);
                return minNights > requiredNights;
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
                        console.warn("Timeout waiting for price/date data");
                        callback(null);
                    }
                };
                
                checkForData();
            }
            function clickMonth(direction = 'forward') {
                const selector = direction === 'forward'
                    ? 'button[aria-label="Move forward to switch to the next month."]'
                    : 'button[aria-label="Move backward to switch to the previous month."]';

                const btn = document.querySelector(selector);
                if (btn && !btn.disabled) {
                    btn.click();
                    return true;
                }
                return false;      
            }
            function clearDates() {
                const buttons = document.querySelectorAll('button[type="button"]');
                
                // Find the button with "Clear dates" text
                for (const button of buttons) {
                    if (button.textContent.trim() === "Clear dates") {
                        button.click();
                        console.log("Clicked Clear dates button");
                        return true;
                    }
                }
            }

            return new Promise((resolve) => {
                // Current month and last week
                const currentMonthContainer = document.querySelector('div._ytfarf[data-visible="true"]');
                const table = currentMonthContainer?.querySelector('table._cvkwaj');
                const allWeeks = table?.querySelectorAll('tbody tr');
                
                if (!currentMonthContainer || !table || !allWeeks) {
                    resolve(null);
                    return; 
                }

                const lastWeek = allWeeks[allWeeks.length - 1];
                const days = lastWeek.querySelectorAll('td');

                // Get all day buttons for the week
                const dayButtons = [];
                for (let i = 0; i < 7; i++) {
                    dayButtons.push(findEnabledButton(days[i]));
                }

                // Find ALL valid check-in/check-out combinations in this week
                const validCombinations = [];
                
                for (let dayIdx = 0; dayIdx <= 7 - requiredNights; dayIdx++) {
                    const checkInBtn = dayButtons[dayIdx];
                    if (!checkInBtn) continue;
                    
                    // Check check-in conditions
                    const label = checkInBtn.getAttribute("aria-label") || "";
                    const isValidCheckIn = label.includes("check-in") &&
                                        !hasInvalidMinimum(label, requiredNights);
                    
                    if (isValidCheckIn) {
                        // Check if we can find checkout day (current + nights)
                        const checkOutIndex = dayIdx + requiredNights;
                        
                        if (checkOutIndex < dayButtons.length && dayButtons[checkOutIndex]) {
                            const checkInBtn = findEnabledButton(checkInBtn);
                            const checkOutBtn = findEnabledButton(currentDays[checkOutIndex]);

                            if (!checkInBtn || !checkOutBtn) {
                                continue;
                            }

                            checkInBtn.click();

                            setTimeout(() => {
                                checkOutBtn.click();
                                
                                // Wait for UI to update with pricing information
                                waitForUIUpdate((result) => {
                                    if (result) {
                                        console.log("Found regular weekend:", result.dateRange, result.totalPrice);
                                    
                                        validCombinations.push(result);

                                        //resolve(result);
                                    } else {
                                        console.log("No price/date data found after selection");
                                        resolve('need_clear');
                                    }
                                });
                            }, 300);

                        } else if (checkOutIndex >= dayButtons.length) {
                            checkOutIndex = checkOutIndex % 7;
                            
                            // Click check-in
                            const checkInBtn = findEnabledButton(checkInBtn);
                            if (!checkInBtn || !checkOutBtn) {
                                continue;
                            }
                            checkInBtn.click();

                            // Check next month
                            clickMonth('forward');


                            const nextMonthContainer = document.querySelector('div._ytfarf[data-visible="true"]');
                            const table = nextMonthContainer?.querySelector('table._cvkwaj');
                            const allWeeks = table?.querySelectorAll('tbody tr');
                            
                            if (!nextMonthContainer || !table || !allWeeks) {
                    resolve('need_clear');
                    return;
                }
                
                            // Look through first few weeks to find checkout day
                            // For cross-month, checkout day depends on how many days were in previous month
                            const firstWeek = allWeeks[0];
                            const secondWeek = allWeeks[1]; // might need this for longer stays
                            
                            const firstWeekDays = firstWeek.querySelectorAll('td');
                            const secondWeekDays = secondWeek?.querySelectorAll('td') || [];
                            
                            // Combine days from first and potentially second week
                            const allDays = [...firstWeekDays, ...secondWeekDays];

                            const checkOutBtn = findEnabledButton(allDays[checkOutIndex]);

                            if (!checkOutBtn) {
                                console.log("Missing one of the week buttons");
                                // clear
                                resolve(null);
                                return;
                            }

                            setTimeout(() => {
                                checkOutBtn.click();
                                
                                // Wait for UI to update with pricing information
                waitForUIUpdate((result) => {
                    if (result) {
                                        console.log("Found regular weekend:", result.dateRange, result.totalPrice);
                                    
                                        validCombinations.push(result);

                                        //resolve(result);
                    } else {
                                        console.log("No price/date data found after selection");
                        resolve('need_clear');
                    }
                });
                            }, 300);


                            clickMonth('backwards');
        }
                    }
                }

                return validCombinations;
            });
        },
        args: [nights]
    });
    
    
    if (Result[0].result === 'need_clear') {
        await clearSelectedDates(tabId);
        return null;
    }
    
    return Result[0].result;
}
