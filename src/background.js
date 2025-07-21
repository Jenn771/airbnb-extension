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

async function processListingCalendar(tabID, message) {
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
    console.log(`Current month on calendar: ${currentCalendarMonthName}`);
    
    const firstTargetMonth = targetMonths[0];

    // Return if the calendar is already in the first target month
    if (firstTargetMonth === currentCalendarMonthName) {
        return currentCalendarMonthName;
    }
    
    console.log(`Need to navigate to: ${firstTargetMonth}`);
    
    // Determine if we need to go forward or backward
    const currentCalendarMonthIndex = getMonthIndex(currentCalendarMonthName); 
    const targetMonthIndex = getMonthIndex(firstTargetMonth); 
    

    const currentDate = new Date();
    const currentMonthIndex = currentDate.getMonth();

    // march 2026 (3) < may 2025(5)
    if (targetMonthIndex < currentMonthIndex) {
        await navigateForwardToMonth(tabId, firstTargetMonth);
    }


    let navigatedMonth;
    
    if (targetMonthIndex >= currentCalendarMonthIndex) {
        // Navigate forward
        navigatedMonth = await navigateForwardToMonth(tabId, firstTargetMonth);
    } else {
        // Navigate backward  
        navigatedMonth = await navigateBackwardToMonth(tabId, firstTargetMonth);
    }
    
    console.log(`Successfully navigated to: ${navigatedMonth}`);
    return navigatedMonth;
}

// target = june 2026
// currentCalendar = september
// currentMonth = july

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
        // Click next month button
        await chrome.scripting.executeScript({
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
        
        // Wait for calendar to update
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Get the new current month
        currentMonth = await getCurrentMonth(tabId);
        const currentMonthName = currentMonth.split(' ')[0].toLowerCase();
        
        attempts++;
        
        if (currentMonthName === targetMonth) {
            return currentMonth;
        }
        
    } while (attempts < maxAttempts);
    
    throw new Error(`Could not navigate to target month: ${targetMonth}`);
}

async function navigateBackwardToMonth(tabId, targetMonth) {
    let currentMonth;
    let attempts = 0;
    const maxAttempts = 12; // Prevent infinite loops
    
    do {
        // Click previous month button
        await chrome.scripting.executeScript({
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
        
        // Wait for calendar to update
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Get the new current month
        currentMonth = await getCurrentMonth(tabId);
        const currentMonthName = currentMonth.split(' ')[0].toLowerCase();
        
        attempts++;
        
        if (currentMonthName === targetMonth) {
            return currentMonth;
        }
        
    } while (attempts < maxAttempts);
    
    throw new Error(`Could not navigate to target month: ${targetMonth}`);
}

function getMonthIndex(monthName) {
    const months = [
        'january', 'february', 'march', 'april', 'may', 'june',
        'july', 'august', 'september', 'october', 'november', 'december'
    ];
    return months.indexOf(monthName);
}
