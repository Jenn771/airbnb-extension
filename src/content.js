console.log("Airbnb Extension is running");

let userNights = 0;
let searchParams = {};

// Listen for incoming messages sent from popup.js
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "SET_NIGHTS") {
        userNights = message.nights;
        console.log(`Received number of nights from popup: ${userNights}`);

        // Get current search parameters
        searchParams = getAirbnbSearchParams();
        console.log('Search parameters:', searchParams);

        // Start processing each listing
        processAllListings();
    }
});

// Function to extract search parameters from current Airbnb URL
function getAirbnbSearchParams() {
    // Get the current page's full URL
    const currentURL = window.location.href;

    // Use the URL object to easily access query parameters
    const url = new URL(currentURL);
    const urlParams = url.searchParams;

    // Extract only the relevant search parameters used in flexible date searches
    const searchParams = {

        place_id: urlParams.get('place_id') || '',

        // Confirms this is a flexible date search (should be "flexible_dates")
        date_picker_type: urlParams.get('date_picker_type'),

        // DATE PARAMETERS
        flexible_trip_lengths: urlParams.getAll('flexible_trip_lengths[]'), // e.g., "one_week" or "weekend_trip" or "one_month"
        flexible_trip_dates: urlParams.getAll('flexible_trip_dates[]'), // e.g., ["june", "july", "august"]
       
        // Alternative flexible parameters 
        monthly_start_date: urlParams.get('monthly_start_date'),
        monthly_end_date: urlParams.get('monthly_end_date'),
        monthly_length: urlParams.get('monthly_length'),
  
        // Price range
        price_min: urlParams.get('price_min') || '',
        price_max: urlParams.get('price_max') || '',
    };
    
    return searchParams;
}

// Loop through all the listings on the current page and call other functions
async function processAllListings() {
    const listings = document.querySelectorAll('[data-testid="card-container"]');
    console.log(`Found ${listings.length} listings to process`);

    // loop through each listing
    for (let i = 0; i < listings.length; i++) {
        const listing = listings[i];
        const listingData = extractListingBasicInfo(listing, i); // call extractListingBasicInfo() to get the listing data

        if (listingData.link !== "No link") {
            console.log(`Processing listing ${i + 1}: ${listingData.title}`);

        }
    }
}

function extractListingBasicInfo (listing, index) {
    // Get listing title using the listing-card-title test id
    const titleElement = listing.querySelector('[data-testid="listing-card-title"]');
    const title = titleElement ? titleElement.innerText : "No title";

    // Extract the link to the full listing
    const linkElement = listing.querySelector('a');
    const link = linkElement ? linkElement.href : "No link";

    return { title, link, index };
}

setTimeout(() => {
    // Select all listing cards on the Airbnb search results page 
    // Using Airbnb's data-testid attribute
    const listings = document.querySelectorAll('[data-testid="card-container"]');

    // Loop through each listing card to extract info
    listings.forEach((listing, index) => {
        // Get the listing title using the listing-card-title test id
        const titleElement = listing.querySelector('[data-testid="listing-card-title"]');
        const title = titleElement ? titleElement.innerText : "No title";

        // Extract the price
        const priceSpans = Array.from(listing.querySelectorAll('span')).filter(span =>
            /^\$\d{1,3}(,\d{3})*(\.\d{2})?$/.test(span.innerText.trim())
        );

        // If multiple prices found, assume last is current discounted price
        const price = priceSpans.length > 0 ? priceSpans[priceSpans.length - 1].innerText.trim() : "No price";


        // Extract the link to the full listing
        const linkElement = listing.querySelector('a');
        const link = linkElement ? linkElement.href : "No link";

        // Log the extracted info
        console.log(`Listing ${index + 1}`);
        console.log("Title:", title);
        console.log("Price:", price);
        console.log("Link:", link);
    });
}, 3000); // Wait 3 seconds to let Airbnb content load
