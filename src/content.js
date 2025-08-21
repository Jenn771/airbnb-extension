let desiredNights = 0;
let searchParams = {};
let allListings = [];
let observer = null;
let debounceTimer = null;
let flexibilityMode = 'respect';

let processingQueue = [];
let isProcessing = false;

const DOM_SELECTORS = {
    CARD_CONTAINER: '[data-testid="card-container"]',
    LISTING_TITLE: '[data-testid="listing-card-title"]',
    BUTTON_CLASS: '.find-best-dates-btn'
};

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "SET_NIGHTS") {
        searchParams = getAirbnbSearchParams();
        console.log('Search parameters:', searchParams);


        if (searchParams.date_picker_type !== 'flexible_dates') {
            alert("This extension only works with flexible date searches.\nPlease click 'Flexible' in Airbnb date picker.");
            return;
        }

        const tripLengths = searchParams.flexible_trip_lengths || [];
        if (tripLengths.includes("one_month")) {
            alert("This extension does not support 'Monthly stays'.\nPlease choose 'Weekend' or 'Week' instead.");
            return;
        }

        if (desiredNights === message.nights && flexibilityMode === message.flexibility) {
            return;
        }

        desiredNights = message.nights;
        flexibilityMode = message.flexibility;

        initializeExtension();
    }
});

function initializeExtension() {
    processAllListings();
    setMutationObserver();
}

function setMutationObserver() {
    if (observer) {
        observer.disconnect();
    }

    observer = new MutationObserver((mutations) => {
        let shouldReprocess = false;

        for (const mutation of mutations) {
            if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                for (const node of mutation.addedNodes) {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        if (node.matches?.(DOM_SELECTORS.CARD_CONTAINER) || node.querySelector?.(DOM_SELECTORS.CARD_CONTAINER)) {
                            shouldReprocess = true;
                            break;
                        }
                    }
                }
                if (shouldReprocess) break;
            }
        }

        if (shouldReprocess && desiredNights > 0) {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                handlePageChange();
            }, 500);
        }
    });

    const configOptions = {
        childList: true,
        subtree: true,
    };

    const targetNode = document.body;
    observer.observe(targetNode, configOptions);
}

function handlePageChange() {
    searchParams = getAirbnbSearchParams();
    console.log("Updated searchParams after DOM change:", searchParams);

    if (searchParams.date_picker_type !== 'flexible_dates') {
        alert("This extension only works with flexible date searches.\nPlease click 'Flexible' in Airbnb date picker.");
        return;
    }

    const tripLengths = searchParams.flexible_trip_lengths || [];
    if (tripLengths.includes("one_month")) {
        alert("This extension does not support 'Monthly stays'.\nPlease choose 'Weekend' or 'Week' instead.");
        return;
    }
    
    processAllListings();
}

function getFirstMonthFromUI() {
    const selectors = [
        'span[id="searchInputDescriptionId"]',
        '[data-testid="little-search-date"] span',
        '[data-testid="little-search-date"] div'
    ];

    let searchText = '';
    
    for (const selector of selectors) {
        const element = document.querySelector(selector);
        if (element && element.textContent) {
            const text = element.textContent.trim();
            if (text.includes('Week in') || text.includes('Weekend in')) {
                searchText = text;
                break;
            }
        }
    }

    if (!searchText) {
        return null;
    }

    const firstMonthMatch = searchText.match(/Week(?:end)? in (\w{3})/i);
    
    if (!firstMonthMatch) {
        return null;
    }

    const firstMonthAbbr = firstMonthMatch[1];
    
    const monthMap = {
        'jan': 'january', 'feb': 'february', 'mar': 'march', 'apr': 'april',
        'may': 'may', 'jun': 'june', 'jul': 'july', 'aug': 'august',
        'sep': 'september', 'oct': 'october', 'nov': 'november', 'dec': 'december'
    };

    const firstMonth = monthMap[firstMonthAbbr.toLowerCase()];
    
    return firstMonth;
}

// Reorder months to start from UI selection since Airbnb's flexible dates don't guarantee chronological order
function reorderMonths(flexible_trip_dates) {
    if (!flexible_trip_dates || flexible_trip_dates.length === 0) {
        return flexible_trip_dates;
    }

    const firstMonth = getFirstMonthFromUI();
    
    if (!firstMonth) {
        console.log('Could not determine first month from UI, using original order');
        return flexible_trip_dates;
    }

    const firstMonthIndex = flexible_trip_dates.indexOf(firstMonth);
    
    if (firstMonthIndex === -1) {
        return flexible_trip_dates;
    }

    const standardMonthOrder = [
        'january', 'february', 'march', 'april', 'may', 'june',
        'july', 'august', 'september', 'october', 'november', 'december'
    ];

    const firstMonthStandardIndex = standardMonthOrder.indexOf(firstMonth);
    
    const reordered = [];
    const remaining = [...flexible_trip_dates];
    
    reordered.push(firstMonth);
    remaining.splice(remaining.indexOf(firstMonth), 1);
    
    let currentMonthIndex = firstMonthStandardIndex;
    
    while (remaining.length > 0) {
        currentMonthIndex = (currentMonthIndex + 1) % 12;
        const nextMonth = standardMonthOrder[currentMonthIndex];
        
        const monthIndex = remaining.indexOf(nextMonth);
        if (monthIndex !== -1) {
            reordered.push(nextMonth);
            remaining.splice(monthIndex, 1);
        }
        
        // Safety check to prevent infinite loops
        if (reordered.length >= flexible_trip_dates.length) {
            break;
        }
    }
    
    if (remaining.length > 0) {
        const sortedRemaining = remaining.sort((a, b) => {
            const aIndex = standardMonthOrder.indexOf(a);
            const bIndex = standardMonthOrder.indexOf(b);
            return aIndex - bIndex;
        });
        reordered.push(...sortedRemaining);
    }
    
    return reordered;
}

function getAirbnbSearchParams() {
    const currentURL = window.location.href;
    const url = new URL(currentURL);
    const urlParams = url.searchParams;

    const flexible_trip_dates = urlParams.getAll('flexible_trip_dates[]');
    const flexible_trip_lengths = urlParams.getAll('flexible_trip_lengths[]');

    let reorderedMonths;

    if (flexible_trip_lengths.includes("one_month")) {
        // Do not reorder months if 'one_month' is selected
        reorderedMonths = flexible_trip_dates;
    } else {
        reorderedMonths = flexible_trip_dates.length > 0
            ? reorderMonths(flexible_trip_dates)
            : determineTargetMonths();
    }
        
    const searchParams = {
        date_picker_type: urlParams.get('date_picker_type'),
        flexible_trip_lengths: urlParams.getAll('flexible_trip_lengths[]'),
        flexible_trip_dates: flexible_trip_dates,
        monthsToCheck: reorderedMonths
    };
    
    return searchParams;
}

async function processAllListings() {
    if (desiredNights === 0) {
        return;
    }

    const listings = document.querySelectorAll(DOM_SELECTORS.CARD_CONTAINER);
    const currentListings = [];

    // Loop through each listing and extract basic info
    for (const [index, listing] of listings.entries()) {
        const listingData = extractListingBasicInfo(listing, index);
        currentListings.push(listingData);
        addFindBestDatesButton(listingData);
    }

    allListings = currentListings;
}

function extractListingBasicInfo (listing, index) {
    const titleElement = listing.querySelector(DOM_SELECTORS.LISTING_TITLE);
    const title = titleElement ? titleElement.innerText : "No title";

    const linkElement = listing.querySelector('a');
    const link = linkElement ? linkElement.href : "No link";

    return { title, link, index, element: listing };
}

function addFindBestDatesButton (listingData) {
    const listingElement = listingData.element;
    const listingIndex = listingData.index;

    const existingButton = listingElement.querySelector(DOM_SELECTORS.BUTTON_CLASS);
    if (existingButton) {
        updateInitialButtonText(existingButton);
        return;
    }

    const buttonContainer = createButtonContainer();
    const button = createButton(listingData, listingIndex)

    buttonContainer.appendChild(button);
    listingElement.appendChild(buttonContainer);
}

function createButtonContainer() {
    const buttonContainer = document.createElement("div");
    buttonContainer.style.cssText = `
        position: relative; 
        z-index: 1; 
        pointer-events: auto;
        margin-top: 8px;
    `;

    // Prevent event bubbling to avoid triggering Airbnb's navigation
    buttonContainer.addEventListener("click", (event) => {
        event.stopPropagation();
        event.preventDefault();
    }, true);

    return buttonContainer;
}

function createButton(listingData, listingIndex) {
    const button = document.createElement("button");
    button.className = 'find-best-dates-btn';
    button.style.cssText = `
        background-color: #0069A6;
        color: white;
        border: none;
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 12px;
        cursor: pointer;
        transition: background-color 0.2s;
        position: relative;
        z-index: 1;
    `;

    updateInitialButtonText(button);

    const handleClick = (event) => {
        event.stopPropagation();
        event.preventDefault();
        event.stopImmediatePropagation();

        addToQueue(listingData);
    };

    // Multiple event listeners to ensure click is captured across different scenarios
    button.addEventListener("click", handleClick, true);
    button.addEventListener("mousedown", handleClick, true);
    button.addEventListener("click", handleClick, false);

    return button;
}

function updateInitialButtonText(button) {
    if (button) {
        button.innerText = `Check Best ${desiredNights}-Night Dates`;
        button.style.backgroundColor = '#0069A6';
        button.disabled = false;
        button.title = "Opens the listing in a new tab to automatically check its calendar (tab remains focused).";
    }
}

function addToQueue(listingData) {
    const existingIndex = processingQueue.findIndex(item => item.index === listingData.index);
    if (existingIndex !== -1) {
        return;
    }

    processingQueue.push({
        ...listingData,
        status: 'pending',
        addedAt: Date.now()
    });
    
    updateButtonToQueued(listingData.index);
    
    if (!isProcessing) {
        processQueue();
    }
}

function updateButtonToQueued(listingIndex) {
    const button = getButtonForListing(listingIndex);
    if (button) {
        button.innerText = 'Queued...';
        button.style.backgroundColor = '#4A90A4';
        button.disabled = true;
        button.title = 'Added to queue, waiting to be processed...';
    }
}

async function processQueue() {
    if (isProcessing) {
        return;
    }

    isProcessing = true;

    while (processingQueue.length > 0) {
        const listingData = processingQueue.shift();

        try {
            updateButtonToProcessing(listingData.index);
            
            const result = await processListing(listingData);
            
            if (result && result.success && result.results) {
                updateButtonWithResult(listingData.index, result.results);
            } else if (result && result.success === false) {
                console.warn(`Failed to process listing ${listingData.index}: ${result.error}`);
                updateButtonToError(listingData.index);
            } else {
                console.warn(`No response for listing ${listingData.index}`);
                updateButtonToError(listingData.index);
            }
        } catch (error) {
            console.error(`Error processing listing ${listingData.index}:`, error);
            updateButtonToError(listingData.index);
        }
        
        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    isProcessing = false;
}

async function processListing(listingData) {
    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({
            type: "OPEN_LISTING_TAB",
            link: listingData.link,
            mode: flexibilityMode,
            nights: desiredNights,
            tripLength: searchParams.flexible_trip_lengths,
            months: searchParams.monthsToCheck
        }, (response) => {
            if (chrome.runtime.lastError) {
                console.error("Message failed:", chrome.runtime.lastError);
                resolve(null);
            } else if (response && response.success) {
                resolve({ success: true, results: response.results });
            } else if (response && !response.success) {
                resolve({ success: false, error: response.error });
            } else {
                console.warn("Failed to open tab via background.");
                resolve(null);
            }
        });
    });
}

function determineTargetMonths() {
    const currentDate = new Date();
    const months = [];
    for (let i = 1; i < 4; i++) {
        const monthDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + i, 1);
        months.push(monthDate.toLocaleString('en-US', { month: 'long' }).toLowerCase());
    }
    return months;
}

function updateButtonToProcessing(listingIndex) {
    const button = getButtonForListing(listingIndex);
    if (button) {
        button.innerText = 'Processing...';
        button.style.backgroundColor = '#2E7D9A';
        button.disabled = true;
        button.title = 'Currently processing this listing...';
    }
}

function updateButtonToError(listingIndex) {
    const button = getButtonForListing(listingIndex);
    if (button) {
        button.innerText = 'Error - Try Again';
        button.style.backgroundColor = '#D9534F';
        button.disabled = false;
        button.title = 'Something went wrong. Click to try again.';
    }
}

function updateButtonWithResult(listingIndex, result) {
    const button = getButtonForListing(listingIndex);
    
    if (button && result && result.bestDates && result.bestPrice) {
        button.innerHTML = `<strong>${result.bestPrice}</strong> • ${result.bestDates}`;
        button.style.backgroundColor = '#6097B3';
        button.disabled = true;
        button.title = `Best price: ${result.bestPrice} for dates: ${result.bestDates}`;
    } else if (button && result && (!result.bestDates || !result.bestPrice)) {
        button.innerText = 'No Available Dates';
        button.style.backgroundColor = '#808080';
        button.disabled = true;
        button.title = 'No available dates found for this listing';
    }
}

function getButtonForListing(listingIndex) {
    const listingElement = allListings[listingIndex]?.element;
    return listingElement?.querySelector(DOM_SELECTORS.BUTTON_CLASS);
}

window.addEventListener('beforeunload', () => {
    if (observer) {
        observer.disconnect();
    }
    if (debounceTimer) {
        clearTimeout(debounceTimer);
    }
});