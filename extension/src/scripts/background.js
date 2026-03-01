import { clearSelectedDates, getCurrentMonth, navigateForwardToMonth, navigateBackwardToMonth, getMonthIndex } from './helpers/calendarHelpers.js';
import { findWeekendCombinations, findWeekCombinations, findNNightCombinations } from '../searchModes/index.js';

const API_BASE_URL = 'http://localhost:3000/api';

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "POST_PRICE_TO_API") {
        (async () => {
            try {
                if (!API_BASE_URL || !message.payload) {
                    sendResponse({ ok: false });
                    return;
                }
                const res = await fetch(`${API_BASE_URL}/listings/price`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(message.payload),
                });
                sendResponse({ ok: res.ok });
            } catch (err) {
                console.error('Background: failed to POST price to API', err);
                sendResponse({ ok: false });
            }
        })();
        return true;
    }
    
    if (message.type === "OPEN_LISTING_TAB") {
        (async () => {
            let tab;
            let originalTab;
            
            try {
                tab = await new Promise((resolve, reject) => {
                    chrome.tabs.create({
                        url: message.link,
                        active: false
                    }, tab => {
                        if (chrome.runtime.lastError) {
                            reject(chrome.runtime.lastError);
                        } else {
                            resolve(tab);
                        }
                    });
                });

                console.log(`Tab ${tab.id} opened for ${message.link}`);

                const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });
                originalTab = currentTab;

                await chrome.tabs.update(tab.id, { active: true });
                // Wait for page to load before processing
                await new Promise(resolve => setTimeout(resolve, 3500));

                const results = await processListingCalendar(tab.id, message);

                // Return to original tab after processing
                if (originalTab && originalTab.id) {
                    await chrome.tabs.update(originalTab.id, { active: true });
                }

                await chrome.tabs.remove(tab.id);

                if (results && results.hasError) {
                    sendResponse({ success: false, error: results.errorMessage });
                } else {
                    sendResponse({ success: true, results: results });
                }
                
            } catch (error) {
                console.error("Failed to open tab:", error);

                if (tab && tab.id) {
                    try {
                        await chrome.tabs.remove(tab.id);
                    } catch (closeError) {
                        console.error("Failed to close tab:", closeError);
                    }
                }

                if (originalTab && originalTab.id) {
                    try {
                        await chrome.tabs.update(originalTab.id, { active: true });
                    } catch (focusError) {
                        console.warn("Could not return to original tab during cleanup:", focusError);
                    }
                }

                sendResponse({ success: false, error: error.message });
            }
        })();

        return true;
    }
});

async function ensureTabActive(tabId) {
    try {
        await chrome.tabs.update(tabId, { active: true });
        await new Promise(resolve => setTimeout(resolve, 300));
    } catch (error) {
        console.warn("Could not activate tab:", error);
    }
}

function removeYearFromDateRange(dateRange) {
    if (!dateRange) return dateRange;
    
    return dateRange.replace(/,\s*\d{4}/g, '');
}

function parsePrice(priceString) {
    return parseFloat(priceString.replace(/[$,]/g, ''));
}

function findCheapestCombination(combinations) {
    if (!combinations || combinations.length === 0) {
        return { bestDates: null, bestPrice: null, hasError: false };
    }

    const sortedCombinations = combinations.sort((a, b) => {
        const priceA = parsePrice(a.totalPrice);
        const priceB = parsePrice(b.totalPrice);
        return priceA - priceB;
    });

    return {
        bestDates: removeYearFromDateRange(sortedCombinations[0].dateRange),
        bestPrice: sortedCombinations[0].totalPrice,
        hasError: false
    };
}

async function processListingCalendar(tabId, message) {
    try {
        await ensureTabActive(tabId);
        await clearSelectedDates(tabId);
        await navigateToFirstTargetMonth(tabId, message.months);
        
        if (message.mode === "respect") {
            if (message.tripLength.includes("weekend_trip")) {
                const weekendResults = await findWeekendCombinations(tabId, message.months);
                return findCheapestCombination(weekendResults);
            }
            else if (message.tripLength.includes("one_week")) {
                const weekResults = await findWeekCombinations(tabId, message.months);
                return findCheapestCombination(weekResults); 
            }
        }

        if (message.mode === "ignore") {
            // Find N-night sequences of consecutive available days
            const flexibleResults = await findNNightCombinations(tabId, message.months, message.nights);
            return findCheapestCombination(flexibleResults);
        }

        return { bestDates: null, bestPrice: null, hasError: false };

    } catch (error) {
        console.error('Error processing calendar:', error);
        
        return {
            bestDates: null,
            bestPrice: null,
            hasError: true,
            errorMessage: error.message
        };
    }
}

async function navigateToFirstTargetMonth(tabId, targetMonths) {
    await ensureTabActive(tabId);

    const currentCalendarMonth = await getCurrentMonth(tabId);  
    const currentCalendarMonthName = currentCalendarMonth.split(' ')[0].toLowerCase();
    const currentCalendarYear = parseInt(currentCalendarMonth.split(' ')[1]);
    
    const firstTargetMonth = targetMonths[0];

    // Return if the calendar is already in the first target month
    if (firstTargetMonth === currentCalendarMonthName) {
        return currentCalendarMonthName;
    }
    
    const currentCalendarMonthIndex = getMonthIndex(currentCalendarMonthName); 
    const targetMonthIndex = getMonthIndex(firstTargetMonth); 
    
    const currentDate = new Date();
    const currentRealYear = currentDate.getFullYear();
    const currentRealMonthIndex = currentDate.getMonth();
    
    // If target month is before current real month, it's likely next year
    let targetYear = currentRealYear;
    if (targetMonthIndex < currentRealMonthIndex) {
        targetYear = currentRealYear + 1;
    }

    // Calculate navigation direction based on chronological comparison
    const currentCalendarDate = new Date(currentCalendarYear, currentCalendarMonthIndex, 1);
    const targetDate = new Date(targetYear, targetMonthIndex, 1);

    let navigatedMonth;
    
    if (targetDate > currentCalendarDate) {
        navigatedMonth = await navigateForwardToMonth(tabId, firstTargetMonth);
    } else {
        navigatedMonth = await navigateBackwardToMonth(tabId, firstTargetMonth);
    }
    
    return navigatedMonth;
}