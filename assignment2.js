const POLYGON_API_KEY = ""; // Replace with your Polygon API key
let stockChart = null;
let breedMap = {};
let swiperInstance = null;

function navigatePage(page) {
    const normalized = page.trim().toLowerCase();
    if (normalized.includes('home')) {
        window.location.href = 'assignment2.html';
    } else if (normalized.includes('stock')) {
        window.location.href = 'assignment2-stock.html';
    } else if (normalized.includes('dog')) {
        window.location.href = 'assignment2-dogs.html';
    }
}

function setPageColor(color) {
    document.body.style.backgroundColor = color;
}

function enableAudio() {
    if (!window.annyang) {
        alert('Annyang is not available. Please check your browser and network connection.');
        return;
    }
    if (!annyang.isListening()) {
        annyang.start({ autoRestart: true, continuous: false });
    }
}

function disableAudio() {
    if (window.annyang && annyang.isListening()) {
        annyang.abort();
    }
}

function initAnnyang() {
    if (!window.annyang) {
        console.warn('Annyang not loaded. Audio commands are disabled.');
        return;
    }

    const commands = {
        'hello': () => alert('Hello World'),
        'change the color to *color': setPageColor,
        'navigate to *page': navigatePage,
    };

    if (document.body.dataset.page === 'stocks') {
        commands['lookup *ticker'] = ticker => {
            const input = document.getElementById('ticker-input');
            input.value = ticker.toUpperCase();
            document.getElementById('range-select').value = '30';
            fetchStockData(ticker.toUpperCase(), 30);
        };
    }

    if (document.body.dataset.page === 'dogs') {
        commands['load dog breed *breedName'] = breedName => {
            const normalized = breedName.toLowerCase().trim();
            const matched = Object.keys(breedMap).find(name => name.toLowerCase() === normalized);
            if (matched) {
                showBreedInfo(breedMap[matched]);
            } else {
                alert(`Breed not found: ${breedName}. Try one of the visible buttons.`);
            }
        };
    }

    annyang.removeCommands();
    annyang.addCommands(commands);
    annyang.setLanguage('en-US');
}

async function fetchQuote() {
    const quoteText = document.getElementById('quote-text');
    const quoteAuthor = document.getElementById('quote-author');
    try {
        const response = await fetch('https://zenquotes.io/api/random');
        const data = await response.json();
        if (Array.isArray(data) && data.length > 0) {
            quoteText.textContent = `"${data[0].q}"`;
            quoteAuthor.textContent = `— ${data[0].a}`;
        } else {
            quoteText.textContent = 'Unable to fetch a quote right now.';
            quoteAuthor.textContent = '';
        }
    } catch (error) {
        quoteText.textContent = 'Unable to fetch a quote. Please check your network.';
        quoteAuthor.textContent = '';
        console.error(error);
    }
}

function makeLabelsFromEpoch(results) {
    return results.map(point => {
        const date = new Date(point.t);
        return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    });
}

function createStockChart(labels, values) {
    const ctx = document.getElementById('stock-chart').getContext('2d');
    if (stockChart) {
        stockChart.destroy();
    }
    stockChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label: '($) Stock Price',
                data: values,
                borderColor: '#1f77b4',
                backgroundColor: 'rgba(31, 119, 180, 0.15)',
                pointRadius: 4,
                fill: true,
                tension: 0.25,
            }],
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: false,
                    ticks: {
                        callback: value => `$${value}`
                    }
                }
            }
        }
    });
}

function formatDateForApi(date) {
    return date.toISOString().slice(0, 10);
}

async function fetchStockData(ticker, days) {
    if (!POLYGON_API_KEY) {
        alert('Please add your Polygon API key in assignment2.js before performing stock lookups.');
        return;
    }

    const toDate = new Date();
    const fromDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const from = formatDateForApi(fromDate);
    const to = formatDateForApi(toDate);
    const url = `https://api.polygon.io/v2/aggs/ticker/${ticker}/range/1/day/${from}/${to}?adjusted=true&sort=asc&limit=${days}&apiKey=${POLYGON_API_KEY}`;

    try {
        const response = await fetch(url);
        const data = await response.json();

        if (!data || !data.results || data.results.length === 0) {
            alert('No chart data found for ' + ticker + '. Please verify the ticker and try again.');
            return;
        }

        const labels = makeLabelsFromEpoch(data.results);
        const closes = data.results.map(point => point.c);
        createStockChart(labels, closes);
    } catch (error) {
        alert('Unable to load stock data. Ensure CORS extension is enabled and the API key is valid.');
        console.error(error);
    }
}

async function fetchTopStocks() {
    const tbody = document.querySelector('#stock-table tbody');
    tbody.innerHTML = '<tr><td colspan="3">Loading top stocks...</td></tr>';

    try {
        const response = await fetch('https://apewisdom.io/api/v1.0/filter/all-stocks/page/1');
        if (!response.ok) {
            throw new Error(`API returned status ${response.status}`);
        }
        const rawData = await response.json();
        
        let data = rawData;
        if (rawData && rawData.data && Array.isArray(rawData.data)) {
            data = rawData.data;
        } else if (!Array.isArray(rawData)) {
            throw new Error('Unexpected API response format');
        }
        
        const topFive = data.slice(0, 5);

        tbody.innerHTML = '';
        topFive.forEach(stock => {
            const row = document.createElement('tr');
            const link = document.createElement('a');
            link.href = `https://finance.yahoo.com/quote/${stock.ticker}`;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            link.textContent = stock.ticker;

            const sentiment = stock.upvotes > 1 ? '🐂 Bullish' : '🐻 Bearish';
            row.innerHTML = `
                <td></td>
                <td>${stock.mentions}</td>
                <td>${sentiment}</td>
            `;
            row.querySelector('td').appendChild(link);
            tbody.appendChild(row);
        });
    } catch (error) {
        tbody.innerHTML = '<tr><td colspan="3">Unable to load top stocks at this time.</td></tr>';
        console.error('Stock fetch error:', error);
    }
}

async function fetchDogImages() {
    const wrapper = document.getElementById('dog-slide-wrapper');
    try {
        const response = await fetch('https://dog.ceo/api/breeds/image/random/10');
        const data = await response.json();
        wrapper.innerHTML = '';
        data.message.forEach(url => {
            const slide = document.createElement('div');
            slide.className = 'swiper-slide';
            slide.innerHTML = `<img src="${url}" alt="Random dog image" loading="lazy" />`;
            wrapper.appendChild(slide);
        });
        if (swiperInstance) {
            swiperInstance.destroy(true, true);
        }
        swiperInstance = new Swiper('.mySwiper', {
            loop: true,
            pagination: { el: '.swiper-pagination', clickable: true },
            navigation: { nextEl: '.swiper-button-next', prevEl: '.swiper-button-prev' },
        });
    } catch (error) {
        wrapper.innerHTML = '<div class="swiper-slide">Unable to load dog images.</div>';
        console.error(error);
    }
}

async function fetchDogBreeds() {
    const buttonContainer = document.getElementById('breed-buttons');
    buttonContainer.innerHTML = 'Loading breed buttons...';

    try {
        const response = await fetch('https://api.dogapi.dog/v2/breeds');
        if (!response.ok) {
            throw new Error(`API returned status ${response.status}`);
        }
        const rawData = await response.json();
        
        let breeds = rawData;
        if (rawData && rawData.data && Array.isArray(rawData.data)) {
            breeds = rawData.data;
        } else if (!Array.isArray(rawData)) {
            throw new Error('Unexpected API response format: not an array');
        }
        
        breedMap = {};
        buttonContainer.innerHTML = '';

        breeds.slice(0, 18).forEach(breed => {
            const button = document.createElement('button');
            button.className = 'breed-action';
            button.textContent = breed.name;
            button.dataset.breedName = breed.name;
            buttonContainer.appendChild(button);
            breedMap[breed.name] = breed;
        });

        buttonContainer.addEventListener('click', event => {
            if (event.target.matches('.breed-action')) {
                const breedName = event.target.dataset.breedName;
                showBreedInfo(breedMap[breedName]);
            }
        });
    } catch (error) {
        buttonContainer.innerHTML = 'Unable to load breed list.';
        console.error('Breed fetch error:', error);
    }
}

function showBreedInfo(breed) {
    if (!breed) {
        return;
    }
    document.getElementById('breed-title').textContent = `Name: ${breed.name}`;
    document.getElementById('breed-description').textContent = breed.temperament || breed.bred_for || 'No description available.';

    const lifeSpan = breed.life_span || '';
    const match = lifeSpan.match(/(\d+)\D*(\d*)/);
    const minLife = match ? match[1] : 'N/A';
    const maxLife = match && match[2] ? match[2] : minLife;

    document.getElementById('breed-min-life').textContent = minLife;
    document.getElementById('breed-max-life').textContent = maxLife;
    document.getElementById('breed-info').classList.remove('hidden');
}

window.addEventListener('DOMContentLoaded', () => {
    initAnnyang();
    if (document.body.dataset.page === 'home') {
        fetchQuote();
    }
    if (document.body.dataset.page === 'stocks') {
        document.getElementById('lookup-button').addEventListener('click', () => {
            const ticker = document.getElementById('ticker-input').value.trim().toUpperCase();
            const range = parseInt(document.getElementById('range-select').value, 10);
            if (!ticker) {
                alert('Please enter a stock ticker.');
                return;
            }
            fetchStockData(ticker, range);
        });
        fetchTopStocks();
    }
    if (document.body.dataset.page === 'dogs') {
        fetchDogImages();
        fetchDogBreeds();
    }
});
