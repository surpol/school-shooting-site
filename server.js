const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const path = require('path');
const dotenv = require('dotenv');
dotenv.config();
const { getJson } = require("serpapi");

const app = express();

// Set EJS as templating engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static('public')); // for static files like CSS, JS

// Wikipedia URLs
const WIKIPEDIA_URLS = [
  'https://en.wikipedia.org/wiki/List_of_school_shootings_in_the_United_States_(before_2000)',
  'https://en.wikipedia.org/wiki/List_of_school_shootings_in_the_United_States_(2000%E2%80%93present)',
];

// Helper function to sanitize data and remove footnotes or non-numeric characters
function sanitizeField(value) {
  const match = value.match(/\d+/);
  return match ? match[0] : '0';
}

// Function to scrape data from each URL
async function scrapeWikipediaData() {
  let allData = [];

  for (const url of WIKIPEDIA_URLS) {
    try {
      const { data } = await axios.get(url);
      const $ = cheerio.load(data);

      $('table.wikitable').each((index, table) => {
        const headers = $(table).find('th').map((i, th) => $(th).text().trim()).get();

        if (headers.includes('Date') && headers.includes('Location') && headers.includes('Deaths')) {
          $(table).find('tbody tr').each((i, row) => {
            const date = $(row).find('td').first().text().trim();
            const location = $(row).find('td').eq(1).text().trim();
            let deaths, injuries, description;

            if (url.includes('by_death_toll')) {
              deaths = sanitizeField($(row).find('td').eq(2).text().trim());
              injuries = sanitizeField($(row).find('td').eq(3).text().trim());
              description = $(row).find('td').eq(4).text().trim();
            } else {
              deaths = sanitizeField($(row).find('td').eq(2).text().trim());
              injuries = sanitizeField($(row).find('td').eq(3).text().trim());
              description = $(row).find('td').eq(5).text().trim();
            }
 
            if (date && location && deaths && !isNaN(deaths)) {
              allData.push({
                date,
                location,
                deaths: parseInt(deaths),
                injuries: parseInt(injuries) || 0,
                description
              });
            }
          });
        }
      });

    } catch (error) {
      console.error(`Error scraping ${url}:`, error);
    }
  }

  return allData;
}

// Serve homepage and scrape data
app.get('/', async (req, res) => {
  const schoolData = await scrapeWikipediaData();
  res.render('index', { data: schoolData });
});

// Fetching top stories using SerpApi
app.get('/api/top-stories', (req, res) => {
  const apiKey = process.env.TOP_STORIES_API_KEY;
  console.log("API key:", apiKey);
  if (!apiKey) {
    return res.status(500).json({ error: "API key is missing. Please set TOP_STORIES_API_KEY in the environment variables." });
  }
  getJson({
    api_key: apiKey,
    engine: "google",
    q: "school shooting",
    location: "United States",
    google_domain: "google.com",
    gl: "us",
    hl: "en",
    device: "mobile"
  }, (json) => {
    const topStories = json.top_stories || [];
    res.json(topStories);
  });
});

// Start server
const PORT = process.env.PORT || 3003;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
