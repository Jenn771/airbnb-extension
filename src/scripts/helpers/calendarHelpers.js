async function clearSelectedDates(tabId) {
    try {
        const [result] = await chrome.scripting.executeScript({
            target: { tabId },
            func: () => {
                const buttons = document.querySelectorAll('button[type="button"]');
                
                for (const button of buttons) {
                    if (button.textContent.trim() === "Clear dates") {
                        button.click();
                        return true;
                    }
                }
                
                // Fallback for different UI variations
                const fallback = document.querySelector('button.l1ovpqvx');
                if (fallback && fallback.textContent.includes("Clear")) {
                    fallback.click();
                    return true;
                }
                
                return false;
            }
        });
        
        if (result?.result) {
            await new Promise(resolve => setTimeout(resolve, 300));
        }
    } catch (error) {
        console.error("Error clearing selected dates:", error);
        throw error;
    }
}

async function getCurrentMonth(tabId) {
    await ensureTabActive(tabId);

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
            
            return monthTitle.textContent;
        }
    });
    
    return result.result;
}

async function ensureTabActive(tabId) {
    try {
        await chrome.tabs.update(tabId, { active: true });
        await new Promise(resolve => setTimeout(resolve, 200));
    } catch (error) {
        console.warn("Could not activate tab:", error);
    }
}

async function navigateForwardToMonth(tabId, targetMonth) {
    let currentMonth;
    let attempts = 0;
    const maxAttempts = 12; // Prevent infinite loops
    
    await ensureTabActive(tabId);

    do {
        currentMonth = await getCurrentMonth(tabId);
        const currentMonthName = currentMonth.split(' ')[0].toLowerCase();

        if (currentMonthName === targetMonth) {
            return currentMonthName;
        }

        const clickResult = await chrome.scripting.executeScript({
            target: { tabId },
            func: () => {
                const nextButton = document.querySelector('button[aria-label="Move forward to switch to the next month."]');
                if (nextButton && !nextButton.disabled) {
                    nextButton.click();
                    return true;
                } else {
                    return false;
                }
            }
        });
        
        if (!clickResult[0].result) {
            throw new Error('Could not click next month button');
        }

        // Wait for calendar to update
        await new Promise(resolve => setTimeout(resolve, 600));
        
        attempts++;
        
    } while (attempts < maxAttempts);
    
    throw new Error(`Could not navigate to target month: ${targetMonth}`);
}

async function navigateBackwardToMonth(tabId, targetMonth) {
    let currentMonth;
    let attempts = 0;
    const maxAttempts = 12; // Prevent infinite loops

    await ensureTabActive(tabId);
    
    do {
        currentMonth = await getCurrentMonth(tabId);
        const currentMonthName = currentMonth.split(' ')[0].toLowerCase();

        if (currentMonthName === targetMonth) {
            return currentMonthName;
        }
        
        const clickResult = await chrome.scripting.executeScript({
            target: { tabId },
            func: () => {
                const prevButton = document.querySelector('button[aria-label="Move backward to switch to the previous month."]');
                if (prevButton && !prevButton.disabled) {
                    prevButton.click();
                    return true;
                } else {
                    return false;
                }
            }
        });

        if (!clickResult[0].result) {
            throw new Error('Could not click previous month button');
        }

        // Wait for calendar to update
        await new Promise(resolve => setTimeout(resolve, 600));
        
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