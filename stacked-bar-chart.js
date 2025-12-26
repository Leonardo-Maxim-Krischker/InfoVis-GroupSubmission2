/**
 * Stacked Bar Chart Component (Causal)
 */
const drawStackedBarChart = (svg, data, colorScale) => {
  // Current data filtering (Example: 2020)
  const currentData = data.filter(d => d.year === 2020);

  const xScale = d3.scaleBand()
    .domain(currentData.map(d => d.country))
    .range([MARGINS.left, WIDTH - MARGINS.right])
    .padding(0.2);

  const yScale = d3.scaleLinear()
    .domain([0, d3.max(currentData, d => d.value)])
    .range([HEIGHT - MARGINS.bottom, MARGINS.top]);

  svg.append("g")
    .selectAll("rect")
    .data(currentData, d => d.geo)
    .join("rect")
      .attr("class", d => d.geo)
      .attr("x", d => xScale(d.country))
      .attr("y", d => yScale(d.value))
      .attr("height", d => yScale(0) - yScale(d.value))
      .attr("width", xScale.bandwidth())
      .attr("fill", d => colorScale(d.country));

  // Add X-Axis with rotated labels
  svg.append("g")
    .attr("transform", `translate(0,${HEIGHT - MARGINS.bottom})`)
    .call(d3.axisBottom(xScale))
    .selectAll("text")
      .style("text-anchor", "end")
      .attr("transform", "rotate(-65)")
      .attr("dx", "-.8em")
      .attr("dy", ".15em");
};