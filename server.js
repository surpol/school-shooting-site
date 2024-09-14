const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const path = require('path');

const app = express();

// Set EJS as templating engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static('public')); // for static files like CSS, JS

// Wikipedia URLs
const WIKIPEDIA_URLS = [
  'https://en.wikipedia.org/wiki/List_of_school_shootings_in_the_United_States_(before_2000)',
  'https://en.wikipedia.org/wiki/List_of_school_shootings_in_the_United_States_(2000%E2%80%93present)',
  'https://en.wikipedia.org/wiki/List_of_school_shootings_in_the_United_States_by_death_toll'
];

// Helper function to sanitize data and remove footnotes or non-numeric characters
function sanitizeField(value) {
  // Use regex to extract only the first numeric part (if multiple numbers exist)
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

      // Filter to extract only tables with relevant shooting data
      $('table.wikitable').each((index, table) => {
        const headers = $(table).find('th').map((i, th) => $(th).text().trim()).get();

        // Check if the table contains "Date", "Location", "Deaths" columns (to identify incident data tables)
        if (headers.includes('Date') && headers.includes('Location') && headers.includes('Deaths')) {
          // Now iterate through rows and extract the data
          $(table).find('tbody tr').each((i, row) => {
            const date = $(row).find('td').first().text().trim();
            const location = $(row).find('td').eq(1).text().trim();
            let deaths, injuries, description;

            // Check if this is the "death toll" page (3rd URL), which has one less column
            if (url.includes('by_death_toll')) {
              deaths = sanitizeField($(row).find('td').eq(2).text().trim());  // Clean footnotes from deaths
              injuries = sanitizeField($(row).find('td').eq(3).text().trim());  // Clean footnotes from injuries
              description = $(row).find('td').eq(4).text().trim();  // Description is in the 4th column for this page
            } else {
              // For the other two pages
              deaths = sanitizeField($(row).find('td').eq(2).text().trim());  // Clean footnotes from deaths
              injuries = sanitizeField($(row).find('td').eq(3).text().trim());  // Clean footnotes from injuries
              description = $(row).find('td').eq(5).text().trim();  // Description is in the 5th column for these pages
            }

            // Ensure we only push meaningful data (filter out "Total" rows or other irrelevant data)
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

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

