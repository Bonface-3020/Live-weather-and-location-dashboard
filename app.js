const cityName = document.querySelector("#cityName");
const coordsDisplay = document.querySelector("#coordsDisplay");
const locateBtn = document.querySelector("#locateBtn");
const statusAlert = document.querySelector("#statusAlert");
const statusMessage = document.querySelector("#statusMessage");
let statusTimeout;
let locationRequestId = 0;
//From here
const tempValue = document.querySelector("#tempValue");
const weatherCondition = document.querySelector("#weatherCondition");
const windSpeed = document.querySelector("#windSpeed");
const humidity = document.querySelector("#humidity");
const windDirection = document.querySelector("#windDirection");
const lastUpdated = document.querySelector("#lastUpdated");

const citySearchForm = document.querySelector("#citySearchForm");
const citySearchInput = document.querySelector("#citySearchInput");

const WMO_CODES = {
    0: { label: "Clear Sky", icon: "bi-sun-fill text-warning" },
    1: { label: "Mainly Clear", icon: "bi-cloud-sun-fill text-warning" },
    2: { label: "Partly Cloudy", icon: "bi-cloud-sun-fill text-warning" },
    3: { label: "Overcast", icon: "bi-clouds-fill text-secondary" },
    45: { label: "Foggy", icon: "bi-cloud-fog-fill text-secondary" },
    48: { label: "Rime Fog", icon: "bi-cloud-fog2-fill text-secondary" },
    51: { label: "Light Drizzle", icon: "bi-cloud-drizzle-fill text-info" },
    53: { label: "Moderate Drizzle", icon: "bi-cloud-drizzle-fill text-info" },
    55: { label: "Dense Drizzle", icon: "bi-cloud-drizzle-fill text-info" },
    61: { label: "Slight Rain", icon: "bi-cloud-rain-fill text-primary" },
    63: { label: "Moderate Rain", icon: "bi-cloud-rain-fill text-primary" },
    65: { label: "Heavy Rain", icon: "bi-cloud-rain-heavy-fill text-primary" },
    71: { label: "Slight Snow", icon: "bi-snow text-info" },
    73: { label: "Moderate Snow", icon: "bi-snow text-info" },
    75: { label: "Heavy Snow", icon: "bi-snow2 text-white" },
    80: { label: "Rain Showers", icon: "bi-cloud-rain-heavy-fill text-primary" },
    95: { label: "Thunderstorm", icon: "bi-cloud-lightning-fill text-warning" },
    96: { label: "Thunderstorm w/ Hail", icon: "bi-cloud-lightning-rain-fill text-warning" }
};

//to here
const showStatus=(message, type = "secondary")=>{
    clearTimeout(statusTimeout);
    statusAlert.className = `alert alert-${type} py-2 small`;
    statusMessage.textContent = message;
    statusAlert.classList.remove("d-none");
}
const hideStatus = () => {
    clearTimeout(statusTimeout);
    statusTimeout = undefined;
    statusAlert.classList.add("d-none");
};

const fetchWeather= async (lat, lon) => {
    showStatus("Fetching live atmospheric telemetry...", "info");
    const endpoint = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,wind_direction_10m`;

    try{
        const response = await fetch(endpoint);
        if (!response.ok) throw new Error (`Weather API error: ${response.status}`);

        const data = await response.json();
        const current = data.current;

        tempValue.textContent = `${Math.round(current.temperature_2m)}°C`;
        humidity.textContent = `${current.relative_humidity_2m}%`;
        windSpeed.textContent = `${current.wind_speed_10m} km/h`;
        windDirection.textContent = `${current.wind_direction_10m}°`;

        const condition = WMO_CODES[current.weather_code] || {
            label: "Variable Conditions",
            icon: "bi-cloud-fill text-secondary"
        };

        weatherCondition.innerHTML = `<i class="bi ${condition.icon} me-2"></i>${condition.label}`;
        const now = new Date();
        lastUpdated.textContent = `Updated: ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
        hideStatus();
    }catch(err){
        console.error("Weather fetch failed:", err);
        showStatus("Failed to retrieve weather metrics.", "danger");
    }
}

const reverseGeocode= async (lat, lon) =>{
    try{
        const endpoint = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`;
        const response = await fetch(endpoint, {
            headers: { "Accept": "application/json" }
        });
        if (!response.ok) throw new Error("Could not reverse lookup city.");
        const data = await response.json();
        return data.address.city || data.address.town || data.address.county || data.address.state || "Detected Location";
    }catch(err){
        console.warn("Reverse geocode fallback:", err.message);
        return "Current Coordinates";
    }
};

const searchCityCoordinates = async (query) => {
    const cleanQuery = query.trim();
    if (!cleanQuery) return;

    showStatus(`Searching for "${cleanQuery}"...`, "info");

    try {
        const endpoint = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(cleanQuery)}`;
        const response = await fetch(endpoint, {
            headers: { "Accept": "application/json" }
        });

        if (!response.ok) throw new Error(`City search failed (${response.status})`);

        const results = await response.json();
        if (!results.length) throw new Error("No matching city was found.");

        const location = results[0];
        const latitude = Number(location.lat);
        const longitude = Number(location.lon);
        const displayName = location.name || location.display_name?.split(",")[0]?.trim() || "Selected City";

        cityName.textContent = displayName;
        coordsDisplay.textContent = `Lat: ${latitude.toFixed(2)}, Lon: ${longitude.toFixed(2)}`;
        await fetchWeather(latitude, longitude);
    } catch (err) {
        console.error("City search failed:", err);
        showStatus("Unable to find that city. Try another location.", "danger");
    }
};

const handleLocationSuccess=async (position, requestId) =>{
    const { latitude, longitude } = position.coords;
    coordsDisplay.textContent = `Lat: ${latitude.toFixed(2)}, Lon: ${longitude.toFixed(2)}`;
    showStatus("Acquired GPS fix! Loading location details...", "success");
    const city = await reverseGeocode(latitude, longitude);
    if (requestId !== locationRequestId) return;

    cityName.textContent = city;
    await fetchWeather(latitude, longitude);
    statusTimeout = setTimeout(() => {
        if (requestId === locationRequestId) hideStatus();
    }, 3000);
    console.log(`Ready for weather query at: ${latitude}, ${longitude}`);
};

const handleLocationError=(error) =>{
    let msg = "Location lookup failed.";
    let locationLabel = "Location unavailable";
    switch (error.code) {
        case error.PERMISSION_DENIED:
            msg = "Location permission denied. Please allow access to your location.";
            locationLabel = "Location denied";
            break;
        case error.POSITION_UNAVAILABLE:
            msg = "Location information is unavailable.";
            break;
        case error.TIMEOUT:
            msg = "Location lookup timed out. Check that location services are enabled, then try again.";
            locationLabel = "Location lookup timed out";
            break;
        default:
            msg = "An unknown error occurred while retrieving your location.";
    }
    showStatus(msg, "danger");
    cityName.textContent = locationLabel;
};

const requestDeviceLocation=() =>{
    const requestId = ++locationRequestId;
    if (!navigator.geolocation) {
        showStatus("Geolocation is not supported by your browser.", "danger");
        return;
    }
    showStatus("Requesting device location...", "info");

    navigator.geolocation.getCurrentPosition(
        position => {
            if (requestId === locationRequestId) handleLocationSuccess(position, requestId);
        },
        error => {
            if (requestId === locationRequestId) handleLocationError(error);
        },
        { timeout: 20000, enableHighAccuracy: false, maximumAge: 300000 }
    );
}

locateBtn.addEventListener("click", requestDeviceLocation);

citySearchForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const query=citySearchInput.value.trim();
    if (query){
        searchCityCoordinates(query);
        citySearchInput.value = "";
    }
})

window.addEventListener("DOMContentLoaded", requestDeviceLocation);