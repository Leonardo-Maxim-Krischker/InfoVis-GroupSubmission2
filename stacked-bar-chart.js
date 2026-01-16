/**
 * Stacked Bar Chart Component (Causal)
 * Visualizes the breakdown of accident severity across different weather conditions.
 * Now with Transitions!
 */
const drawStackedBarChart = (svg, data, colorScale) => {
  const WIDTH = 600;
  const HEIGHT = 350;
  const MARGINS = { top: 20, right: 20, bottom: 100, left: 60 };
  const DURATION = 750; // Animation speed in ms

  // 1. Setup Stack Generator
  const keys = [1, 2, 3, 4];
  const stack = d3.stack()
    .keys(keys)
    .order(d3.stackOrderNone)
    .offset(d3.stackOffsetNone);

  const stackedData = stack(data);

  // 2. Define Scales
  // Calculate max domain, defaulting to 10 if data is empty
  const yMax = d3.max(data, d => d.total) || 10;
  
  const xScale = d3.scaleBand()
    .domain(data.map(d => d.category))
    .range([MARGINS.left, WIDTH - MARGINS.right])
    .padding(0.3);

  const yScale = d3.scaleLinear()
    .domain([0, yMax])
    .nice()
    .range([HEIGHT - MARGINS.bottom, MARGINS.top]);

  // 3. Setup Groups (Only if they don't exist)
  // We use .join to create them once and keep them
  const chartGroup = svg.selectAll(".chart-group")
    .data([null])
    .join("g")
    .attr("class", "chart-group");

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

  const legendGroup = svg.selectAll(".legend")
    .data([null])
    .join("g")
    .attr("class", "legend")
    .attr("transform", `translate(${WIDTH - 100}, ${MARGINS.top})`);

  // 4. Update Axes with Transition
  xAxisGroup.transition().duration(DURATION)
    .call(d3.axisBottom(xScale))
    .selectAll("text")
      .style("text-anchor", "end")
      .attr("dx", "-.8em")
      .attr("dy", ".15em")
      .attr("transform", "rotate(-45)");

  yAxisGroup.transition().duration(DURATION)
    .call(d3.axisLeft(yScale).ticks(5));

  // 5. Render Layers & Bars
  // Bind data to groups for each stack layer
  const layers = chartGroup.selectAll(".layer")
    .data(stackedData)
    .join("g")
    .attr("class", "layer")
    .attr("fill", d => colorScale(d.key));

  // Bind data to rects within each layer
  layers.selectAll("rect")
    .data(d => d, d => d.data.category) // Key by category name for stability
    .join(
      enter => enter.append("rect")
        .attr("x", d => xScale(d.data.category))
        .attr("y", yScale(0)) // Start from bottom
        .attr("height", 0)    // Start with 0 height
        .attr("width", xScale.bandwidth())
        .call(enter => enter.transition().duration(DURATION)
          .attr("y", d => yScale(d[1]))
          .attr("height", d => yScale(d[0]) - yScale(d[1]))
        ),
      update => update.call(update => update.transition().duration(DURATION)
        .attr("x", d => xScale(d.data.category))
        .attr("width", xScale.bandwidth())
        .attr("y", d => yScale(d[1]))
        .attr("height", d => yScale(d[0]) - yScale(d[1]))
      ),
      exit => exit.call(exit => exit.transition().duration(DURATION)
        .attr("y", yScale(0))
        .attr("height", 0)
        .remove()
      )
    );

  // 6. Legend (Static update)
  legendGroup.selectAll("text")
    .data([null])
    .join("text")
    .attr("x", 0)
    .attr("y", 0)
    .attr("font-size", "10px")
    .attr("fill", "#666")
    .text("Darker = More Severe");
};