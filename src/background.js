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

async function processListingCalendar(tabId, message) {
    try {
        await navigateToFirstTargetMonth(tabId, message.months);
        
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


async function getCurrentMonth(tabId) {
    const [result] = await chrome.scripting.executeScript({
        target: { tabId },
        func: () => {
            const currentMonthContainer = document.querySelector('div._ytfarf[data-visible="true"]');
            if (!currentMonthContainer) {
                throw new Error('Calendar container not found');
            }
            
            const monthTitle = currentMonthContainer.querySelector('h3');
            if (!monthTitle) {
                throw new Error('Month title not found');
            }
            
            return monthTitle.textContent; // e.g., "October 2025"
        }
    });
    
    return result.result;
}

async function navigateForwardToMonth(tabId, targetMonth) {
    let currentMonth;
    let attempts = 0;
    const maxAttempts = 12; // Prevent infinite loops
    
    do {
        // Get current month before clicking
        currentMonth = await getCurrentMonth(tabId);
        const currentMonthName = currentMonth.split(' ')[0].toLowerCase();

        if (currentMonthName === targetMonth) {
            return currentMonthName;
        }

        // Click next month button
        const clickResult = await chrome.scripting.executeScript({
            target: { tabId },
            func: () => {
                const nextButton = document.querySelector('button[aria-label="Move forward to switch to the next month."]');
                if (nextButton && !nextButton.disabled) {
                    nextButton.click();
                    console.log("Clicked to go to the next month.");
                    return true;
                } else {
                    console.warn("Next month button not found or is disabled.");
                    return false;
                }
            }
        });
        
        // If button click failed, throw error
        if (!clickResult[0].result) {
            throw new Error('Could not click next month button');
        }

        // Wait for calendar to update
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        attempts++;
        
    } while (attempts < maxAttempts);
    
    throw new Error(`Could not navigate to target month: ${targetMonth}`);
}

async function navigateBackwardToMonth(tabId, targetMonth) {
    let currentMonth;
    let attempts = 0;
    const maxAttempts = 12; // Prevent infinite loops
    
    do {
        // Get current month before clicking
        currentMonth = await getCurrentMonth(tabId);
        const currentMonthName = currentMonth.split(' ')[0].toLowerCase();

        if (currentMonthName === targetMonth) {
            return currentMonthName;
        }
        
        // Click previous month button
        const clickResult = await chrome.scripting.executeScript({
            target: { tabId },
            func: () => {
                const prevButton = document.querySelector('button[aria-label="Move backward to switch to the previous month."]');
                if (prevButton && !prevButton.disabled) {
                    prevButton.click();
                    console.log("Clicked to go to the previous month.");
                    return true;
                } else {
                    console.warn("Previous month button not found or is disabled.");
                    return false;
                }
            }
        });

        // If button click failed, throw error
        if (!clickResult[0].result) {
            throw new Error('Could not click previous month button');
        }

        // Wait for calendar to update
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        attempts++;
        
    } while (attempts < maxAttempts);
    
    throw new Error(`Could not navigate to target month: ${targetMonth}`);
}

function getMonthIndex(monthName) {
    const months = [
        'january', 'february', 'march', 'april', 'may', 'june',
        'july', 'august', 'september', 'october', 'november', 'december'
    ];
    const index = months.indexOf(monthName);

    if (index === -1) {
        throw new Error(`Invalid month name: ${monthName}`);
    }
    return index;
}
