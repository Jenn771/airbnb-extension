import { clearSelectedDates, navigateForwardToMonth, navigateBackwardToMonth, getMonthIndex } from '../scripts/helpers/calendarHelpers.js';

export async function findNNightCombinations(tabId, months, nights) {
    const combinations = [];
    
    for (let monthIdx = 0; monthIdx < months.length; monthIdx++) {
        const currentMonth = months[monthIdx];
        
        if (monthIdx > 0) {
            await navigateForwardToMonth(tabId, currentMonth);
        }
        
        // Check if next month is consecutive, needed for cross-month validation
        const nextMonth = months[monthIdx + 1];
        const isNextMonthConsecutive = nextMonth && 
            getMonthIndex(nextMonth) === (getMonthIndex(currentMonth) + 1) % 12;
        
        const monthCombinations = await processMonthNNights(
            tabId, 
            currentMonth, 
            nextMonth, 
            Boolean(isNextMonthConsecutive),
            nights
        );
        
        combinations.push(...monthCombinations);
    }
    console.log(`Final ${nights}-night combinations:`, combinations);
    return combinations;
}

async function processMonthNNights(tabId, currentMonth, nextMonth, canCheckNextMonth, nights) {
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
        const regularWeek = await checkRegularWeek(tabId, weekIdx, nights, weekCount, canCheckNextMonth);

        if (regularWeek && regularWeek.length > 0) {
            combinations.push(...regularWeek);
        }
    }

    // Check cross-month combinations only for consecutive months
    if (canCheckNextMonth) {
        const crossMonthStays = await checkCrossMonthNNight(tabId, currentMonth, nextMonth, nights);
        if (crossMonthStays && crossMonthStays.length > 0) {
            combinations.push(...crossMonthStays);
        }
    }

    return combinations;
}

async function checkRegularWeek(tabId, weekIdx, nights, totalWeeks, canCheckNextMonth) {
    const combinations = [];
    
    const possibleStarts = await chrome.scripting.executeScript({
        target: { tabId },
        func: (weekIndex, requiredNights, totalWeekCount, canCheckNextMonth) => {
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
            
            const currentWeekButtons = [];
            for (let i = 0; i < 7; i++) {
                currentWeekButtons.push(findEnabledButton(currentDays[i]));
            }

            // Get next week buttons for cross-week combinations within same month
            const nextWeek = allWeeks[weekIndex + 1];
            const nextWeekButtons = [];
            if (nextWeek) {
                const nextWeekDays = nextWeek.querySelectorAll('td');
                for (let i = 0; i < 7; i++) {
                    nextWeekButtons.push(findEnabledButton(nextWeekDays[i]));
                }
            }

            const allButtons = [...currentWeekButtons, ...nextWeekButtons];

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
                        
                        // Skip cross-week combinations for the last two weeks to avoid conflicts
                        if (isCrossWeekCombo && 
                            (weekIndex === totalWeekCount - 1 || 
                            (weekIndex === totalWeekCount - 2 && canCheckNextMonth))) {
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
        args: [weekIdx, nights, totalWeeks, canCheckNextMonth]
    });

    const validCombinations = possibleStarts[0].result;
    
    if (!validCombinations || validCombinations.length === 0) {
        return combinations;
    }

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
                // iterate spans inside the price button
                const priceButton = document.querySelector('button[aria-haspopup="dialog"]');
                if (priceButton) {
                    const spans = priceButton.querySelectorAll('span');
                    for (const span of spans) {
                        const text = span.textContent.trim();
                        if (text.startsWith('$') && /\$[\d,]+/.test(text)) {
                            return text;
                        }
                    }
                }

                // button aria-label contains the total
                const labelButton = document.querySelector('button[aria-label*="for"][aria-label*="night"]');
                if (labelButton) {
                    const match = labelButton.getAttribute('aria-label').match(/\$[\d,]+/);
                    if (match) return match[0];
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

                // Small delay for UI state transition before selecting check-out
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
                // iterate spans inside the price button
                const priceButton = document.querySelector('button[aria-haspopup="dialog"]');
                if (priceButton) {
                    const spans = priceButton.querySelectorAll('span');
                    for (const span of spans) {
                        const text = span.textContent.trim();
                        if (text.startsWith('$') && /\$[\d,]+/.test(text)) {
                            return text;
                        }
                    }
                }

                // button aria-label contains the total
                const labelButton = document.querySelector('button[aria-label*="for"][aria-label*="night"]');
                if (labelButton) {
                    const match = labelButton.getAttribute('aria-label').match(/\$[\d,]+/);
                    if (match) return match[0];
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

async function checkCrossMonthNNight(tabId, currentMonth, nextMonth, nights) {
    const combinations = [];
    
    // Find valid check-in days from last two weeks that require cross-month checkout
    const lastWeeksCheckIns = await chrome.scripting.executeScript({
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

            function classifyCell(cell) {
                if (!cell || !cell.hasAttribute("role")) return false;
                if (cell.getAttribute("role") == "button") return true;
            }

            const currentMonthContainer = document.querySelector('div._ytfarf[data-visible="true"]');
            const table = currentMonthContainer?.querySelector('table._cvkwaj');
            const allWeeks = table?.querySelectorAll('tbody tr');

            if (!currentMonthContainer || !table || !allWeeks?.length) {
                return [];
            }

            const lastWeek = allWeeks[allWeeks.length - 1];
            const secondLastWeek = allWeeks.length >= 2 ? allWeeks[allWeeks.length - 2] : null;
            
            const weeksToCheck = [];
            if (secondLastWeek) weeksToCheck.push({ week: secondLastWeek, weekIndex: allWeeks.length - 2 });
            if (lastWeek) weeksToCheck.push({ week: lastWeek, weekIndex: allWeeks.length - 1 });

            const validCheckIns = [];

            for (const { week, weekIndex } of weeksToCheck) {
                const days = week.querySelectorAll('td');

                for (let dayIdx = 0; dayIdx < days.length; dayIdx++) {
                    const btn = findEnabledButton(days[dayIdx]);
                    if (!btn) continue;
                    
                    const label = btn.getAttribute("aria-label") || "";
                    const isValidCheckIn = label.includes("check-in") &&
                                          !hasInvalidMinimum(label, requiredNights);
                    
                    if (isValidCheckIn) {
                        let totalRemainingDays = 0;
                        
                        // Count remaining days in current week
                        for (let i = dayIdx + 1; i < days.length; i++) {
                            if (classifyCell(days[i])) {
                                totalRemainingDays++;
                            } else {
                                break;
                            }
                        }
                        
                        let remainingInCurrentWeek = totalRemainingDays;

                        // Count days in all subsequent weeks in current month
                        for (let wIdx = weekIndex + 1; wIdx < allWeeks.length; wIdx++) {
                            const futureWeek = allWeeks[wIdx];
                            const futureWeekDays = futureWeek.querySelectorAll('td');
                            
                            for (const cell of futureWeekDays) {
                                if (classifyCell(cell)) {
                                    totalRemainingDays++;
                                } else {
                                    break;
                                }
                            }
                        }

                        // Only include if checkout would be outside the current week
                        if (requiredNights > remainingInCurrentWeek) {
                            const needsNextMonth = requiredNights > totalRemainingDays;
                            const requiredNightsFromNextWeek = needsNextMonth? requiredNights - totalRemainingDays : requiredNights - remainingInCurrentWeek;
                            
                            validCheckIns.push({
                                checkInIndex: dayIdx,
                                requiredNights: requiredNights,
                                weekIndex: weekIndex,
                                needsNextMonth: needsNextMonth,
                                requiredNightsFromNextWeek: requiredNightsFromNextWeek
                            });
                        }
                    }
                }
            }
            
            return validCheckIns;
        },
        args: [nights]
    });
    
    const validCombinations = lastWeeksCheckIns[0].result;

    if (!validCombinations || validCombinations.length === 0) {
        return combinations;
    }
    
    for (const comb of validCombinations) {
        const stayResult = await trySpecificCrossMonthCombination(
            tabId, 
            currentMonth, 
            nextMonth, 
            comb
        );
        
        if (stayResult) {
            combinations.push(stayResult);
        }
        
        await new Promise(resolve => setTimeout(resolve, 300));
    }
    await clearSelectedDates(tabId);

    return combinations;
}

async function trySpecificCrossMonthCombination(tabId, currentMonth, nextMonth, combData) {
    const checkInResult = await chrome.scripting.executeScript({
        target: { tabId },
        func: (checkInIndex, weekIdx) => {
            function findEnabledButton(cell) {
                if (!cell) return null;
                return (cell.getAttribute("role") === "button" && 
                       cell.getAttribute("aria-disabled") === "false") ? cell : null;
            }

            const currentMonthContainer = document.querySelector('div._ytfarf[data-visible="true"]');
            const table = currentMonthContainer?.querySelector('table._cvkwaj');
            const allWeeks = table?.querySelectorAll('tbody tr');

            if (!allWeeks?.length) return false;

            const targetWeek = allWeeks[weekIdx];
            const days = targetWeek.querySelectorAll('td');
            
            const checkInBtn = findEnabledButton(days[checkInIndex]);
            if (!checkInBtn) return false;
            
            checkInBtn.click();
            return true;
        },
        args: [combData.checkInIndex, combData.weekIndex]
    });
    
    if (!checkInResult[0].result) return null;
    
    // Handle checkout within current month
    if (!combData.needsNextMonth) {
        const checkOutResult = await chrome.scripting.executeScript({
            target: { tabId },
            func: (weekIdx, requiredNightsFromNextWeek) => {
                function extractDateRange() {
                    const dateRangeElement = document.querySelector('[data-testid="availability-calendar-date-range"]');
                    return dateRangeElement ? dateRangeElement.textContent.trim() : null;
                }

                function extractTotalPrice() {
                // iterate spans inside the price button
                const priceButton = document.querySelector('button[aria-haspopup="dialog"]');
                if (priceButton) {
                    const spans = priceButton.querySelectorAll('span');
                    for (const span of spans) {
                        const text = span.textContent.trim();
                        if (text.startsWith('$') && /\$[\d,]+/.test(text)) {
                            return text;
                        }
                    }
                }

                // button aria-label contains the total
                const labelButton = document.querySelector('button[aria-label*="for"][aria-label*="night"]');
                if (labelButton) {
                    const match = labelButton.getAttribute('aria-label').match(/\$[\d,]+/);
                    if (match) return match[0];
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
                    
                    if (!currentMonthContainer || !table) {
                        resolve('need_clear');
                        return; 
                    }

                    const nextWeek = allWeeks[weekIdx + 1];
                    if (!nextWeek) {
                        resolve('need_clear');
                        return;
                    }

                    const days = nextWeek.querySelectorAll('td');

                    const checkOutBtn = findEnabledButton(days[requiredNightsFromNextWeek - 1]);
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
            args: [combData.weekIndex, combData.requiredNightsFromNextWeek]
        });
        
        if (checkOutResult[0].result === 'need_clear') {
            await clearSelectedDates(tabId);
            return null;
        }
        
        return checkOutResult[0].result;
    }
    
    // Handle checkout in next month
    await navigateForwardToMonth(tabId, nextMonth);
    
    const checkOutResult = await chrome.scripting.executeScript({
        target: { tabId },
        func: (requiredNightsLeft) => { 
            function extractDateRange() {
                const dateRangeElement = document.querySelector('[data-testid="availability-calendar-date-range"]');
                return dateRangeElement ? dateRangeElement.textContent.trim() : null;
            }

            function extractTotalPrice() {
                // iterate spans inside the price button
                const priceButton = document.querySelector('button[aria-haspopup="dialog"]');
                if (priceButton) {
                    const spans = priceButton.querySelectorAll('span');
                    for (const span of spans) {
                        const text = span.textContent.trim();
                        if (text.startsWith('$') && /\$[\d,]+/.test(text)) {
                            return text;
                        }
                    }
                }

                // button aria-label contains the total
                const labelButton = document.querySelector('button[aria-label*="for"][aria-label*="night"]');
                if (labelButton) {
                    const match = labelButton.getAttribute('aria-label').match(/\$[\d,]+/);
                    if (match) return match[0];
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

                // Find the Nth available day for checkout
                for (const cell of allDays) {
                    const isClassified = classifyCell(cell);

                    if (!isClassified) continue;

                    availableCount++;

                    if (availableCount === requiredNightsLeft) {
                        const btn = findEnabledButton(cell);
                        if (btn) {
                            checkOutBtn = btn;
                            break;
                        }
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
        args: [combData.requiredNightsFromNextWeek]
    });
    
    // Navigate back for next iteration
    await navigateBackwardToMonth(tabId, currentMonth);
    
    if (checkOutResult[0].result === 'need_clear') {
        await clearSelectedDates(tabId);
        return null;
    }
    
    return checkOutResult[0].result;
}