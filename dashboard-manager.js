/**
 * Dashboard Manager
 * Orchestrates data loading and chart initialization.
 */

// Global configuration constants
const WIDTH = 900;
const HEIGHT = 400;
const MARGINS = { top: 20, right: 100, bottom: 80, left: 50 };

// Load and prepare the dataset
d3.csv("./data.csv", d => {
  return {
    geo: d.geo,
    country: d.country,
    year: +d.year,
    value: +d.value,
    date: d3.timeParse("%Y")(d.year)
  };
}).then(data => {
  // Sort data by country and year for consistency
  data.sort((a, b) => d3.ascending(a.country, b.country) || d3.ascending(a.year, b.year));

  // Define a shared color scale based on countries
  const countries = Array.from(new Set(data.map(d => d.country))).sort();
  const colorScale = d3.scaleOrdinal()
    .domain(countries)
    .range(d3.quantize(d3.interpolateRainbow, countries.length));

  // Initialize SVG containers for each chart
  const mapSvg = d3.select("#map-chart").append("svg").attr("viewBox", [0, 0, WIDTH, HEIGHT]);
  const lineSvg = d3.select("#line-chart").append("svg").attr("viewBox", [0, 0, WIDTH, HEIGHT]);
  const barSvg = d3.select("#bar-chart").append("svg").attr("viewBox", [0, 0, WIDTH, HEIGHT]);

  // Execute drawing functions from component files
  drawUSMap(mapSvg, data, colorScale);
  drawLineChart(lineSvg, data, colorScale);
  drawStackedBarChart(barSvg, data, colorScale);
});