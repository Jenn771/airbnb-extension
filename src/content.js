console.log("Airbnb Extension is running");

let desiredNights = 0;
let searchParams = {};
let allListings = [];

// Listen for incoming messages sent from popup.js
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "SET_NIGHTS") {
        desiredNights = message.nights;
        console.log(`Received number of nights from popup: ${desiredNights}`);

        // Get current search parameters
        searchParams = getAirbnbSearchParams();
        console.log('Search parameters:', searchParams);

        // Start processing each listing
        processAllListings();
    }
});

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

