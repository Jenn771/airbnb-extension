console.log("Airbnb Extension is running");

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
