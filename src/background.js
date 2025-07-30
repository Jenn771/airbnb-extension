import { clearSelectedDates, getCurrentMonth, navigateForwardToMonth, navigateBackwardToMonth, getMonthIndex } from './helpers/calendarHelpers.js';
import { findWeekendCombinations } from './searchModes/index.js';

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "OPEN_LISTING_TAB") {
        (async () => {
            try {
                const tab = await new Promise((resolve, reject) => {
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

                await new Promise(resolve => setTimeout(resolve, 5000));

                const results = await processListingCalendar(tab.id, message);

                await chrome.tabs.remove(tab.id);

                sendResponse({ success: true, results: results });
            } catch (error) {
                console.error("Failed to open tab:", error);
                sendResponse({ success: false, error: error.message });
            }
        })();

        // allows sendResponse to be called asynchronously
        return true;
    }
});

function parsePrice(priceString) {
    return parseFloat(priceString.replace(/[$,]/g, ''));
}

// Helper function to find cheapest combination
function findCheapestCombination(combinations) {
    if (!combinations || combinations.length === 0) {
        return { bestDates: null, bestPrice: null };
    }

    // Sort by price
    const sortedCombinations = combinations.sort((a, b) => {
        const priceA = parsePrice(a.totalPrice);
        const priceB = parsePrice(b.totalPrice);
        return priceA - priceB;
    });

    return {
        bestDates: sortedCombinations[0].dateRange,
        bestPrice: sortedCombinations[0].totalPrice
    };
}

async function processListingCalendar(tabId, message) {
    try {
        await clearSelectedDates(tabId);

        await navigateToFirstTargetMonth(tabId, message.months);
        
        // Check flexibility constraints
        if (message.mode === "respect") {
            if (message.tripLength.includes("weekend_trip")) {
                const weekendResults = await findWeekendCombinations(tabId, message.months);
                return findCheapestCombination(weekendResults);
            }
            else if (message.tripLength.includes("one_week")) {
                /* 
                const weekResults = await findWeekCombinations(tabId, message.months);
                return findCheapestCombination(weekResults); 
                */
            }
        }

        if (message.mode === "ignore") {
            // Find N-night sequences of consecutive available days
            /* 
            const flexibleResults = await findNNightCombinations(tabId, message.months, message.nights);
            return findCheapestCombination(flexibleResults);
             */
        }


        return {
            bestDates: null,
            bestPrice: null
        }
    } catch (error) {
        console.error('Error processing calendar:', error);
        return {
            bestDates: null,
            bestPrice: null
        }
    }
}

async function navigateToFirstTargetMonth(tabId, targetMonths) {
    // Get current month on calendar
    const currentCalendarMonth = await getCurrentMonth(tabId);  
    const currentCalendarMonthName = currentCalendarMonth.split(' ')[0].toLowerCase(); // e.g., extract month from "October 2025" 
    const currentCalendarYear = parseInt(currentCalendarMonth.split(' ')[1]); // e.g., extract year from "October 2025"
    console.log(`Current month on calendar: ${currentCalendarMonthName} ${currentCalendarYear}`);
    
    const firstTargetMonth = targetMonths[0];

    // Return if the calendar is already in the first target month
    if (firstTargetMonth === currentCalendarMonthName) {
        console.log(`Already at target month: ${currentCalendarMonthName}`);
        return currentCalendarMonthName;
    }
    
    // Get month indicies
    const currentCalendarMonthIndex = getMonthIndex(currentCalendarMonthName); 
    const targetMonthIndex = getMonthIndex(firstTargetMonth); 
    

    // Get current real world date for year calculation
    const currentDate = new Date();
    const currentRealYear = currentDate.getFullYear();
    const currentRealMonthIndex = currentDate.getMonth();
    

    // If target month is before current real month, it's likely next year
    let targetYear = currentRealYear;

    if (targetMonthIndex < currentRealMonthIndex) {
        targetYear = currentRealYear + 1;
    }

    // Calculate if we need to navigate forward or backward
    const currentCalendarDate = new Date(currentCalendarYear, currentCalendarMonthIndex, 1);
    const targetDate = new Date(targetYear, targetMonthIndex, 1);


    let navigatedMonth;
    
    if (targetDate > currentCalendarDate) {
        // Navigate forward
        navigatedMonth = await navigateForwardToMonth(tabId, firstTargetMonth);
    } else {
        // Navigate backward  
        navigatedMonth = await navigateBackwardToMonth(tabId, firstTargetMonth);
    }
    
    console.log(`Successfully navigated to: ${navigatedMonth}`);
    return navigatedMonth;
}
