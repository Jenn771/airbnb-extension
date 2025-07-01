console.log("Airbnb Extension is running");

let desiredNights = 0;
let searchParams = {};
let allListings = [];
let listingResults = {}; // Store calculated results by listing index
let observer = null;
let debounceTimer = null;

// Listen for incoming messages sent from popup.js
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "SET_NIGHTS") {
        if (desiredNights === message.nights) {
            return;
        }
        
        desiredNights = message.nights;
        console.log(`Received number of nights from popup: ${desiredNights}`);

        // Get current search parameters
        searchParams = getAirbnbSearchParams();
        console.log('Search parameters:', searchParams);

        // Clear previous results when the number of nights changes
        listingResults = {};

        // Initialize everything
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
        mutations.forEach((mutation) => {
            if (mutation.type === 'childList') {
                mutation.addedNodes.forEach((node) => {
                    // Check if the added node is an element (not text)
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        if (node.matches && node.matches('[data-testid="card-container"]')) {
                            // Individual listing card was added directly
                            shouldReprocess = true;
                        } else if (node.querySelector && node.querySelector('[data-testid="card-container"]')){
                            // Container containing one or more listing cards was added
                            shouldReprocess = true;
                        }
                    }
                });
            }
        });

        // Reprocess only if detected changes
        if (shouldReprocess && desiredNights > 0) {
            clearTimeout(debounceTimer);

            debounceTimer = setTimeout(() => {
                listingResults = {};
                processAllListings();
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
    const listings = document.querySelectorAll('[data-testid="card-container"]');
    console.log(`Found ${listings.length} listings to process`);

    // Reset listings array in case user runs again
    allListings = []; 

    // Loop through each listing and extract basic info
    for (let i = 0; i < listings.length; i++) {
        const listing = listings[i];
        const listingData = extractListingBasicInfo(listing, i);

        // Store listing data for later use
        allListings.push(listingData);

        // Add button to this listing
        addFindBestDatesButton(listingData);

        if (listingData.link !== "No link") {
            console.log(`Processing listing ${i + 1}: ${listingData.title}`);

        }

    }
}

// Extract basic information from a single listing card
function extractListingBasicInfo (listing, index) {
    // Get listing title
    const titleElement = listing.querySelector('[data-testid="listing-card-title"]');
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
    const existingButton = listingElement.querySelector('.find-best-dates-btn');
    if (existingButton) {
        // Update existing button text in case nights changed
        updateButtonText(existingButton, listingIndex);
        return;
    }

    const buttonContainer = document.createElement("div");
    buttonContainer.style.cssText = `
        position: relative; 
        z-index: 9999; 
        pointer-events: auto;
        margin-top: 8px;
    `;

    // Create the button element
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
    `;

    // Set initial button text
    updateButtonText(button, listingIndex);

    const handleClick = (event) => {
        event.stopPropagation(); // Prevent event bubbling
        event.preventDefault(); // Prevent navigating to listing
        event.stopImmediatePropagation();

        console.log(`Button clicked for : ${listingData.title}`);
        console.log(`User wants ${desiredNights} nights`);
        alert(`TODO: Find best dates for ${listingData.title}`);
    };

    button.addEventListener("click", handleClick, true);   // capturing phase listener
    button.addEventListener("mousedown", handleClick, true);  // capturing phase listener
    button.addEventListener("click", handleClick, false);  // bubbling phase listener

    // Container protection
    buttonContainer.addEventListener("click", (event) => {
        event.stopPropagation();
        event.preventDefault();
    }, true);

    buttonContainer.appendChild(button);
    listingElement.appendChild(buttonContainer);
}

// Update button text based on current state
function updateButtonText(button, listingIndex) {
    const result = listingResults[listingIndex];

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

// Clean up observer
window.addEventListener('beforeunload', () => {
    if (observer) {
        observer.disconnect();
    }
});