// Clear any pre-selected dates first
async function clearSelectedDates(tabId) {
    try {
        const [result] = await chrome.scripting.executeScript({
            target: { tabId },
            func: () => {
                const buttons = document.querySelectorAll('button[type="button"]');
                
                // Find the button with "Clear dates" text
                for (const button of buttons) {
                    if (button.textContent.trim() === "Clear dates") {
                        button.click();
                        console.log("Clicked Clear dates button");
                        return true;
                    }
                }
                
                const fallback = document.querySelector('button.l1ovpqvx');
                if (fallback && fallback.textContent.includes("Clear")) {
                    fallback.click();
                    return true;
                }
                
                console.log("No 'Clear dates' button found");
                return false;
            }
        });
        
        if (result?.result) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            console.log("Successfully cleared selected dates");
        }
    } catch (error) {
        console.error("Error clearing selected dates:", error);
        throw error;
    }
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
            console.log('current month:', currentMonthName); //---
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

export {
  clearSelectedDates,
  getCurrentMonth,
  navigateForwardToMonth,
  navigateBackwardToMonth,
  getMonthIndex
};
