/**
 * Line Chart Component (Temporal)
 * Now with Transitions!
 */
const drawLineChart = (svg, data) => {
  const WIDTH = 600;
  const HEIGHT = 350;
  const MARGINS = { top: 20, right: 30, bottom: 50, left: 60 };
  const DURATION = 750;

  // 1. Scales
  const xScale = d3.scaleTime()
    .domain(d3.extent(data, d => d.date))
    .range([MARGINS.left, WIDTH - MARGINS.right]);
  
  const yMax = d3.max(data, d => d.value) || 0;
  const yScale = d3.scaleLinear()
    .domain([0, yMax * 1.1]) 
    .range([HEIGHT - MARGINS.bottom, MARGINS.top]);

  // Line Generator
  const lineGenerator = d3.line()
    .curve(d3.curveMonotoneX)
    .x(d => xScale(d.date))
    .y(d => yScale(d.value));

  // 2. Setup Groups (Persistent)
  const xAxisGroup = svg.selectAll(".x-axis")
    .data([null])
    .join("g")
    .attr("class", "x-axis")
    .attr("transform", `translate(0,${HEIGHT - MARGINS.bottom})`);

  const yAxisGroup = svg.selectAll(".y-axis")
    .data([null])
    .join("g")
    .attr("class", "y-axis")
    .attr("transform", `translate(${MARGINS.left},0)`);

  // Wrapper for chart content to keep it behind axes if needed, or organized
  const contentGroup = svg.selectAll(".content")
    .data([null])
    .join("g")
    .attr("class", "content");

  // 3. Update Axes
  // Adaptive Date Format: Show Year if range > 1 year, else just Month
  const formatTime = d3.timeFormat(data.length > 12 ? "%b %Y" : "%B");

  xAxisGroup.transition().duration(DURATION)
    .call(d3.axisBottom(xScale).ticks(5).tickFormat(formatTime));

  yAxisGroup.transition().duration(DURATION)
    .call(d3.axisLeft(yScale).ticks(5));

  // 4. Draw/Update Line
  // We bind the entire data array as a single datum to the path
  const linePath = contentGroup.selectAll(".line-path")
    .data([data]); // Array of 1 element which IS the data array

  linePath.join(
    enter => enter.append("path")
      .attr("class", "line-path")
      .attr("fill", "none")
      .attr("stroke", "#5f27cd")
      .attr("stroke-width", 3)
      .attr("d", lineGenerator) // Set initial path
      .attr("opacity", 0)
      .call(enter => enter.transition().duration(DURATION)
        .attr("opacity", 1)),
    update => update.transition().duration(DURATION)
      .attr("d", lineGenerator), // Morph to new shape
    exit => exit.remove()
  );

  // 5. Draw/Update Dots
  contentGroup.selectAll(".dot")
    .data(data, d => d.date.getTime()) // Key by date for stability
    .join(
      enter => enter.append("circle")
        .attr("class", "dot")
        .attr("cx", d => xScale(d.date))
        .attr("cy", d => yScale(d.value))
        .attr("r", 0) // Start invisible
        .attr("fill", "#5f27cd")
        .call(enter => enter.transition().duration(DURATION)
          .attr("r", 4)), // Pop in
      update => update.transition().duration(DURATION)
        .attr("cx", d => xScale(d.date))
        .attr("cy", d => yScale(d.value)),
      exit => exit.transition().duration(DURATION)
        .attr("r", 0) // Shrink out
        .remove()
    )
    .selectAll("title").remove(); // Remove old titles

  // Re-append titles (tooltips) for simplicity
  contentGroup.selectAll(".dot")
    .append("title") 
    .text(d => `${d3.timeFormat("%B %Y")(d.date)}: ${d.value} accidents`);
};