document.addEventListener('DOMContentLoaded', function(){
    getListingData(null); //changed

    if(window.location.pathname.endsWith('listing-details.html')){
        setUpListingDetailsPage();
    }

    if(window.location.pathname.endsWith('account.html')){
        setAccountPage(); //setAccountPage uses fetchData 
    }

    const searchButton = document.getElementById('search-button');
    if(searchButton){
        searchButton.addEventListener('click', async () => {
            const searchInput = document.getElementById('search-bar').value;
            searchListings(searchInput);
            const startOfListings = document.getElementById('start-of-listings');
            startOfListings.scrollIntoView({ behavior: 'smooth'});
        })
    }
    
//login-register forms
    const registerLink = document.getElementById('register-link');
    const loginLink = document.getElementById('login-link');
    const loginBody = document.getElementById('login-body');
    const registerBody = document.getElementById('register-body');
    if(registerLink){
         registerLink.addEventListener('click', function() {
        toggleForm(loginBody, registerBody)});
    }
    if(loginLink){
        loginLink.addEventListener('click', function() {
        toggleForm(loginBody, registerBody);});
    }

//login-register submit button
    const registerForm = document.getElementById("register-form");
    if(registerForm){
        registerForm.addEventListener('submit', event => {
            event.preventDefault();
            const formData = new FormData(registerForm);
            const data = Object.fromEntries(formData);
            console.log(data);
            registerUser(data);
        })
    }

    const loginForm = document.getElementById("login-form");
    if(loginForm){
        loginForm.addEventListener('submit', event => {
        event.preventDefault();
        const formData = new FormData(loginForm);
        const data = Object.fromEntries(formData);
        console.log(data);
        loginUser(data);
        })
    }

//listing-form
    const listingForm = document.getElementById('listing-form');
    if(listingForm){
        listingForm.addEventListener('submit', event => {
        event.preventDefault();
        createListing();
        listingForm.reset();
        });
    } 

const addListingButton = document.getElementById("add-listing-button");
if(addListingButton){
    addListingButton.addEventListener('click', async () => {
        console.log("The add listing button was clicked");
        const loggedIn = await checkAuthentication();
        if(loggedIn){ 
            window.location.href = "listing-form.html";
        } else {
            const targetUrl = '/listing-form.html';
            await setReturnUrl(targetUrl);
            window.location.href = "login.html";
        }
    });
} else {
    console.log("addListingButton element not found");
}

const deleteListingButton = document.getElementById('delete-listing-button');
if(deleteListingButton){
    deleteListingButton.addEventListener('click', async () => {
        deleteListing();
        document.getElementById('listing-details-page-address-title').textContent = "This listing has been deleted";
        document.getElementById('listing-details-page-price').textContent = "";
        document.getElementById('listing-details-page-bedrooms').textContent = "";
        document.getElementById('listing-details-page-bathrooms').textContent = "";
        document.getElementById('listing-details-page-size').textContent = "";
        document.getElementById('listing-details-page-image').src = "/images/no-image-available.jpg";
        document.getElementById('delete-listing-button').style.display = "none";
    });
}

const accountPageLink = document.getElementById('account-page-link');
if(accountPageLink){
    accountPageLink.addEventListener('click', async (event) => {
        event.preventDefault();
        window.location.href = "account.html";
    });
}

const facebookLoginButton = document.getElementById('facebook-login-button');
if(facebookLoginButton){
    facebookLoginButton.addEventListener('click', function() {
        window.location.href = "/login/facebook";
    });
}

// Open the dialog on page load
const dialog = document.getElementById('site-intro-dialog');
if(dialog){
    dialog.showModal();

    // Close dialog when close button is clicked
    document.getElementById('close-dialog').addEventListener('click', () => {
        dialog.close();
    });
    
}

}) ////end of main event listener////


async function setReturnUrl(url) {
    await fetch('/set-return-url', {
        method: 'POST',
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ returnTo: url })
    });
}

//search by rental type, city, borough or zipcode
//trim
//error handling
//remove case sensitivity in backend route
async function searchListings(searchTerm) {
    if (!searchTerm.trim()) {
        alert('Please enter a search term.');
        return;
    }
    console.log("Search term: ", searchTerm);
    const params = new URLSearchParams();
    const boroughs = ['brooklyn', 'manhattan', 'queens', 'bronx', 'staten island'];
    const rentalTypes = ['apartment', 'room', 'couch'];
    if (rentalTypes.includes(searchTerm.toLowerCase())){
        params.append('rental_type', searchTerm);
    } else if (searchTerm.match(/^\d{5}$/)) { //zipcode
        params.append('zipcode', searchTerm);
    } else if (boroughs.includes(searchTerm.toLowerCase())) {
        params.append('borough', searchTerm);
    } else {
        params.append('city', searchTerm);
    }
    const url = `/listings?${params.toString()}`; 
    console.log("url: ", url);
    getListingData(url);
}


//TODO: add feedback to user that the listing has been deleted
//Returns user data based on the session info automatically sent with the request (req.session.userId)
async function setAccountPage(){
    try{
        const generalUrl = 'protected/users';
        const userDataArray = await fetchProtectedData(generalUrl); //for active listings, photo and username
        if(userDataArray.length === 0){
            throw new error("No user data found");
        }

        const { userInfoResults, listingsResults } = userDataArray; 
        document.getElementById('username-title').textContent = userInfoResults.username;
        document.getElementById('user-image').src = userInfoResults.photo_url;
        console.log("username:",userInfoResults.username);
        console.log("photo_url:",userInfoResults.photo_url);
        const activeListingslist = document.getElementById('user-listings-list');

        if(listingsResults && listingsResults.length > 0){
             for(i=0; i<listingsResults.length; i++){
             const { listing_id, street_address } = listingsResults[i];
             const container = document.createElement("li");
             container.className = "user-listings-container";
             const listing = document.createElement("p");
             listing.textContent = street_address;
             const deleteListingLink = document.createElement("a");
             deleteListingLink.textContent = "Delete";
             container.appendChild(listing);
             container.appendChild(deleteListingLink);
             activeListingslist.appendChild(container); 

             deleteListingLink.addEventListener('click', () => deleteListing(listing_id));
             };
        } else {
            activeListingslist.innerHTML = "<p>No active listings</p>";
        }
        const favoritesUrl = 'protected/favorites';
        const favoritesResults = await fetchProtectedData(favoritesUrl);
        if(favoritesResults.length === 0){
            throw new error("No user data found");
        }
        const userFavoritesList = document.getElementById("user-favorites-list");
        if(favoritesResults && favoritesResults.length > 0){
            for(j=0; j<favoritesResults.length; j++){
                const { street_address } = favoritesResults[j]; //get listing_id later for remove button
                console.log(street_address);
                const favoritesContainer = document.createElement("li");
                favoritesContainer.className = "user-favorites-container";
                const favoriteListing = document.createElement("p");
                favoriteListing.textContent = street_address;
                favoritesContainer.appendChild(favoriteListing);
                userFavoritesList.appendChild(favoritesContainer);
            }
        }else{
            userFavoritesList.innerHTML = "<p>No favorites.</p>";
        }
        
    } catch(error){
        console.error("Error setting up the account page", error);
    }

}

//for use with protected (signed-in) endpoints
async function fetchProtectedData(url) {
    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: { "Content-Type": "application/json" }
        });
        if (response.status === 401) { //would be the response from isAuthenticated saying they're unauthorized
            const targetUrl = window.location.pathname; 
            await setReturnUrl(targetUrl);
            window.location.href = "/login.html";
            throw new Error("Unauthorized");
        }
        if (!response.ok) {
            throw new Error(`Error fetching data from ${url}: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error(`Error in fetchProtectedData for ${url}`, error);
        throw error;
    }
}

async function getListingData(paramsUrl){ 
    const url = paramsUrl || '/listings'; 
    try{
        const response = await fetch(url,{
            method: "GET",
            headers: {"Content-Type": "application/json"},
        });
        const data = await response.json();
        if(!data || data.length === 0){ //modify
            console.log("No listings found.");
            hideUnusedListings(0);
            return;
        }
        data.forEach((item, index) => { 
            const favoriteIconElements = document.getElementsByClassName('favorite-icon');
            const listingElements = document.getElementsByClassName('listing');
            const streetAddressElements = document.getElementsByClassName('street-address');
            const priceElements = document.getElementsByClassName('price');
            const numBedroomsElements = document.getElementsByClassName('bedroom-quantity');
            const numBathroomsElements = document.getElementsByClassName('bathroom-quantity');
            const sizeElements = document.getElementsByClassName('size');
           // const photoUrlElements = document.getElementsByClassName('property-image');
            if(index < streetAddressElements.length){
               listingElements[index].setAttribute('data-id',item.listing_id);
               listingElements[index].style.display = 'block';

               listingElements[index].removeEventListener('click', handleListingClick); 
               listingElements[index].addEventListener('click', handleListingClick); 

                favoriteIconElements[index].removeEventListener('click', handleFavoriteClick);
                favoriteIconElements[index].addEventListener('click', handleFavoriteClick);
                
                streetAddressElements[index].textContent = item.street_address;
                priceElements[index].textContent = "$" + item.price;
                numBedroomsElements[index].textContent = "Beds: " + item.bedroom_quantity;
                numBathroomsElements[index].textContent = "Baths: " + item.bathroom_quantity;
                sizeElements[index].textContent = "Sq ft: " + item.size;
                //photoUrlElements[index].src = item.photo_url;
               // console.log("item.photo_url");
            }
        });   
        hideUnusedListings(data.length);
    }   
    catch(error){
        console.error("Error fetching listing data: ", error);
    }
}

function hideUnusedListings(startIndex){
    const listingElements = document.getElementsByClassName('listing');
    for(let i=startIndex; i<listingElements.length; i++){
        listingElements[i].style.display = 'none';
    }
}

function handleListingClick(event){
    const listingId = event.currentTarget.getAttribute('data-id');
    localStorage.setItem('selectedListingId',listingId);
    window.location.href="listing-details.html";
}

function handleFavoriteClick(event){
    event.stopPropagation();
    const favoriteIcon = event.currentTarget;
    favoriteIcon.src = "/images/filled-star-icon.png";
    const listingId = favoriteIcon.closest('.listing').getAttribute('data-id');
    addToFavorites(listingId);
}

async function addToFavorites(listingId) {
    try {
        const response = await fetch('/protected/favorites', {
            method: 'POST',
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ listing_id: listingId })
        });

        if (!response.ok && !response.status === 401) { //if they're not logged in, do nothing
            throw new Error(`Error adding to favorites: ${response.status}`);
        }

        const result = await response.json();
    } catch (error) {
        console.error("Error in addToFavorites:", error);
    }
}

async function setUpListingDetailsPage(){
    const listingId = localStorage.getItem('selectedListingId');
    if(!listingId){
        console.error("No listing id found in localStorage");
        return;
    }
    try{
        const response = await fetch(`/listings?listing_id=${listingId}`);
        if(!response.ok){
            throw new Error(`Error getting response from fetch request: ${response.status}`);
        }
        const listingArray = await response.json();
        const listing = listingArray[0];
        if(!listing){
            console.error("Listing not found");
            return;
        }
        document.getElementById('listing-details-page-address-title').textContent = listing.street_address;
        document.getElementById('listing-details-page-price').textContent = `$${listing.price}`;
        document.getElementById('listing-details-page-bedrooms').textContent = `Beds: ${listing.bedroom_quantity}`;
        document.getElementById('listing-details-page-bathrooms').textContent = `Baths: ${listing.bathroom_quantity}`;
        document.getElementById('listing-details-page-size').textContent = `Sq ft: ${listing.size}`;
        document.getElementById('listing-details-page-image').src = `${listing.photo_url}`
    } catch(error){
        console.error("setUpListingDetailsPage: Error getting the listing details", error);
    }
}

//TODO: logic to check if a user is logged in already
async function checkAuthentication(){
    try{
        const response = await fetch('/protected/add-listing', {
            method: "GET",
            headers: {"Content-Type": "application/json"},
            credentials: 'include'
        })
        return response.ok;
    }catch(error){
        console.error("checkAuthentication: error checking authentication", error);
        return false;
    }
    
};

async function createListing(){ 
    const streetAddress = document.getElementById("street-address").value;
    const city = document.getElementById("city").value;
    const zipcode = document.getElementById("zipcode").value;
    const price = parseInt(document.getElementById("price").value);
    const numberOfBedrooms = parseInt(document.getElementById("number-of-bedrooms").value);
    const numberOfBathrooms = parseInt(document.getElementById("number-of-bathrooms").value);
    const photoUrl = document.getElementById("photo-url").value;
    const size = parseInt(document.getElementById("size").value);
    console.log("In createListing: " + streetAddress + " " + city + " " + zipcode + " " + price + " " +
         numberOfBedrooms + " " + numberOfBathrooms + " " + size + " " + photoUrl);
    await fetch("/listings", {
        method: "POST", 
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({"street_address": streetAddress, "city": city, 
            "zipcode": zipcode, "price": price, "bedroom_quantity": numberOfBedrooms,
            "bathroom_quantity": numberOfBathrooms, "photo_url": photoUrl, "size": size
        })
    })
    .then(response => {
        if(!response.ok){
            throw new Error("Bad response " + response.statusText);
        }
        return response.json();
    })
    .then(data => {
        console.log("Successfully posted", data);
    })
    .catch(error => console.error("Error creating listing in createListing function", error))
}

async function deleteListing(listingId){
    if(!listingId){
        console.error("No listing id");
        return;
    }
    const response = await fetch(`/listings?listing_id=${listingId}`, {
            method: "DELETE",
            headers:{ "Content-Type": "application/json"
            }
        })
    .then(response => {
        if(!response.ok){
            throw new Error(`Error getting response from fetch request: ${response.status}`);
        }
        return response.json();
    })
    .catch(error => console.error("deleteListing(): Error fetching route to delete listing", error))
}

//TODO: Check return
async function registerUser(data){
    const { email, username, password } = data;
    await fetch("/users", {
        method: "POST", 
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({"email": email, "username": username, "password": password})
    })
    .then(response => {
        if(!response.ok){
            throw new Error("Bad response " + response.statusText);
        }
        return response.json();
    })
    .then(data => {
        console.log("Successfully posted", data);
    })
    .catch(error => console.error("From registerUser(): Registration was unsuccessful", error))
}

//login user function
async function loginUser(data) {
    const { username, password } = data;
    
    try {
        const response = await fetch('/users/login', {
            method: "POST",
            credentials: 'include',
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({"username": username, "password": password})
        });

        if (!response.ok) {
            throw new Error("Bad response: " + response.statusText);
        }

        const responseData = await response.json(); // Await here to resolve the JSON response
        console.log("From loginUser(): successfully logged in", responseData);

        // Redirect the user to the appropriate URL
        window.location.href = responseData.redirectUrl;

    } catch (error) {
        console.error("From loginUser(): login was unsuccessful", error);
    }
}

function toggleForm(loginBody, registerBody){
    if(registerBody.style.display === 'none'){
        registerBody.style.display = 'block';
        loginBody.style.display = 'none';
    } else {
        registerBody.style.display = 'none';
        loginBody.style.display = 'block';
    }
}


//TODO: Fix images