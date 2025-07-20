console.log("Airbnb Extension is running");

let desiredNights = 0;
let searchParams = {};
let allListings = [];
let listingResults = new Map(); // Store calculated results by listing index
let observer = null;
let debounceTimer = null;
let flexibilityMode = 'respect';

let processingQueue = [];
let isProcessing = false;
let maxConcurrent = 1;


const DOM_SELECTORS = {
    CARD_CONTAINER: '[data-testid="card-container"]',
    LISTING_TITLE: '[data-testid="listing-card-title"]',
    BUTTON_CLASS: '.find-best-dates-btn'
};

// Listen for incoming messages sent from popup.js
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "SET_NIGHTS") {
        // Get current search parameters
        searchParams = getAirbnbSearchParams();
        console.log('Search parameters:', searchParams);

        if (searchParams.date_picker_type !== 'flexible_dates') {
            alert("This extension only works with flexible date searches.\nPlease click 'Flexible' in Airbnb date picker.");
            return;
        }

        if (desiredNights === message.nights && flexibilityMode === message.flexibility) {
            return;
        }

        desiredNights = message.nights;
        flexibilityMode = message.flexibility;
        
        console.log(`Received number of nights from popup: ${desiredNights}, flexibility: ${flexibilityMode}`);

        listingResults.clear();
        initializeExtension();
        
    }
});

function initializeExtension() {
    // Start processing each listing and set up observer
    processAllListings();
    setMutationObserver();
}

function setMutationObserver() {
    if (observer) {
        observer.disconnect();
    }

    // Create new observer
    observer = new MutationObserver((mutations) => {
        let shouldReprocess = false;

        // Check if new listing cards were added
        for (const mutation of mutations) {
            if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                // Check if any added nodes contain lisiting cards
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

        // Reprocess only if detected changes
        if (shouldReprocess && desiredNights > 0) {
            clearTimeout(debounceTimer);

            debounceTimer = setTimeout(() => {
                handlePageChange();
            }, 500);
        }
    });


    // Changes to look for
    const configOptions = {
        childList: true,    // Watch for added/removed elements
        subtree: true,      // Watch the entire subtree
    };

    const targetNode = document.body;
    observer.observe(targetNode, configOptions);

    console.log('MutationObserver set up to watch for listing changes');
}

function handlePageChange() {
    searchParams = getAirbnbSearchParams();
    console.log("Updated searchParams after DOM change:", searchParams);

    if (searchParams.date_picker_type !== 'flexible_dates') {
        alert("This extension only works with flexible date searches.\nPlease click 'Flexible' in Airbnb date picker.");
        return;
    }

    // Clear results
    listingResults.clear();
    
    processAllListings();
}

// Function to extract search parameters from current Airbnb URL
function getAirbnbSearchParams() {
    const currentURL = window.location.href;
    const url = new URL(currentURL);
    const urlParams = url.searchParams;

    // Extract only the relevant search parameters used in flexible date searches
    const searchParams = {
        // Confirms this is a flexible date search (should be "flexible_dates")
        date_picker_type: urlParams.get('date_picker_type'),

        // DATE PARAMETERS
        flexible_trip_lengths: urlParams.getAll('flexible_trip_lengths[]'), // e.g., "one_week" or "weekend_trip" or "one_month"
        flexible_trip_dates: urlParams.getAll('flexible_trip_dates[]'), // e.g., ["june", "july", "august"]
  
        // Price range
        price_min: urlParams.get('price_min') || '',
        price_max: urlParams.get('price_max') || '',
    };
    
    return searchParams;
}

// Loop through all the listings on the current page and call other functions
async function processAllListings() {
    // Only proceed if user has set desired nights
    if (desiredNights === 0) {
        console.log('No nights specified yet');
        return;
    }

    // Select all listing cards on the Airbnb search results page 
    const listings = document.querySelectorAll(DOM_SELECTORS.CARD_CONTAINER);
    console.log(`Found ${listings.length} listings to process`);

    // Update listings array in case user runs again
    const currentListings = [];

    // Loop through each listing and extract basic info
    for (const [index, listing] of listings.entries()) {
        const listingData = extractListingBasicInfo(listing, index);
        
        // Store listing data for later use
        currentListings.push(listingData);

        // Add button to this listing
        addFindBestDatesButton(listingData);

        if (listingData.link !== "No link") {
            console.log(`Processing listing ${index + 1}: ${listingData.title}`);

        }
    }

    allListings = currentListings;
}

// Extract basic information from a single listing card
function extractListingBasicInfo (listing, index) {
    // Get listing title
    const titleElement = listing.querySelector(DOM_SELECTORS.LISTING_TITLE);
    const title = titleElement ? titleElement.innerText : "No title";

    // Extract the link to the full listing page
    const linkElement = listing.querySelector('a');
    const link = linkElement ? linkElement.href : "No link";

    return { title, link, index, element: listing };
}


// Add "Find Best Dates" button to a listing
function addFindBestDatesButton (listingData) {
    const listingElement = listingData.element;
    const listingIndex = listingData.index;

    // Check if button already exists 
    const existingButton = listingElement.querySelector(DOM_SELECTORS.BUTTON_CLASS);
    if (existingButton) {
        // Update existing button text in case nights changed
        updateButtonText(existingButton, listingIndex);
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

    // Container protection
    buttonContainer.addEventListener("click", (event) => {
        event.stopPropagation();
        event.preventDefault();
    }, true);

    return buttonContainer;
}

// Create buttom element
function createButton(listingData, listingIndex) {
    const button = document.createElement("button");
    button.className = 'find-best-dates-btn';
    button.style.cssText = `
        background-color: #FF5A5F;
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

    // Set initial button text
    updateButtonText(button, listingIndex);

    const handleClick = (event) => {
        event.stopPropagation();
        event.preventDefault();
        event.stopImmediatePropagation();

        /* console.log(`Button clicked for: ${listingData.title}`);
        console.log(`User wants ${desiredNights} nights, flexibility: ${flexibilityMode}`);
        */

        // Add listing to the processing queue 
        addToQueue(listingData);
    };

    button.addEventListener("click", handleClick, true);   // capturing phase listener
    button.addEventListener("mousedown", handleClick, true);  // capturing phase listener
    button.addEventListener("click", handleClick, false);  // bubbling phase listener

    return button;
}

// Update button text based on current state
function updateButtonText(button, listingIndex) {
    const result = listingResults.get(listingIndex);

    if(result) {
        // Show the calcualte result
        button.innerText = "TODO: show best price and date range";
        button.style.backgroundColor = '#00A699';
        button.disabled = true; 
    } else {
        // Show default text
        button.innerText = `Find Best ${desiredNights}-Night Dates`;
        button.style.backgroundColor = '#FF5A5F';
        button.disabled = false;
    }
}

function addToQueue(listingData) {
    // Check if already in queue
    const existingIndex = processingQueue.findIndex(item => item.index === listingData.index);
    if (existingIndex !== -1) {
        console.log(`Listing ${listingData.index} already in queue`);
        return;
    }

    // Add to queue
    processingQueue.push({
        ...listingData,
        status: 'pending',
        addedAt: Date.now()
    });

    console.log(`Added listing ${listingData.index} to queue. Queue length: ${processingQueue.length}`);

    // Start processing
    if (!isProcessing) {
        processQueue();
    }
}

// Main queue processor
async function processQueue() {
    if (isProcessing) {
        console.log('Queue processor already running');
        return;
    }

    isProcessing = true;
    console.log('Starting queue processing...');

    while (processingQueue.length > 0) {
        const listingData = processingQueue.shift();
        
        try {
            console.log(`Processing listing ${listingData.index}: ${listingData.title}`);
            
            // Update button to show processing state
            updateButtonToProcessing(listingData.index);
            
            // Process the listing
            const result = await processListing(listingData);
            
            if (result) {
                console.log(`Successfully processed listing ${listingData.index}`);
                
            } else {
                console.warn(`Failed to process listing ${listingData.index}`);
                updateButtonToError(listingData.index);
            }
        } catch (error) {
            console.error(`Error processing listing ${listingData.index}:`, error);
            updateButtonToError(listingData.index);
        }
        
        // Small delay between listings to avoid overwhelming the page
        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    isProcessing = false;
    console.log('Queue processing completed');
}

async function processListing(listingData) {
    const monthsToCheck = searchParams.flexible_trip_dates.length > 0 
        ? searchParams.flexible_trip_dates 
        : determineTargetMonths();

    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({
            type: "OPEN_LISTING_TAB",
            link: listingData.link,
            mode: flexibilityMode,
            nights: desiredNights,
            tripLength: searchParams.flexible_trip_lengths,
            months: monthsToCheck,
            priceRange: {
                min: searchParams.price_min || null,
                max: searchParams.price_max || null
            }
        }, (response) => {
            if (chrome.runtime.lastError) {
                console.error("Message failed:", chrome.runtime.lastError);
                resolve(null);
            } else if (response && response.success) {
                console.log("Background opened and closed tab");
                resolve({ status: "opened", results: response.results });
            } else {
                console.warn("Failed to open tab via background.");
                resolve(null);
            }
        });
    });
}

// Generate 3 months if user didn't select any months
function determineTargetMonths() {
    const currentDate = new Date();
    const months = [];
    for (let i = 0; i < 3; i++) {
        const monthDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + i, 1);
        months.push(monthDate.toLocaleString('en-US', { month: 'long' }).toLowerCase());
    }
    return months;
}

function updateButtonToProcessing(listingIndex) {
    const button = getButtonForListing(listingIndex);
    if (button) {
        button.innerText = 'Processing...';
        button.style.backgroundColor = '#FFA500';
        button.disabled = true;
    }
}

function updateButtonToError(listingIndex) {
    const button = getButtonForListing(listingIndex);
    if (button) {
        button.innerText = 'Error - Try Again';
        button.style.backgroundColor = '#FF0000';
        button.disabled = false;
    }
}

function getButtonForListing(listingIndex) {
    const listingElement = allListings[listingIndex]?.element;
    return listingElement?.querySelector(DOM_SELECTORS.BUTTON_CLASS);
}

// Clean up observer
window.addEventListener('beforeunload', () => {
    if (observer) {
        observer.disconnect();
    }
    if (debounceTimer) {
        clearTimeout(debounceTimer);
    }
});